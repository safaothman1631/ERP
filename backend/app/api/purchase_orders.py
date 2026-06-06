import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.firestore.bills import PurchaseOrderRepository, BillRepository
from app.firestore.organizations import OrganizationRepository
from app.services.auth import get_current_user
from app.services.pdf_generator import generate_purchase_order_pdf
from app.services import approval_service, settings_service
from app.services.state_machine import PURCHASE_ORDER_SM
from app.services.module_gate import require_module
from app.schemas.schemas import PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse
from app.services.versioned_update import apply_versioned_update

router = APIRouter(
    prefix="/api/purchase-orders",
    tags=["Purchase Orders"],
    dependencies=[Depends(require_module("purchase"))],
)

@router.get("")
def list_purchase_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    status: str = Query("", max_length=20),
    user: dict = Depends(get_current_user),
):
    repo = PurchaseOrderRepository(user["org_id"])
    filters = [{"field": "status", "op": "==", "value": status}] if status else []
    items, total = repo.list(filters=filters, order_by="date", order_dir="DESCENDING", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": (total+page_size-1)//page_size}

@router.post("", status_code=201)
def create_purchase_order(data: PurchaseOrderCreate, user: dict = Depends(get_current_user)):
    from app.services.numbering_service import get_next_number
    
    # Apply purchases config defaults
    try:
        cfg = settings_service.get_bag(user["org_id"], "purchases")
    except Exception:
        cfg = {}
    
    # Get branch_id from request or user default
    branch_id = getattr(data, 'branch_id', None) or user.get('default_branch_id')
    
    # Generate order number if not provided
    auto_numbered = False
    if hasattr(data, 'order_number') and data.order_number:
        number = data.order_number
    else:
        number = get_next_number(user["org_id"], branch_id, "purchase_order", "PO")
        auto_numbered = True
    
    # Build payload with config defaults
    payload = data.model_dump(exclude={"lines"})
    if not payload.get("payment_terms"):
        payload["payment_terms"] = cfg.get("default_payment_terms", "Net 30")
    payload.setdefault("three_way_match_required", cfg.get("three_way_match", False))
    
    repo = PurchaseOrderRepository(user["org_id"])
    item = repo.create({"id": str(uuid.uuid4()), "order_number": number, "auto_numbered": auto_numbered, "approval_status": "not_required", **payload} )
    if hasattr(data, "lines") and data.lines:
        repo.set_lines(item["id"], [line.model_dump() for line in data.lines])
    return item


@router.put("/{purchase_order_id}")
def update_purchase_order(
    purchase_order_id: str,
    data: PurchaseOrderUpdate,
    user: dict = Depends(get_current_user),
    if_match: Optional[str] = Header(None, alias="If-Match"),
):
    repo = PurchaseOrderRepository(user["org_id"])
    po = repo.get(purchase_order_id)
    if not po or po.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="داواکاری کڕین نەدۆزرایەوە")
    if po.get("status") not in ("draft",):
        raise HTTPException(status_code=400, detail="تەنیا ڕەشنووس دەتوانرێت دەستکاری بکرێت")
    update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
    po = apply_versioned_update(repo, purchase_order_id, update_data, if_match=if_match)
    if data.lines is not None:
        repo.set_lines(purchase_order_id, [line.model_dump() for line in data.lines])
        po = repo.get(purchase_order_id)
    return po


@router.get("/{purchase_order_id}")
def get_purchase_order(purchase_order_id: str, user: dict = Depends(get_current_user)):
    repo = PurchaseOrderRepository(user["org_id"])
    item = repo.get(purchase_order_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="داواکاری کڕین نەدۆزرایەوە")
    return item


@router.get("/{purchase_order_id}/pdf")
def download_purchase_order_pdf(
    purchase_order_id: str,
    lang: str = Query("en", pattern="^(en|ku)$"),
    user: dict = Depends(get_current_user)
):
    """Generate and download purchase order as PDF
    
    Query Parameters:
        - lang: Language code ('en' or 'ku'). Default: 'en'
    """
    repo = PurchaseOrderRepository(user["org_id"])
    po = repo.get(purchase_order_id)
    if not po or po.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="داواکاری کڕین نەدۆزرایەوە")
    
    # Get organization data
    org_repo = OrganizationRepository()
    org = org_repo.get(user["org_id"])
    if not org:
        raise HTTPException(status_code=500, detail="زانیاری ڕێکخراو نەدۆزرایەوە")
    
    # Generate PDF
    try:
        pdf_buffer = generate_purchase_order_pdf(user["org_id"], purchase_order_id, org, lang=lang)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"هەڵە لە دروستکردنی PDF: {str(e)}")
    
    # Return as downloadable file
    filename = f"purchase_order_{po.get('order_number', purchase_order_id)}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ============================================================
