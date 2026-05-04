import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.firestore.bills import PurchaseOrderRepository, BillRepository
from app.firestore.system import SequenceRepository
from app.firestore.organizations import OrganizationRepository
from app.services.auth import get_current_user
from app.services.pdf_generator import generate_purchase_order_pdf
from app.services import approval_service, settings_service
from app.schemas.schemas import PurchaseOrderCreate, PurchaseOrderResponse

router = APIRouter(prefix="/api/purchase-orders", tags=["Purchase Orders"])

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
    
    return repo.update(purchase_order_id, {
        "status": "sent",
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
def receive_purchase_order(purchase_order_id: str, user: dict = Depends(get_current_user)):
    repo = PurchaseOrderRepository(user["org_id"])
    po = _po_load(repo, purchase_order_id, user["org_id"])
    if po.get("status") not in ("sent", "partially_received", "draft"):
        raise HTTPException(status_code=400, detail=f"دۆخی پێویست: sent (دۆخی ئێستا: {po.get('status')})")
    return repo.update(purchase_order_id, {
        "status": "received",
        "received_at": datetime.utcnow().isoformat(),
        "received_by": user.get("id"),
    })


@router.post("/{purchase_order_id}/cancel")
def cancel_purchase_order(purchase_order_id: str, data: dict = None, user: dict = Depends(get_current_user)):
    repo = PurchaseOrderRepository(user["org_id"])
    po = _po_load(repo, purchase_order_id, user["org_id"])
    if po.get("status") in ("billed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"ناتوانرێت دۆخی '{po.get('status')}' هەڵبوەشێنرێت")
    return repo.update(purchase_order_id, {
        "status": "cancelled",
        "cancelled_at": datetime.utcnow().isoformat(),
        "cancelled_by": user.get("id"),
        "cancellation_reason": (data or {}).get("reason", ""),
    })


@router.post("/{purchase_order_id}/convert-to-bill", status_code=201)
def purchase_order_to_bill(purchase_order_id: str, user: dict = Depends(get_current_user)):
    repo = PurchaseOrderRepository(user["org_id"])
    po = _po_load(repo, purchase_order_id, user["org_id"])
    if po.get("status") in ("cancelled", "billed"):
        raise HTTPException(status_code=400, detail=f"ناتوانرێت دۆخی '{po.get('status')}' بکرێتە پسووڵە")

    po_full = repo.get_with_lines(purchase_order_id) if hasattr(repo, "get_with_lines") else po
    bill_repo = BillRepository(user["org_id"])
    seq_repo = SequenceRepository(user["org_id"])
    bill_number = seq_repo.get_next("bill")
    total = float(po.get("total", 0) or 0)
    today = datetime.utcnow().isoformat()[:10]

    bill = bill_repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "bill_number": bill_number,
        "contact_id": po.get("contact_id"),
        "date": today,
        "due_date": today,
        "currency_code": po.get("currency_code") or po.get("currency", "IQD"),
        "subtotal": po.get("subtotal", 0),
        "tax_amount": po.get("tax_amount", 0),
        "total": total,
        "balance_due": total,
        "status": "draft",
        "purchase_order_id": purchase_order_id,
        "notes": po.get("notes", ""),
    })
    lines = (po_full or {}).get("lines") or []
    if lines:
        bill_repo.set_lines(bill["id"], [{k: v for k, v in ln.items() if k != "id"} for ln in lines])

    repo.update(purchase_order_id, {"status": "billed", "bill_id": bill["id"]})
    return {"id": bill["id"], "bill_number": bill_number, "purchase_order_id": purchase_order_id}


# ------------------------ Sprint 16: Goods Receipt + 3-Way Match (FIX-211..220) ------------------------

@router.post("/{purchase_order_id}/receipts", status_code=201)
def create_goods_receipt(purchase_order_id: str, data: dict, user: dict = Depends(get_current_user)):
    """FIX-211: Record a Goods Receipt Note (GRN) against a PO with received quantities per line.

    Body: { warehouse_id, lines: [{ po_line_id, item_id, qty_received, lot_no?, notes? }] }
    Updates PO status: draft/sent ? partially_received or received based on cumulative qty.
    """
    repo = PurchaseOrderRepository(user["org_id"])
    po = _po_load(repo, purchase_order_id, user["org_id"])
    if po.get("status") in ("cancelled", "billed"):
        raise HTTPException(400, f"???????? ?????? ?? ???? '{po.get('status')}' ????? ?????")
    lines = data.get("lines") or []
    if not lines:
        raise HTTPException(400, "??? ???? ?????? ????")
    grn_id = str(uuid.uuid4())
    grn = {
        "id": grn_id,
        "purchase_order_id": purchase_order_id,
        "warehouse_id": data.get("warehouse_id"),
        "lines": lines,
        "status": "received",
        "received_at": datetime.utcnow().isoformat(),
        "received_by_id": user["id"],
        "received_by_name": user.get("name") or user.get("email", ""),
        "notes": data.get("notes"),
        "org_id": user["org_id"],
    }
    # Persist as a PO sub-record (use a dedicated repo or inline list on PO)
    grns = po.get("goods_receipts") or []
    grns.append(grn)
    # Aggregate received qty per po_line_id
    received_by_line: dict = {}
    for g in grns:
        for ln in g.get("lines") or []:
            k = ln.get("po_line_id") or ln.get("item_id")
            if k:
                received_by_line[k] = received_by_line.get(k, 0.0) + float(ln.get("qty_received") or 0)
    # Compute cumulative ratio vs ordered
    ordered_lines = po.get("lines") or []
    ordered_total = sum(float(l.get("qty") or l.get("quantity") or 0) for l in ordered_lines)
    received_total = sum(received_by_line.values())
    new_status = po.get("status")
    if ordered_total > 0:
        if received_total >= ordered_total:
            new_status = "received"
        elif received_total > 0:
            new_status = "partially_received"
    repo.update(purchase_order_id, {
        "goods_receipts": grns,
        "received_qty_by_line": received_by_line,
        "status": new_status,
    })
    return grn


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
    if po.get("status") not in ("draft", None, ""):
        raise HTTPException(status_code=400, detail=f"تەنها پسووڵەی draft دەتوانرێت دەربچێت (دۆخی ئێستا: {po.get('status')})")
    return repo.update(purchase_order_id, {
        "status": "sent",
        "issued_at": datetime.utcnow().isoformat(),
        "issued_by": user.get("id"),
    })

