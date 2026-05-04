import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.inventory import (
    WarehouseRepository,
    StockMovementRepository,
    ItemRepository,
    ItemGroupRepository,
    InventoryAdjustmentRepository,
)
from app.services.auth import get_current_user
from app.services import settings_service

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


@router.get("/valuation")
def inventory_valuation(user: dict = Depends(get_current_user)):
    items, _ = ItemRepository(user["org_id"]).list(limit=2000)
    rows = []
    for item in items:
        stock_on_hand = float(item.get("stock_on_hand", 0) or 0)
        cost_price = float(item.get("cost_price", 0) or 0)
        total_value = stock_on_hand * cost_price
        rows.append({
            "item_id": item["id"],
            "name": item.get("name", ""),
            "sku": item.get("sku", ""),
            "stock_on_hand": stock_on_hand,
            "reorder_point": float(item.get("reorder_point", 0) or 0),
            "cost_price": cost_price,
            "total_value": total_value,
            "value": total_value,
        })
    return {"items": rows, "total": len(rows)}


@router.get("/low-stock")
def inventory_low_stock(user: dict = Depends(get_current_user)):
    items, _ = ItemRepository(user["org_id"]).list_low_stock()
    low_stock = [
        item for item in items
        if float(item.get("stock_on_hand", 0) or 0) <= float(item.get("reorder_point", 0) or 0)
    ]
    return {"items": low_stock, "total": len(low_stock)}


@router.get("/reorder-suggestions")
def reorder_suggestions(user: dict = Depends(get_current_user)):
    """Suggest purchase orders for low-stock items, grouped by preferred vendor.

    Returns DRAFT suggestions only — does NOT create POs. UI shows the suggestions
    and the user calls POST /api/inventory/generate-reorder-pos to commit.
    Items without `preferred_vendor_id` are returned in the `unassigned` bucket
    so the user can pick a vendor manually.
    """
    items, _ = ItemRepository(user["org_id"]).list_low_stock()
    grouped: dict = {}
    unassigned: list = []
    for item in items:
        on_hand = float(item.get("stock_on_hand", 0) or 0)
        rop = float(item.get("reorder_point", 0) or 0)
        if on_hand > rop:
            continue
        # How much to reorder: max_stock - on_hand if max defined, else 2x reorder_point - on_hand
        max_stock = float(item.get("max_stock", 0) or 0)
        target = max_stock if max_stock > 0 else (rop * 2 if rop > 0 else 1)
        qty_needed = max(target - on_hand, 1.0)
        line = {
            "item_id": item["id"],
            "name": item.get("name", ""),
            "sku": item.get("sku", ""),
            "stock_on_hand": on_hand,
            "reorder_point": rop,
            "quantity": round(qty_needed, 2),
            "unit_price": float(item.get("purchase_price", item.get("cost_price", 0)) or 0),
        }
        vendor_id = item.get("preferred_vendor_id") or item.get("vendor_id")
        if vendor_id:
            grouped.setdefault(vendor_id, []).append(line)
        else:
            unassigned.append(line)
    return {
        "by_vendor": [{"vendor_id": vid, "lines": lines} for vid, lines in grouped.items()],
        "unassigned": unassigned,
        "total_items": sum(len(v) for v in grouped.values()) + len(unassigned),
    }


@router.post("/generate-reorder-pos", status_code=201)
def generate_reorder_pos(user: dict = Depends(get_current_user)):
    """Create one DRAFT purchase order per preferred-vendor for low-stock items.

    Items without `preferred_vendor_id` are skipped and returned in `skipped`.
    POs are created in `draft` status so the user can review/approve/edit before
    sending to the vendor.
    """
    from app.firestore.bills import PurchaseOrderRepository
    from app.firestore.system import SequenceRepository
    
    # Apply inventory config defaults
    try:
        cfg = settings_service.get_bag(user["org_id"], "inventory")
    except Exception:
        cfg = {}

    suggestions = reorder_suggestions(user)
    by_vendor = suggestions["by_vendor"]
    if not by_vendor:
        return {"created": [], "skipped": suggestions["unassigned"], "total": 0}

    po_repo = PurchaseOrderRepository(user["org_id"])
    seq_repo = SequenceRepository(user["org_id"])
    created = []
    today = datetime.utcnow().isoformat()
    
    default_reorder_point = cfg.get("default_reorder_point", 10)
    default_reorder_qty = cfg.get("default_reorder_qty", 50)

    for group in by_vendor:
        vendor_id = group["vendor_id"]
        lines = group["lines"]
        # Apply defaults if item-level rules are missing
        for line in lines:
            if line.get("reorder_point", 0) == 0:
                line["reorder_point"] = default_reorder_point
            if line.get("quantity", 0) == 0:
                line["quantity"] = default_reorder_qty
        po_id = str(uuid.uuid4())
        number = seq_repo.get_next("purchase_order")
        po_repo.create({
            "id": po_id,
            "order_number": number,
            "contact_id": vendor_id,
            "date": today,
            "status": "draft",
            "currency_code": "IQD",
            "exchange_rate": 1.0,
            "notes": "Auto-generated from low-stock reorder rules",
            "source": "auto_reorder",
        })
        po_repo.set_lines(po_id, [
            {
                "id": str(uuid.uuid4()),
                "item_id": l["item_id"],
                "description": l["name"],
                "quantity": l["quantity"],
                "unit_price": l["unit_price"],
                "discount_percent": 0,
            }
            for l in lines
        ])
        created.append({"po_id": po_id, "order_number": number, "vendor_id": vendor_id, "line_count": len(lines)})

    return {"created": created, "skipped": suggestions["unassigned"], "total": len(created)}


