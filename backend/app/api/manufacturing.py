"""Manufacturing API: BOM, Work Centers, Manufacturing Orders, Work Orders."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.firestore.manufacturing import (
    BOMRepository,
    ManufacturingOrderRepository,
    WorkCenterRepository,
    WorkOrderRepository,
)
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services import settings_service
from app.services.module_gate import require_module

router = APIRouter(
    prefix="/api/manufacturing",
    tags=["Manufacturing"],
    dependencies=[Depends(require_module("manufacturing"))],
)


# ---------- Schemas ----------
class BOMComponent(BaseModel):
    item_id: str
    item_name: Optional[str] = None
    quantity: float = 1
    unit: Optional[str] = None


class BOMCreate(BaseModel):
    product_id: str
    product_name: Optional[str] = None
    code: Optional[str] = None
    quantity: float = 1
    components: list[BOMComponent] = []
    byproducts: list[BOMComponent] = []  # FIX-71: optional secondary outputs (e.g. scrap)
    routing: list[str] = []  # work_center_ids
    status: str = "active"
    notes: Optional[str] = None


class WorkCenterCreate(BaseModel):
    name: str
    code: Optional[str] = None
    capacity_per_hour: float = 0
    cost_per_hour: float = 0
    active: bool = True


class MOCreate(BaseModel):
    bom_id: str
    quantity: float = 1
    scheduled_date: Optional[str] = None
    notes: Optional[str] = None


# ---------- BOM ----------
@router.get("/boms", dependencies=[Depends(require_perm("manufacturing.read"))])
def list_boms(product_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    filters = [{"field": "product_id", "op": "==", "value": product_id}] if product_id else None
    items, total = BOMRepository(user["org_id"]).list(filters=filters, limit=500)
    return {"items": items, "total": total}


@router.post("/boms", dependencies=[Depends(require_perm("manufacturing.write"))])
def create_bom(payload: BOMCreate, user: dict = Depends(get_current_user)):
    return BOMRepository(user["org_id"]).create(payload.model_dump())


@router.get("/boms/{bid}", dependencies=[Depends(require_perm("manufacturing.read"))])
def get_bom(bid: str, user: dict = Depends(get_current_user)):
    bom = BOMRepository(user["org_id"]).get(bid)
    if not bom or bom.get("org_id") != user["org_id"]:
        raise HTTPException(404, "bom not found")
    return bom


@router.put("/boms/{bid}", dependencies=[Depends(require_perm("manufacturing.write"))])
def update_bom(bid: str, payload: BOMCreate, user: dict = Depends(get_current_user)):
    return BOMRepository(user["org_id"]).update(bid, payload.model_dump())


@router.delete("/boms/{bid}", dependencies=[Depends(require_perm("manufacturing.delete"))])
def delete_bom(bid: str, user: dict = Depends(get_current_user)):
    BOMRepository(user["org_id"]).delete(bid)
    return {"success": True}


# ---------- Work Centers ----------
@router.get("/work-centers", dependencies=[Depends(require_perm("manufacturing.read"))])
def list_wc(user: dict = Depends(get_current_user)):
    items, total = WorkCenterRepository(user["org_id"]).list(limit=200)
    return {"items": items, "total": total}


@router.post("/work-centers", dependencies=[Depends(require_perm("manufacturing.write"))])
def create_wc(payload: WorkCenterCreate, user: dict = Depends(get_current_user)):
    return WorkCenterRepository(user["org_id"]).create(payload.model_dump())


@router.put("/work-centers/{wcid}", dependencies=[Depends(require_perm("manufacturing.write"))])
def update_wc(wcid: str, payload: WorkCenterCreate, user: dict = Depends(get_current_user)):
    return WorkCenterRepository(user["org_id"]).update(wcid, payload.model_dump())


@router.delete("/work-centers/{wcid}", dependencies=[Depends(require_perm("manufacturing.delete"))])
def delete_wc(wcid: str, user: dict = Depends(get_current_user)):
    WorkCenterRepository(user["org_id"]).delete(wcid)
    return {"success": True}


# ---------- Manufacturing Orders ----------
def _generate_mo_number(repo: ManufacturingOrderRepository) -> str:
    items, _ = repo.list(limit=1, order_by="created_at", order_dir="DESCENDING")
    seq = 1
    if items:
        last = items[0].get("number") or "MO-0000"
        try:
            seq = int(last.rsplit("-", 1)[-1]) + 1
        except Exception:
            seq = 1
    return f"MO-{seq:04d}"


@router.get("/orders", dependencies=[Depends(require_perm("manufacturing.read"))])
def list_orders(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    repo = ManufacturingOrderRepository(user["org_id"])
    filters = [{"field": "status", "op": "==", "value": status}] if status else None
    items, total = repo.list(filters=filters, limit=500, order_by="created_at", order_dir="DESCENDING")
    return {"items": items, "total": total}


@router.post("/orders", dependencies=[Depends(require_perm("manufacturing.write"))])
def create_order(payload: MOCreate, user: dict = Depends(get_current_user)):
    # Apply MRP config defaults
    try:
        cfg = settings_service.get_bag(user["org_id"], "mrp")
    except Exception:
        cfg = {}
    
    org = user["org_id"]
    bom_repo = BOMRepository(org)
    bom = bom_repo.get(payload.bom_id)
    if not bom:
        raise HTTPException(404, "bom not found")

    mo_repo = ManufacturingOrderRepository(org)
    number = _generate_mo_number(mo_repo)
    qty_factor = payload.quantity / max(float(bom.get("quantity") or 1), 1)
    components = []
    for c in (bom.get("components") or []):
        c2 = dict(c)
        c2["required_qty"] = round(float(c.get("quantity") or 0) * qty_factor, 3)
        components.append(c2)
    
    routing = bom.get("routing") or []
    if not routing and cfg.get("default_routing"):
        routing = [cfg.get("default_routing")]

    mo = mo_repo.create({
        "number": number,
        "bom_id": payload.bom_id,
        "product_id": bom.get("product_id"),
        "product_name": bom.get("product_name"),
        "quantity": payload.quantity,
        "components": components,
        "routing": routing,
        "status": "draft",
        "scheduled_date": payload.scheduled_date,
        "notes": payload.notes,
        "created_at": datetime.utcnow().isoformat(),
        "produced_qty": 0,
        "auto_create_work_orders": cfg.get("auto_create_work_orders", True),
    })

    # Auto-create work orders from routing
    wc_repo = WorkCenterRepository(org)
    wo_repo = WorkOrderRepository(org)
    for idx, wc_id in enumerate(bom.get("routing") or []):
        wc = wc_repo.get(wc_id) or {}
        wo_repo.create({
            "mo_id": mo["id"],
            "mo_number": number,
            "sequence": idx + 1,
            "work_center_id": wc_id,
            "work_center_name": wc.get("name"),
            "status": "pending",
            "started_at": None,
            "finished_at": None,
            "duration_minutes": 0,
        })
    return mo


@router.get("/orders/{mo_id}", dependencies=[Depends(require_perm("manufacturing.read"))])
def get_order(mo_id: str, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    mo = ManufacturingOrderRepository(org).get(mo_id)
    if not mo:
        raise HTTPException(404, "mo not found")
    wos, _ = WorkOrderRepository(org).list(filters=[{"field": "mo_id", "op": "==", "value": mo_id}], limit=200, order_by="sequence", order_dir="ASCENDING")
    return {**mo, "work_orders": wos}


@router.post("/orders/{mo_id}/confirm", dependencies=[Depends(require_perm("manufacturing.write"))])
def confirm_order(mo_id: str, user: dict = Depends(get_current_user)):
    return ManufacturingOrderRepository(user["org_id"]).update(mo_id, {
        "status": "confirmed",
        "confirmed_at": datetime.utcnow().isoformat(),
    })


@router.post("/orders/{mo_id}/done", dependencies=[Depends(require_perm("manufacturing.write"))])
def done_order(
    mo_id: str,
    produced_qty: Optional[float] = None,
    warehouse_id: Optional[str] = Query(None, description="Warehouse for component consumption / finished goods"),
    user: dict = Depends(get_current_user),
):
    org = user["org_id"]
    mo_repo = ManufacturingOrderRepository(org)
    mo = mo_repo.get(mo_id)
    if not mo:
        raise HTTPException(404, "mo not found")
    planned = float(mo.get("quantity", 0) or 0)
    qty = float(produced_qty if produced_qty is not None else planned)
    if qty < 0:
        raise HTTPException(400, "produced_qty must be >= 0")

    backorder_payload = None
    shortfall = round(planned - qty, 3)
    if shortfall > 0:
        bo_number = _generate_mo_number(mo_repo)
        bo_id = str(uuid.uuid4())
        backorder_payload = {
            "id": bo_id,
            "org_id": org,
            "number": bo_number,
            "bom_id": mo.get("bom_id"),
            "product_id": mo.get("product_id"),
            "product_name": mo.get("product_name"),
            "quantity": shortfall,
            "components": mo.get("components") or [],
            "routing": mo.get("routing") or [],
            "status": "draft",
            "backorder_of": mo_id,
            "created_at": datetime.utcnow().isoformat(),
            "produced_qty": 0,
        }

    from app.services.mo_complete_atomic import complete_manufacturing_order_atomic

    try:
        result = complete_manufacturing_order_atomic(
            org,
            mo_id,
            produced_qty=qty,
            warehouse_id=warehouse_id,
            backorder_payload=backorder_payload,
        )
    except ValueError as exc:
        msg = str(exc)
        if msg == "mo_already_done":
            raise HTTPException(400, "MO already done") from exc
        if msg.startswith("insufficient_stock"):
            raise HTTPException(400, detail="کاڵای پێویست نییە بۆ تەواوکردنی MO") from exc
        raise HTTPException(400, detail=msg) from exc
    return result


@router.delete("/orders/{mo_id}", dependencies=[Depends(require_perm("manufacturing.delete"))])
def delete_order(mo_id: str, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    wos, _ = WorkOrderRepository(org).list(filters=[{"field": "mo_id", "op": "==", "value": mo_id}], limit=200)
    for w in wos:
        WorkOrderRepository(org).delete(w["id"])
    ManufacturingOrderRepository(org).delete(mo_id)
    return {"success": True}


# ---------- Work Orders ----------
@router.get("/work-orders", dependencies=[Depends(require_perm("manufacturing.read"))])
def list_work_orders(mo_id: Optional[str] = None, status: Optional[str] = None,
                     user: dict = Depends(get_current_user)):
    repo = WorkOrderRepository(user["org_id"])
    filters = []
    if mo_id:
        filters.append(("mo_id", "==", mo_id))
    if status:
        filters.append(("status", "==", status))
    items, total = repo.list(filters=filters or None, limit=500)
    return {"items": items, "total": total}


@router.post("/work-orders/{wo_id}/start", dependencies=[Depends(require_perm("manufacturing.write"))])
def start_wo(wo_id: str, user: dict = Depends(get_current_user)):
    return WorkOrderRepository(user["org_id"]).update(wo_id, {
        "status": "in_progress",
        "started_at": datetime.utcnow().isoformat(),
    })


@router.post("/work-orders/{wo_id}/finish", dependencies=[Depends(require_perm("manufacturing.write"))])
def finish_wo(wo_id: str, user: dict = Depends(get_current_user)):
    repo = WorkOrderRepository(user["org_id"])
    wo = repo.get(wo_id)
    if not wo:
        raise HTTPException(404, "work order not found")
    started = wo.get("started_at")
    duration = 0
    if started:
        try:
            d = (datetime.utcnow() - datetime.fromisoformat(started)).total_seconds() / 60
            duration = round(d, 1)
        except Exception:
            pass
    return repo.update(wo_id, {
        "status": "done",
        "finished_at": datetime.utcnow().isoformat(),
        "duration_minutes": duration,
    })


# ---------- Dashboard ----------
@router.get("/dashboard", dependencies=[Depends(require_perm("manufacturing.read"))])
def mfg_dashboard(user: dict = Depends(get_current_user)):
    org = user["org_id"]
    boms, _ = BOMRepository(org).list(limit=500)
    mos, _ = ManufacturingOrderRepository(org).list(limit=1000)
    wos, _ = WorkOrderRepository(org).list(limit=2000)
    return {
        "bom_count": len(boms),
        "mo_total": len(mos),
        "mo_draft": len([m for m in mos if m.get("status") == "draft"]),
        "mo_confirmed": len([m for m in mos if m.get("status") == "confirmed"]),
        "mo_done": len([m for m in mos if m.get("status") == "done"]),
        "wo_pending": len([w for w in wos if w.get("status") == "pending"]),
        "wo_in_progress": len([w for w in wos if w.get("status") == "in_progress"]),
    }


# ---------------- Sprint 26: MRP Scheduler + Quality Checks (FIX-401..420) ----------------

@router.get("/mrp/suggestions", dependencies=[Depends(require_perm("manufacturing.read"))])
def mrp_suggestions(user: dict = Depends(get_current_user)):
    """Suggest MOs to plan based on items with stock < reorder_level (and which have a BOM)."""
    from app.firestore.items import ItemRepository
    items_repo = ItemRepository(user["org_id"])
    bom_repo = BOMRepository(user["org_id"])
    items, _ = items_repo.list(limit=2000)
    boms, _ = bom_repo.list(limit=2000)
    bom_by_product = {}
    for b in boms:
        pid = b.get("product_id") or b.get("item_id")
        if pid:
            bom_by_product.setdefault(pid, b)
    suggestions = []
    for it in items:
        on_hand = float(it.get("stock_on_hand") or it.get("quantity") or 0)
        reorder = float(it.get("reorder_level") or 0)
        if reorder <= 0 or on_hand >= reorder:
            continue
        bom = bom_by_product.get(it["id"])
        if not bom:
            continue
        shortfall = reorder - on_hand
        suggestions.append({
            "item_id": it["id"], "item_name": it.get("name"),
            "on_hand": on_hand, "reorder_level": reorder,
            "suggested_qty": shortfall, "bom_id": bom["id"],
        })
    return {"suggestions": suggestions, "total": len(suggestions)}


@router.post("/mrp/run", dependencies=[Depends(require_perm("manufacturing.write"))])
def mrp_run(user: dict = Depends(get_current_user)):
    """Materialize MRP suggestions into draft MOs."""
    sugg = mrp_suggestions(user=user)
    mo_repo = MORepository(user["org_id"])
    created: list = []
    for s in sugg["suggestions"]:
        mo = mo_repo.create({
            "product_id": s["item_id"],
            "bom_id": s["bom_id"],
            "quantity": s["suggested_qty"],
            "status": "draft",
            "source": "mrp_auto",
        })
        created.append(mo["id"])
    return {"created_mos": created, "count": len(created)}


@router.get("/quality/checks", dependencies=[Depends(require_perm("manufacturing.read"))])
def list_quality_checks(mo_id: str = None, status: str = None,
                         user: dict = Depends(get_current_user)):
    from app.firestore.base import BaseRepository as _BR
    class _QC(_BR):
        collection_name = "quality_checks"
    repo = _QC(user["org_id"])
    filters = []
    if mo_id:
        filters.append({"field": "mo_id", "op": "==", "value": mo_id})
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters or None, limit=500)
    return {"items": items, "total": total}


@router.post("/quality/checks", dependencies=[Depends(require_perm("manufacturing.write"))])
def create_quality_check(data: dict, user: dict = Depends(get_current_user)):
    from app.firestore.base import BaseRepository as _BR
    class _QC(_BR):
        collection_name = "quality_checks"
    payload = {
        "mo_id": data.get("mo_id"),
        "wo_id": data.get("wo_id"),
        "check_name": data.get("check_name"),
        "check_type": data.get("check_type", "pass_fail"),
        "expected_value": data.get("expected_value"),
        "actual_value": data.get("actual_value"),
        "status": "pending",
        "notes": data.get("notes", ""),
    }
    return _QC(user["org_id"]).create(payload)


@router.post("/quality/checks/{check_id}/pass",
             dependencies=[Depends(require_perm("manufacturing.write"))])
def pass_quality_check(check_id: str, data: dict = None,
                       user: dict = Depends(get_current_user)):
    from datetime import datetime as _dt
    from app.firestore.base import BaseRepository as _BR
    class _QC(_BR):
        collection_name = "quality_checks"
    repo = _QC(user["org_id"])
    item = repo.get(check_id)
    if not item:
        raise HTTPException(404, "quality check not found")
    return repo.update(check_id, {
        "status": "pass",
        "actual_value": (data or {}).get("actual_value", item.get("actual_value")),
        "checked_at": _dt.utcnow().isoformat(),
        "checked_by": user["id"],
    })


@router.post("/quality/checks/{check_id}/fail",
             dependencies=[Depends(require_perm("manufacturing.write"))])
def fail_quality_check(check_id: str, data: dict = None,
                       user: dict = Depends(get_current_user)):
    from datetime import datetime as _dt
    from app.firestore.base import BaseRepository as _BR
    class _QC(_BR):
        collection_name = "quality_checks"
    repo = _QC(user["org_id"])
    item = repo.get(check_id)
    if not item:
        raise HTTPException(404, "quality check not found")
    return repo.update(check_id, {
        "status": "fail",
        "fail_reason": (data or {}).get("reason", ""),
        "actual_value": (data or {}).get("actual_value", item.get("actual_value")),
        "checked_at": _dt.utcnow().isoformat(),
        "checked_by": user["id"],
    })