# FIX-96/97/98/99: Purchase Order State Machine
# draft -> sent -> received -> billed
# any (except billed) -> cancelled
# ============================================================
def _po_load(repo: PurchaseOrderRepository, po_id: str, org_id: str) -> dict:
    po = repo.get(po_id)
    if not po or po.get("org_id") != org_id:
        raise HTTPException(status_code=404, detail="داواکاری کڕین نەدۆزرایەوە")
    return po


@router.post("/{purchase_order_id}/send")
def send_purchase_order(purchase_order_id: str, user: dict = Depends(get_current_user)):
    repo = PurchaseOrderRepository(user["org_id"])
    po = _po_load(repo, purchase_order_id, user["org_id"])
    if po.get("status") not in (None, "", "draft"):
        raise HTTPException(status_code=400, detail=f"تەنیا دۆخی draft دەنێردرێت (دۆخی ئێستا: {po.get('status')})")

    # Check if approval workflow is satisfied
    if not approval_service.is_doc_approved(user["org_id"], "purchase_order", purchase_order_id):
        raise HTTPException(400, "Approval workflow not completed")

    PURCHASE_ORDER_SM.transition(po, "sent")
    return repo.update(purchase_order_id, {
        "status": po["status"],
        "sent_at": datetime.utcnow().isoformat(),
    })


@router.post("/{purchase_order_id}/submit-for-approval")
def submit_purchase_order_for_approval(purchase_order_id: str, user: dict = Depends(get_current_user)):
    """Submit purchase order for approval workflow"""
    repo = PurchaseOrderRepository(user["org_id"])
    po = _po_load(repo, purchase_order_id, user["org_id"])
    
    # Create approval request if rule matches
    approval_request = approval_service.create_approval_request(
        org_id=user["org_id"],
        doc_type="purchase_order",
        doc_id=purchase_order_id,
        doc=po,
        requested_by=user["id"]
    )
    
    if approval_request:
        repo.update(purchase_order_id, {"approval_status": "pending"})
        return {"approval_request": approval_request, "purchase_order": po}
    else:
        repo.update(purchase_order_id, {"approval_status": "not_required"})
        return {"message": "No approval required", "purchase_order": po}


@router.post("/{purchase_order_id}/receive")
def receive_purchase_order(
    purchase_order_id: str,
    body: dict | None = None,
    user: dict = Depends(get_current_user),
):
    from app.services.permissions import user_has_perm

    repo = PurchaseOrderRepository(user["org_id"])
    po = _po_load(repo, purchase_order_id, user["org_id"])
    from app.services.settings_service import get_purchases_settings

    payload = body or {}
    receipts = po.get("goods_receipts") or []
    has_grn = bool(receipts) or any(
        float(line.get("qty_received", 0) or 0) > 0
        for line in (po.get("lines") or [])
    )
    require_grn = bool(get_purchases_settings(user["org_id"]).get("require_grn", True))
    if require_grn and not has_grn:
        if not payload.get("acknowledge_shortcut"):
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "grn_required",
                    "message": "Post a goods receipt before marking received, or send acknowledge_shortcut with purchase.receive_shortcut permission.",
                },
            )
        if not user_has_perm(user, "purchase.receive_shortcut"):
            raise HTTPException(
                status_code=403,
                detail={"code": "receive_shortcut_denied", "message": "Missing purchase.receive_shortcut permission"},
            )
    PURCHASE_ORDER_SM.transition(po, "received")
    from app.services.po_receive import mark_po_received_atomic

    try:
        updated = mark_po_received_atomic(
            user["org_id"],
            purchase_order_id,
            status=po["status"],
            received_by=user.get("id"),
        )
    except Exception as exc:
        raise HTTPException(status_code=409, detail={"code": "receive_failed", "message": str(exc)}) from exc
    try:
        from app.services.webhook_dispatcher import dispatch_event
        dispatch_event(user["org_id"], "po.received", {"id": purchase_order_id})
    except Exception:
        pass
    return updated