@router.get("/adjustments")
def list_inventory_adjustments(
    page: int = Query(1),
    page_size: int = Query(20, le=500),
    user: dict = Depends(get_current_user),
):
    items, total = InventoryAdjustmentRepository(user["org_id"]).list(
        order_by="date",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size,
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/adjustments", status_code=201)
def create_inventory_adjustment(data: dict, user: dict = Depends(get_current_user)):
    """Create inventory adjustment.
    
    Supports two payload shapes:
      1. Legacy flat: {item_id, quantity_adjusted, reason, date, ...}
      2. Multi-line:  {date, reason, account_id, lines: [{item_id, quantity_adjusted, value_adjusted}, ...]}
    """
    lines = data.get("lines") or []
    if not lines and not data.get("item_id"):
        raise HTTPException(status_code=400, detail="item_id یان lines داواکراوە")
    
    repo = InventoryAdjustmentRepository(user["org_id"])
    
    # Multi-line shape: create one adjustment per line for backward compat with single-item repo
    if lines:
        first = None
        for ln in lines:
            if not ln.get("item_id"):
                raise HTTPException(status_code=400, detail="هەر هێڵێک item_id پێویستە")
            adj = repo.create({
                "id": str(uuid.uuid4()),
                "item_id": ln["item_id"],
                "adjustment_account_id": data.get("account_id") or data.get("adjustment_account_id"),
                "adjustment_type": data.get("adjustment_type", "quantity"),
                "quantity_adjusted": ln.get("quantity_adjusted", 0),
                "value_adjusted": ln.get("value_adjusted", 0),
                "reason": data.get("reason", ""),
                "date": data.get("date") or datetime.utcnow().date().isoformat(),
                "status": data.get("status", "posted"),
                "created_by_id": user["id"],
            })
            if first is None:
                first = adj
        return first
    
    # Legacy flat shape
    return repo.create({
        "id": str(uuid.uuid4()),
        "item_id": data["item_id"],
        "adjustment_account_id": data.get("adjustment_account_id") or data.get("account_id"),
        "quantity_adjusted": data.get("quantity_adjusted", 0),
        "reason": data.get("reason", ""),
        "date": data.get("date") or datetime.utcnow().date().isoformat(),
        "status": data.get("status", "posted"),
        "created_by_id": user["id"],
    })


@router.get("/groups")
def list_item_groups(user: dict = Depends(get_current_user)):
    items, total = ItemGroupRepository(user["org_id"]).list(order_by="name", limit=500)
    return {"items": items, "total": total}


@router.post("/groups", status_code=201)
def create_item_group(data: dict, user: dict = Depends(get_current_user)):
    return ItemGroupRepository(user["org_id"]).create({
        "id": str(uuid.uuid4()),
        "name": data["name"],
        "description": data.get("description", ""),
        "created_by_id": user["id"],
    })

@router.get("/warehouses")
def list_warehouses(user: dict = Depends(get_current_user)):
    repo = WarehouseRepository(user["org_id"])
    items, total = repo.list(limit=100)
    return {"items": items, "total": total}


@router.post("/warehouses", status_code=201)
def create_warehouse(data: dict, user: dict = Depends(get_current_user)):
    return WarehouseRepository(user["org_id"]).create({
        "id": str(uuid.uuid4()),
        "name": data["name"],
        "address": data.get("address", ""),
        "is_primary": data.get("is_primary", False),
        "stock_items": data.get("stock_items", []),
        "created_by_id": user["id"],
    })


@router.put("/warehouses/{warehouse_id}")
def update_warehouse(warehouse_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = WarehouseRepository(user["org_id"])
    if not repo.get(warehouse_id):
        raise HTTPException(404)
    return repo.update(warehouse_id, data)


@router.delete("/warehouses/{warehouse_id}")
def delete_warehouse(warehouse_id: str, user: dict = Depends(get_current_user)):
    repo = WarehouseRepository(user["org_id"])
    if not repo.get(warehouse_id):
        raise HTTPException(404)
    repo.delete(warehouse_id)
    return {"success": True}

@router.get("/movements")
def list_stock_movements(page: int = Query(1), page_size: int = Query(20, le=500), user: dict = Depends(get_current_user)):
    repo = StockMovementRepository(user["org_id"])
    items, total = repo.list(order_by="date", order_dir="DESCENDING", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


# ===== SERIAL NUMBERS =====
@router.get("/serials")
def list_serials(item_id: str = None, status: str = None, page: int = Query(1), page_size: int = Query(20, le=500),
                 user: dict = Depends(get_current_user)):
    from app.firestore.inventory import SerialNumberRepository
    repo = SerialNumberRepository(user["org_id"])
    filters = []
    if item_id: filters.append({"field": "item_id", "op": "==", "value": item_id})
    if status: filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters, limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page}

@router.post("/serials", status_code=201)
def create_serial(data: dict, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import SerialNumberRepository
    repo = SerialNumberRepository(user["org_id"])
    return repo.create({
        "id": str(uuid.uuid4()),
        "item_id": data["item_id"],
        "serial_number": data["serial_number"],
        "status": "in_stock",
        "batch_number": data.get("batch_number", ""),
        "expiry_date": data.get("expiry_date"),
        "purchase_date": data.get("purchase_date"),
        "notes": data.get("notes", ""),
    })

@router.put("/serials/{serial_id}")
def update_serial(serial_id: str, data: dict, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import SerialNumberRepository
    repo = SerialNumberRepository(user["org_id"])
    if not repo.get(serial_id): raise HTTPException(404)
    return repo.update(serial_id, data)

# ===== BOM / COMPOSITE ITEMS =====
@router.get("/composites/{item_id}/components")
def list_components(item_id: str, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import CompositeComponentRepository
    repo = CompositeComponentRepository(user["org_id"])
    items, _ = repo.list(filters=[{"field": "parent_item_id", "op": "==", "value": item_id}], limit=100)
    return items

@router.post("/composites/{item_id}/components", status_code=201)
def add_component(item_id: str, data: dict, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import CompositeComponentRepository
    repo = CompositeComponentRepository(user["org_id"])
    return repo.create({
        "id": str(uuid.uuid4()),
        "parent_item_id": item_id,
        "component_item_id": data["component_item_id"],
        "quantity": data.get("quantity", 1),
        "unit": data.get("unit", "pcs"),
    })

@router.delete("/composites/{item_id}/components/{component_id}")
def remove_component(item_id: str, component_id: str, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import CompositeComponentRepository
    repo = CompositeComponentRepository(user["org_id"])
    repo.delete(component_id)
    return {"success": True}

# ===== STOCK TRANSFERS =====
@router.get("/transfers")
def list_transfers(page: int = Query(1), page_size: int = Query(20, le=500), 
                   user: dict = Depends(get_current_user)):
    from app.firestore.inventory import StockTransferRepository
    repo = StockTransferRepository(user["org_id"])
    items, total = repo.list(order_by="date", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.post("/transfers", status_code=201)
def create_transfer(data: dict, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import StockTransferRepository
    repo = StockTransferRepository(user["org_id"])
    transfer = repo.create({
        "id": str(uuid.uuid4()),
        "transfer_number": data.get("transfer_number", ""),
        "from_warehouse_id": data["from_warehouse_id"],
        "to_warehouse_id": data["to_warehouse_id"],
        "date": data.get("date"),
        "status": "draft",
        "notes": data.get("notes", ""),
    })
    if data.get("lines"):
        repo.set_lines(transfer["id"], data["lines"])
    return transfer

@router.get("/transfers/{transfer_id}")
def get_transfer(transfer_id: str, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import StockTransferRepository
    repo = StockTransferRepository(user["org_id"])
    t = repo.get_with_lines(transfer_id)
    if not t: raise HTTPException(404)
    return t

@router.post("/transfers/{transfer_id}/complete")
def complete_transfer(transfer_id: str, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import StockTransferRepository
    repo = StockTransferRepository(user["org_id"])
    t = repo.get(transfer_id)
    if not t: raise HTTPException(404)
    return repo.update(transfer_id, {"status": "completed"})


# ===== FIX-72: Transfer Approval Workflow =====
@router.post("/transfers/{transfer_id}/approve")
def approve_transfer(transfer_id: str, user: dict = Depends(get_current_user)):
    """Approve a draft/pending transfer (status -> approved)."""
    from app.firestore.inventory import StockTransferRepository
    repo = StockTransferRepository(user["org_id"])
    t = repo.get(transfer_id)
    if not t or t.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="گواستنەوە نەدۆزرایەوە")
    if t.get("status") in ("completed", "cancelled", "rejected"):
        raise HTTPException(status_code=400, detail=f"ناتوانرێت گواستنەوەی دۆخی '{t.get('status')}' پەسەند بکرێت")
    return repo.update(transfer_id, {
        "status": "approved",
        "approved_at": datetime.utcnow().isoformat(),
        "approved_by": user.get("id"),
    })


@router.post("/transfers/{transfer_id}/reject")
def reject_transfer(transfer_id: str, data: dict = None, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import StockTransferRepository
    repo = StockTransferRepository(user["org_id"])
    t = repo.get(transfer_id)
    if not t or t.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="گواستنەوە نەدۆزرایەوە")
    reason = (data or {}).get("reason", "")
    return repo.update(transfer_id, {
        "status": "rejected",
        "rejected_at": datetime.utcnow().isoformat(),
        "rejected_by": user.get("id"),
        "rejection_reason": reason,
    })


# ===== PRICE LISTS =====
@router.get("/price-lists")
def list_price_lists(page: int = Query(1), page_size: int = Query(20, le=500),
                     user: dict = Depends(get_current_user)):
    from app.firestore.inventory import PriceListRepository
    repo = PriceListRepository(user["org_id"])
    items, total = repo.list(order_by="name", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.post("/price-lists", status_code=201)
def create_price_list(data: dict, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import PriceListRepository
    repo = PriceListRepository(user["org_id"])
    price_list = repo.create({
        "id": str(uuid.uuid4()),
        "name": data["name"],
        "description": data.get("description", ""),
        "type": data.get("type", "sales"),
        "percentage": data.get("percentage", 0),
        "rounding_method": data.get("rounding_method", "no_rounding"),
        "is_active": data.get("is_active", True),
    })
    return price_list

@router.get("/price-lists/{price_list_id}")
def get_price_list(price_list_id: str, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import PriceListRepository
    repo = PriceListRepository(user["org_id"])
    pl = repo.get_with_items(price_list_id)
    if not pl: raise HTTPException(404)
    return pl

@router.put("/price-lists/{price_list_id}")
def update_price_list(price_list_id: str, data: dict, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import PriceListRepository
    repo = PriceListRepository(user["org_id"])
    if not repo.get(price_list_id): raise HTTPException(404)
    return repo.update(price_list_id, data)

@router.delete("/price-lists/{price_list_id}")
def delete_price_list(price_list_id: str, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import PriceListRepository
    repo = PriceListRepository(user["org_id"])
    repo.delete(price_list_id)
    return {"success": True}

@router.get("/price-lists/{price_list_id}/items")
def list_price_list_items(price_list_id: str, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import PriceListRepository
    repo = PriceListRepository(user["org_id"])
    if not repo.get(price_list_id): raise HTTPException(404)
    items = repo.get_lines(price_list_id, "items")
    return items

@router.post("/price-lists/{price_list_id}/items", status_code=201)
def add_price_list_item(price_list_id: str, data: dict, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import PriceListRepository
    repo = PriceListRepository(user["org_id"])
    if not repo.get(price_list_id): raise HTTPException(404)
    
    items = repo.get_lines(price_list_id, "items")
    item_data = {
        "id": str(uuid.uuid4()),
        "item_id": data["item_id"],
        "rate": data["rate"],
        "rate_type": data.get("rate_type", "fixed"),
    }
    items.append(item_data)
    repo.set_lines(price_list_id, items, "items")
    return item_data

@router.put("/price-lists/{price_list_id}/items/{item_id}")
def update_price_list_item(price_list_id: str, item_id: str, data: dict, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import PriceListRepository
    repo = PriceListRepository(user["org_id"])
    if not repo.get(price_list_id): raise HTTPException(404)
    
    items = repo.get_lines(price_list_id, "items")
    for item in items:
        if item["id"] == item_id:
            item.update(data)
            repo.set_lines(price_list_id, items, "items")
            return item
    raise HTTPException(404)

@router.delete("/price-lists/{price_list_id}/items/{item_id}")
def remove_price_list_item(price_list_id: str, item_id: str, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import PriceListRepository
    repo = PriceListRepository(user["org_id"])
    if not repo.get(price_list_id): raise HTTPException(404)
    
    items = repo.get_lines(price_list_id, "items")
    items = [item for item in items if item["id"] != item_id]
    repo.set_lines(price_list_id, items, "items")
    return {"success": True}


# ===== BATCH TRACKING =====
@router.get("/batches")
def list_batches(
    page: int = Query(1),
    page_size: int = Query(20, le=500),
    item_id: str = None,
    status: str = None,
    user: dict = Depends(get_current_user)
):
    """List all batches/lots"""
    from app.firestore.inventory import BatchRepository
    repo = BatchRepository(user["org_id"])
    
    filters = []
    if item_id:
        filters.append({"field": "item_id", "op": "==", "value": item_id})
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    
    items, total = repo.list(
        filters=filters,
        order_by="manufactured_date",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/batches", status_code=201)
def create_batch(data: dict, user: dict = Depends(get_current_user)):
    """Create a new batch/lot"""
    from app.firestore.inventory import BatchRepository
    repo = BatchRepository(user["org_id"])
    
    batch_id = str(uuid.uuid4())
    batch_data = {
        "id": batch_id,
        "org_id": user["org_id"],
        "item_id": data["item_id"],
        "batch_number": data["batch_number"],
        "manufactured_date": data.get("manufactured_date"),
        "expiry_date": data.get("expiry_date"),
        "quantity": data.get("quantity", 0),
        "status": data.get("status", "active"),
        "notes": data.get("notes", ""),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "created_by_id": user["id"]
    }
    return repo.create(batch_data)


@router.get("/batches/{batch_id}")
def get_batch(batch_id: str, user: dict = Depends(get_current_user)):
    """Get a single batch"""
    from app.firestore.inventory import BatchRepository
    repo = BatchRepository(user["org_id"])
    batch = repo.get(batch_id)
    if not batch or batch.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="باچەکە نەدۆزرایەوە")
    return batch


@router.put("/batches/{batch_id}")
def update_batch(batch_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Update a batch"""
    from app.firestore.inventory import BatchRepository
    repo = BatchRepository(user["org_id"])
    batch = repo.get(batch_id)
    if not batch or batch.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="باچەکە نەدۆزرایەوە")
    
    update_data = {**data, "updated_at": datetime.utcnow().isoformat()}
    return repo.update(batch_id, update_data)


@router.delete("/batches/{batch_id}")
def delete_batch(batch_id: str, user: dict = Depends(get_current_user)):
    """Delete a batch"""
    from app.firestore.inventory import BatchRepository
    repo = BatchRepository(user["org_id"])
    batch = repo.get(batch_id)
    if not batch or batch.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="باچەکە نەدۆزرایەوە")
    
    repo.delete(batch_id)
    return {"success": True, "message": "باچ سڕایەوە"}


# ===== LANDED COSTS =====
@router.get("/landed-costs")
def list_landed_costs(
    page: int = Query(1),
    page_size: int = Query(20, le=500),
    item_id: str = None,
    bill_id: str = None,
    user: dict = Depends(get_current_user)
):
    """List all landed cost entries"""
    from app.firestore.inventory import LandedCostRepository
    repo = LandedCostRepository(user["org_id"])
    
    filters = []
    if item_id:
        filters.append({"field": "item_id", "op": "==", "value": item_id})
    if bill_id:
        filters.append({"field": "bill_id", "op": "==", "value": bill_id})
    
    items, total = repo.list(
        filters=filters,
        order_by="created_at",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/landed-costs", status_code=201)
def create_landed_cost(data: dict, user: dict = Depends(get_current_user)):
    """Create a new landed cost entry"""
    from app.firestore.inventory import LandedCostRepository
    repo = LandedCostRepository(user["org_id"])
    
    cost_id = str(uuid.uuid4())
    cost_data = {
        "id": cost_id,
        "org_id": user["org_id"],
        "item_id": data["item_id"],
        "bill_id": data.get("bill_id"),
        "cost_type": data["cost_type"],  # shipping, customs, insurance, handling, etc.
        "amount": data["amount"],
        "allocation_method": data.get("allocation_method", "quantity"),  # quantity, value, weight
        "notes": data.get("notes", ""),
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "created_by_id": user["id"]
    }
    return repo.create(cost_data)


@router.get("/landed-costs/{cost_id}")
def get_landed_cost(cost_id: str, user: dict = Depends(get_current_user)):
    """Get a single landed cost entry"""
    from app.firestore.inventory import LandedCostRepository
    repo = LandedCostRepository(user["org_id"])
    cost = repo.get(cost_id)
    if not cost or cost.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تێچووی گەیاندن نەدۆزرایەوە")
    return cost


@router.put("/landed-costs/{cost_id}")
def update_landed_cost(cost_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Update a landed cost entry"""
    from app.firestore.inventory import LandedCostRepository
    repo = LandedCostRepository(user["org_id"])
    cost = repo.get(cost_id)
    if not cost or cost.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تێچووی گەیاندن نەدۆزرایەوە")
    
    update_data = {**data, "updated_at": datetime.utcnow().isoformat()}
    return repo.update(cost_id, update_data)


@router.delete("/landed-costs/{cost_id}")
def delete_landed_cost(cost_id: str, user: dict = Depends(get_current_user)):
    """Delete a landed cost entry"""
    from app.firestore.inventory import LandedCostRepository
    repo = LandedCostRepository(user["org_id"])
    cost = repo.get(cost_id)
    if not cost or cost.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تێچووی گەیاندن نەدۆزرایەوە")
    
    repo.delete(cost_id)
    return {"success": True, "message": "تێچووی گەیاندن سڕایەوە"}


# ===== FIX-77: Allocate landed costs across received items =====
@router.post("/landed-costs/{cost_id}/allocate")
def allocate_landed_cost(cost_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Allocate a landed cost across given items by quantity, value, or weight.

    Body:
        items: [{"item_id": str, "quantity": float, "value": float, "weight": float}, ...]

    Returns per-item allocation.
    """
    from app.firestore.inventory import LandedCostRepository
    repo = LandedCostRepository(user["org_id"])
    cost = repo.get(cost_id)
    if not cost or cost.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تێچووی گەیاندن نەدۆزرایەوە")

    items = data.get("items") or []
    if not items:
        raise HTTPException(status_code=400, detail="پێویستە لیستی items پڕ بێت")

    method = cost.get("allocation_method", "quantity")
    amount = float(cost.get("amount", 0) or 0)
    key = {"quantity": "quantity", "value": "value", "weight": "weight"}.get(method, "quantity")
    total = sum(float(it.get(key, 0) or 0) for it in items)
    if total <= 0:
        raise HTTPException(status_code=400, detail=f"کۆی {key} نابێت سفر بێت")

    allocations = []
    for it in items:
        share = float(it.get(key, 0) or 0) / total
        allocations.append({
            "item_id": it.get("item_id"),
            "share": round(share, 6),
            "allocated_amount": round(amount * share, 2),
            "basis": key,
            "basis_value": float(it.get(key, 0) or 0),
        })

    repo.update(cost_id, {
        "allocations": allocations,
        "allocated_at": datetime.utcnow().isoformat(),
        "status": "allocated",
    })
    return {"cost_id": cost_id, "method": method, "total_amount": amount, "allocations": allocations}


# ===== FIX-75: Stock Moves CRUD + validate =====
@router.get("/stock-moves")
def list_stock_moves(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    item_id: str = None,
    state: str = None,
    user: dict = Depends(get_current_user),
):
    from app.firestore.inventory import StockMovementRepository
    repo = StockMovementRepository(user["org_id"])
    filters = []
    if item_id:
        filters.append({"field": "item_id", "op": "==", "value": item_id})
    if state:
        filters.append({"field": "state", "op": "==", "value": state})
    items, total = repo.list(filters=filters, order_by="date", order_dir="DESCENDING",
                             limit=page_size, offset=(page - 1) * page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/stock-moves", status_code=201)
def create_stock_move(data: dict, user: dict = Depends(get_current_user)):
    """Create a draft stock move. Validate via /stock-moves/{id}/validate."""
    from app.firestore.inventory import StockMovementRepository
    if not data.get("item_id"):
        raise HTTPException(status_code=400, detail="item_id پێویستە")
    if float(data.get("quantity", 0) or 0) <= 0:
        raise HTTPException(status_code=400, detail="quantity > 0 پێویستە")
    repo = StockMovementRepository(user["org_id"])
    move = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "item_id": data["item_id"],
        "from_location_id": data.get("from_location_id"),
        "to_location_id": data.get("to_location_id"),
        "quantity": float(data["quantity"]),
        "lot_id": data.get("lot_id"),
        "reference": data.get("reference", ""),
        "state": "draft",
        "date": data.get("date") or datetime.utcnow().isoformat()[:10],
        "created_at": datetime.utcnow().isoformat(),
        "created_by_id": user.get("id"),
    })
    return move


@router.post("/stock-moves/{move_id}/validate")
def validate_stock_move(move_id: str, user: dict = Depends(get_current_user)):
    """Validate (post) a stock move: draft -> done. Adjusts WarehouseStock if available."""
    from app.firestore.inventory import StockMovementRepository, WarehouseStockRepository
    repo = StockMovementRepository(user["org_id"])
    move = repo.get(move_id)
    if not move or move.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="جووڵە نەدۆزرایەوە")
    if move.get("state") == "done":
        return {"id": move_id, "state": "done", "message": "Already validated"}
    if move.get("state") == "cancelled":
        raise HTTPException(status_code=400, detail="ناتوانرێت جووڵەی هەڵوەشاوە پەسەند بکرێت")

    qty = float(move.get("quantity", 0) or 0)
    item_id = move.get("item_id")
    from_loc = move.get("from_location_id")
    to_loc = move.get("to_location_id")
    try:
        ws_repo = WarehouseStockRepository(user["org_id"])
        if from_loc:
            stocks, _ = ws_repo.list(filters=[
                {"field": "warehouse_id", "op": "==", "value": from_loc},
                {"field": "item_id", "op": "==", "value": item_id},
            ], limit=1)
            if stocks:
                cur = float(stocks[0].get("quantity", 0) or 0)
                if cur < qty:
                    raise HTTPException(status_code=400, detail=f"کاڵای پێویست نییە (بەردەست: {cur})")
                ws_repo.update(stocks[0]["id"], {"quantity": cur - qty})
        if to_loc:
            stocks, _ = ws_repo.list(filters=[
                {"field": "warehouse_id", "op": "==", "value": to_loc},
                {"field": "item_id", "op": "==", "value": item_id},
            ], limit=1)
            if stocks:
                cur = float(stocks[0].get("quantity", 0) or 0)
                ws_repo.update(stocks[0]["id"], {"quantity": cur + qty})
            else:
                ws_repo.create({
                    "id": str(uuid.uuid4()),
                    "org_id": user["org_id"],
                    "warehouse_id": to_loc,
                    "item_id": item_id,
                    "quantity": qty,
                })
    except HTTPException:
        raise
    except Exception:
        # Stock-table integration optional; still mark done
        pass

    return repo.update(move_id, {
        "state": "done",
        "validated_at": datetime.utcnow().isoformat(),
        "validated_by": user.get("id"),
    })


@router.post("/stock-moves/{move_id}/cancel")
def cancel_stock_move(move_id: str, user: dict = Depends(get_current_user)):
    from app.firestore.inventory import StockMovementRepository
    repo = StockMovementRepository(user["org_id"])
    move = repo.get(move_id)
    if not move or move.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="جووڵە نەدۆزرایەوە")
    if move.get("state") == "done":
        raise HTTPException(status_code=400, detail="ناتوانرێت جووڵەی پەسەندکراو هەڵبوەشێنرێت")
    return repo.update(move_id, {"state": "cancelled", "cancelled_at": datetime.utcnow().isoformat()})


# ===== FIX-76: Lot Traceability =====
@router.get("/lots/{lot_id}/traceability")
def lot_traceability(lot_id: str, user: dict = Depends(get_current_user)):
    """Return chronological history of moves for a lot/batch (in/out)."""
    from app.firestore.inventory import BatchRepository, StockMovementRepository
    batch = BatchRepository(user["org_id"]).get(lot_id)
    if not batch or batch.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="باچەکە نەدۆزرایەوە")

    moves_repo = StockMovementRepository(user["org_id"])
    moves, _ = moves_repo.list(filters=[
        {"field": "lot_id", "op": "==", "value": lot_id},
    ], limit=2000)

    rows = []
    for m in moves:
        qty = float(m.get("quantity", 0) or 0)
        direction = "in" if m.get("to_location_id") and not m.get("from_location_id") else (
            "out" if m.get("from_location_id") and not m.get("to_location_id") else "transfer"
        )
        rows.append({
            "move_id": m.get("id"),
            "date": str(m.get("date") or m.get("created_at") or ""),
            "direction": direction,
            "quantity": qty,
            "from_location_id": m.get("from_location_id"),
            "to_location_id": m.get("to_location_id"),
            "state": m.get("state"),
            "reference": m.get("reference"),
        })
    rows.sort(key=lambda r: r["date"])

    total_in = sum(r["quantity"] for r in rows if r["direction"] == "in" and r["state"] == "done")
    total_out = sum(r["quantity"] for r in rows if r["direction"] == "out" and r["state"] == "done")
    return {
        "lot_id": lot_id,
        "batch_number": batch.get("batch_number"),
        "item_id": batch.get("item_id"),
        "expiry_date": batch.get("expiry_date"),
        "total_in": total_in,
        "total_out": total_out,
        "current_balance": round(total_in - total_out, 3),
        "moves": rows,
    }



# ------------------------ Sprint 14: Picking + Stock Valuation Summary (FIX-171..175) ------------------------

@router.get("/valuation/summary")
def inventory_valuation_summary(user: dict = Depends(get_current_user)):
    """FIX-171: Total inventory value across all items (used in dashboard + balance sheet check)."""
    items, _ = ItemRepository(user["org_id"]).list(limit=5000)
    total_value = 0.0
    total_qty = 0.0
    by_category: dict = {}
    for it in items:
        qty = float(it.get("stock_on_hand") or 0)
        cost = float(it.get("cost_price") or 0)
        val = qty * cost
        total_value += val
        total_qty += qty
        cat = it.get("category") or it.get("category_id") or "uncategorized"
        if cat not in by_category:
            by_category[cat] = {"items": 0, "qty": 0.0, "value": 0.0}
        by_category[cat]["items"] += 1
        by_category[cat]["qty"] += qty
        by_category[cat]["value"] += val
    return {
        "total_items": len(items),
        "total_qty": round(total_qty, 3),
        "total_value": round(total_value, 2),
        "by_category": [{"category": k, **{kk: round(vv, 3) if isinstance(vv, float) else vv for kk, vv in v.items()}} for k, v in by_category.items()],
    }


@router.post("/pickings", status_code=201)
def create_picking(data: dict, user: dict = Depends(get_current_user)):
    """FIX-172: Create a picking (delivery prep) for a sales order or transfer."""
    from app.firestore.inventory import StockMovementRepository
    org = user["org_id"]
    repo = StockMovementRepository(org)
    payload = {
        "type": "picking",
        "status": "draft",
        "source_type": data.get("source_type"),  # sales_order | transfer | manual
        "source_id": data.get("source_id"),
        "warehouse_id": data.get("warehouse_id"),
        "scheduled_date": data.get("scheduled_date"),
        "lines": data.get("lines") or [],
        "notes": data.get("notes"),
        "created_by_id": user["id"],
        "created_by_name": user.get("name") or user.get("email", ""),
    }
    return repo.create(payload)


@router.post("/pickings/{picking_id}/confirm")
def confirm_picking(picking_id: str, user: dict = Depends(get_current_user)):
    """FIX-173: Confirm picking (draft ? confirmed, ready to be picked)."""
    from app.firestore.inventory import StockMovementRepository
    repo = StockMovementRepository(user["org_id"])
    pk = repo.get(picking_id)
    if not pk or pk.get("type") != "picking":
        raise HTTPException(404, "picking not found")
    if pk.get("status") != "draft":
        raise HTTPException(400, "????? ??????? draft ????????? ??????? ?????")
    return repo.update(picking_id, {"status": "confirmed", "confirmed_at": datetime.utcnow().isoformat()})


@router.post("/pickings/{picking_id}/done")
def done_picking(picking_id: str, user: dict = Depends(get_current_user)):
    """FIX-174: Mark picking as done � decrements warehouse stock per line."""
    from app.firestore.inventory import StockMovementRepository, WarehouseStockRepository
    org = user["org_id"]
    repo = StockMovementRepository(org)
    pk = repo.get(picking_id)
    if not pk or pk.get("type") != "picking":
        raise HTTPException(404, "picking not found")
    if pk.get("status") not in ("confirmed", "draft"):
        raise HTTPException(400, "???????? ??????? ????????/????????? ????? ?????")
    ws_repo = WarehouseStockRepository(org)
    warehouse_id = pk.get("warehouse_id")
    for line in pk.get("lines") or []:
        item_id = line.get("item_id")
        qty = float(line.get("qty") or 0)
        if not item_id or qty <= 0:
            continue
        existing, _ = ws_repo.list(filters=[
            {"field": "item_id", "op": "==", "value": item_id},
            {"field": "warehouse_id", "op": "==", "value": warehouse_id},
        ], limit=1)
        if existing:
            ws = existing[0]
            ws_repo.update(ws["id"], {"qty": float(ws.get("qty") or 0) - qty})
        else:
            ws_repo.create({"item_id": item_id, "warehouse_id": warehouse_id, "qty": -qty})
    return repo.update(picking_id, {"status": "done", "done_at": datetime.utcnow().isoformat()})


@router.post("/pickings/{picking_id}/cancel")
def cancel_picking(picking_id: str, user: dict = Depends(get_current_user)):
    """FIX-175: Cancel a non-done picking."""
    from app.firestore.inventory import StockMovementRepository
    repo = StockMovementRepository(user["org_id"])
    pk = repo.get(picking_id)
    if not pk or pk.get("type") != "picking":
        raise HTTPException(404, "picking not found")
    if pk.get("status") == "done":
        raise HTTPException(400, "???????? ??????? ???????? ??????????????")
    return repo.update(picking_id, {"status": "cancelled", "cancelled_at": datetime.utcnow().isoformat()})


@router.get("/pickings")
def list_pickings(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    """FIX-176: List pickings, filterable by status."""
    from app.firestore.inventory import StockMovementRepository
    repo = StockMovementRepository(user["org_id"])
    filters = [{"field": "type", "op": "==", "value": "picking"}]
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters, limit=500, order_by="created_at", order_dir="DESCENDING")
    return {"items": items, "total": total}