@router.post("/{purchase_order_id}/cancel")
def cancel_purchase_order(purchase_order_id: str, data: dict = None, user: dict = Depends(get_current_user)):
    repo = PurchaseOrderRepository(user["org_id"])
    po = _po_load(repo, purchase_order_id, user["org_id"])
    PURCHASE_ORDER_SM.transition(po, "cancelled")
    return repo.update(purchase_order_id, {
        "status": po["status"],
        "cancelled_at": datetime.utcnow().isoformat(),
        "cancelled_by": user.get("id"),
        "cancellation_reason": (data or {}).get("reason", ""),
    })


@router.post("/{purchase_order_id}/convert-to-bill", status_code=201)
def purchase_order_to_bill(purchase_order_id: str, user: dict = Depends(get_current_user)):
    from app.services.po_convert_bill_atomic import convert_purchase_order_to_bill_atomic

    repo = PurchaseOrderRepository(user["org_id"])
    po = _po_load(repo, purchase_order_id, user["org_id"])
    PURCHASE_ORDER_SM.transition(po, "billed")
    try:
        return convert_purchase_order_to_bill_atomic(
            user["org_id"],
            purchase_order_id,
            status=po["status"],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=409,
            detail={"code": "po_convert_failed", "message": str(exc)},
        ) from exc


# ------------------------ Sprint 16: Goods Receipt + 3-Way Match (FIX-211..220) ------------------------

@router.post("/{purchase_order_id}/receipts", status_code=201)
def create_goods_receipt(purchase_order_id: str, data: dict, user: dict = Depends(get_current_user)):
    """FIX-211: Record a Goods Receipt Note (GRN) against a PO with received quantities per line.

    Body: { warehouse_id, lines: [{ po_line_id, item_id, qty_received, lot_no?, notes? }] }
    Updates PO status: draft/sent ? partially_received or received based on cumulative qty.
    """
    from app.services.grn_receive_atomic import create_goods_receipt_atomic

    po = _po_load(PurchaseOrderRepository(user["org_id"]), purchase_order_id, user["org_id"]) or {}
    lines = data.get("lines") or []
    if not lines:
        raise HTTPException(400, "??? ???? ?????? ????")
    try:
        received = create_goods_receipt_atomic(
            user["org_id"],
            purchase_order_id,
            warehouse_id=data.get("warehouse_id"),
            lines=lines,
            user_id=user["id"],
            user_name=user.get("name") or user.get("email", ""),
            notes=data.get("notes"),
        )
    except ValueError as exc:
        if str(exc).startswith("po_invalid_status:"):
            status = str(exc).split(":", 1)[1]
            raise HTTPException(400, f"???????? ?????? ?? ???? '{status}' ????? ?????")
        raise HTTPException(400, str(exc))
    except Exception as exc:
        raise HTTPException(status_code=409, detail={"code": "grn_receive_failed", "message": str(exc)}) from exc
    if received.get("purchase_order_status") == "received":
        try:
            from app.services.webhook_dispatcher import dispatch_event
            dispatch_event(user["org_id"], "po.received", {"id": purchase_order_id})
        except Exception:
            pass
    # Pool 3.4: perpetual valuation — add a cost layer per received line at the PO
    # unit cost (fallback item.cost_price). Flag-gated + post-commit (record_receipt
    # is its own transaction). Off => no effect / standard-cost behavior preserved.
    try:
        from app.config import settings
        if getattr(settings, "PERPETUAL_VALUATION_ENABLED", False):
            from app.firestore.items import ItemRepository
            from app.services import valuation as V
            from app.services import valuation_service

            cost_by_poline: dict[str, float] = {}
            cost_by_item: dict[str, float] = {}
            for pl in (po.get("lines") or []):
                c = float(pl.get("unit_price") or pl.get("rate") or pl.get("price")
                          or pl.get("cost") or 0)
                if pl.get("id"):
                    cost_by_poline[pl["id"]] = c
                if pl.get("item_id"):
                    cost_by_item[pl["item_id"]] = c
            item_repo = ItemRepository(user["org_id"])
            icache: dict[str, dict] = {}
            grn_id = received["grn"].get("id")
            for gl in (received["grn"].get("lines") or []):
                item_id = gl.get("item_id")
                qty = float(gl.get("qty_received") or gl.get("qty") or 0)
                if not item_id or qty <= 0:
                    continue
                item = icache.get(item_id)
                if item is None:
                    item = item_repo.get(item_id) or {}
                    icache[item_id] = item
                if item.get("track_inventory") is False:
                    continue
                unit_cost = (cost_by_poline.get(gl.get("po_line_id"))
                             or cost_by_item.get(item_id)
                             or float(item.get("cost_price") or 0))
                if unit_cost <= 0:
                    continue
                valuation_service.record_receipt(
                    user["org_id"], item_id, qty, unit_cost,
                    method=item.get("valuation_method") or V.AVERAGE,
                    source_type="grn", source_id=grn_id,
                )
    except Exception as _exc:
        import logging
        logging.getLogger(__name__).warning("perpetual valuation receive skipped: %s", _exc)
    return received["grn"]


@router.get("/{purchase_order_id}/receipts")
def list_goods_receipts(purchase_order_id: str, user: dict = Depends(get_current_user)):
    """FIX-212: List all GRNs for a PO."""
    repo = PurchaseOrderRepository(user["org_id"])
    po = _po_load(repo, purchase_order_id, user["org_id"])
    grns = po.get("goods_receipts") or []
    return {"items": grns, "total": len(grns)}


@router.get("/{purchase_order_id}/three-way-match")
def three_way_match(purchase_order_id: str, user: dict = Depends(get_current_user)):
    """FIX-213: Compare ordered (PO) vs received (GRN) vs billed (Bill) quantities.

    Returns per-line discrepancies. Status = 'matched' iff ordered == received == billed.
    """
    repo = PurchaseOrderRepository(user["org_id"])
    po = _po_load(repo, purchase_order_id, user["org_id"])
    ordered_lines = po.get("lines") or []
    received_map = po.get("received_qty_by_line") or {}
    # Find related Bills (linked via purchase_order_id)
    bill_repo = BillRepository(user["org_id"])
    bills, _ = bill_repo.list(filters=[
        {"field": "purchase_order_id", "op": "==", "value": purchase_order_id},
    ], limit=200)
    billed_map: dict = {}
    bill_total = 0.0
    for b in bills:
        if b.get("status") == "cancelled":
            continue
        bill_total += float(b.get("total") or 0)
        for ln in b.get("lines") or []:
            k = ln.get("po_line_id") or ln.get("item_id")
            if k:
                billed_map[k] = billed_map.get(k, 0.0) + float(ln.get("qty") or ln.get("quantity") or 0)
    rows = []
    fully_matched = True
    for ol in ordered_lines:
        k = ol.get("id") or ol.get("item_id")
        ordered_qty = float(ol.get("qty") or ol.get("quantity") or 0)
        received_qty = float(received_map.get(k, 0))
        billed_qty = float(billed_map.get(k, 0))
        match = (ordered_qty == received_qty == billed_qty)
        if not match:
            fully_matched = False
        rows.append({
            "po_line_id": k,
            "item_id": ol.get("item_id"),
            "item_name": ol.get("item_name") or ol.get("description"),
            "ordered_qty": ordered_qty,
            "received_qty": received_qty,
            "billed_qty": billed_qty,
            "diff_received": round(ordered_qty - received_qty, 3),
            "diff_billed": round(ordered_qty - billed_qty, 3),
            "matched": match,
        })
    return {
        "purchase_order_id": purchase_order_id,
        "po_total": float(po.get("total") or 0),
        "bills_total": round(bill_total, 2),
        "bills_count": len(bills),
        "fully_matched": fully_matched,
        "lines": rows,
    }


@router.post("/{purchase_order_id}/issue")
def issue_purchase_order(purchase_order_id: str, user: dict = Depends(get_current_user)):
    """Issue a draft PO: status draft -> sent."""
    repo = PurchaseOrderRepository(user["org_id"])
    po = _po_load(repo, purchase_order_id, user["org_id"])
    PURCHASE_ORDER_SM.transition(po, "sent")
    return repo.update(purchase_order_id, {
        "status": po["status"],
        "issued_at": datetime.utcnow().isoformat(),
        "issued_by": user.get("id"),
    })

