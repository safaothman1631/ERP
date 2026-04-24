import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.invoices import SalesOrderRepository, InvoiceRepository
from app.firestore.system import SequenceRepository
from app.services.auth import get_current_user
from app.schemas.schemas import SalesOrderCreate, SalesOrderResponse

router = APIRouter(prefix="/api/sales-orders", tags=["Sales Orders"])

@router.get("")
def list_sales_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    status: str = Query("", max_length=20),
    user: dict = Depends(get_current_user),
):
    repo = SalesOrderRepository(user["org_id"])
    filters = [{"field": "status", "op": "==", "value": status}] if status else []
    items, total = repo.list(filters=filters, order_by="date", order_dir="DESCENDING", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": (total+page_size-1)//page_size}

@router.post("", status_code=201)
def create_sales_order(data: SalesOrderCreate, user: dict = Depends(get_current_user)):
    seq_repo = SequenceRepository(user["org_id"])
    number = seq_repo.get_next("sales_order")
    repo = SalesOrderRepository(user["org_id"])
    item = repo.create({"id": str(uuid.uuid4()), "order_number": number, "status": "draft", **data.model_dump(exclude={"lines"})} )
    if hasattr(data, "lines") and data.lines:
        repo.set_lines(item["id"], [line.model_dump() for line in data.lines])
    return item

# FIX-91: was @router.get("/{{sales_order_id}}") — double-brace bug made route literal
@router.get("/{sales_order_id}")
def get_sales_order(sales_order_id: str, user: dict = Depends(get_current_user)):
    repo = SalesOrderRepository(user["org_id"])
    item = repo.get(sales_order_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="داواکاری فرۆشتن نەدۆزرایەوە")
    return item


# ============================================================
# FIX-92/93/94/95: Sales Order State Machine
# draft -> confirmed -> fulfilled -> invoiced
# any -> cancelled (terminal)
# ============================================================
def _so_load(repo: SalesOrderRepository, so_id: str, org_id: str) -> dict:
    so = repo.get(so_id)
    if not so or so.get("org_id") != org_id:
        raise HTTPException(status_code=404, detail="داواکاری فرۆشتن نەدۆزرایەوە")
    return so


@router.post("/{sales_order_id}/confirm")
def confirm_sales_order(sales_order_id: str, user: dict = Depends(get_current_user)):
    repo = SalesOrderRepository(user["org_id"])
    so = _so_load(repo, sales_order_id, user["org_id"])
    if so.get("status") != "draft":
        raise HTTPException(status_code=400, detail=f"تەنیا دۆخی draft پەسەند دەکرێت (دۆخی ئێستا: {so.get('status')})")
    return repo.update(sales_order_id, {
        "status": "confirmed",
        "confirmed_at": datetime.utcnow().isoformat(),
        "confirmed_by": user.get("id"),
    })


@router.post("/{sales_order_id}/fulfill")
def fulfill_sales_order(sales_order_id: str, user: dict = Depends(get_current_user)):
    repo = SalesOrderRepository(user["org_id"])
    so = _so_load(repo, sales_order_id, user["org_id"])
    if so.get("status") not in ("confirmed", "partially_fulfilled"):
        raise HTTPException(status_code=400, detail=f"دۆخی پێویست: confirmed (دۆخی ئێستا: {so.get('status')})")
    return repo.update(sales_order_id, {
        "status": "fulfilled",
        "fulfilled_at": datetime.utcnow().isoformat(),
        "fulfilled_by": user.get("id"),
    })


@router.post("/{sales_order_id}/cancel")
def cancel_sales_order(sales_order_id: str, data: dict = None, user: dict = Depends(get_current_user)):
    repo = SalesOrderRepository(user["org_id"])
    so = _so_load(repo, sales_order_id, user["org_id"])
    if so.get("status") in ("invoiced", "cancelled"):
        raise HTTPException(status_code=400, detail=f"ناتوانرێت دۆخی '{so.get('status')}' هەڵبوەشێنرێت")
    return repo.update(sales_order_id, {
        "status": "cancelled",
        "cancelled_at": datetime.utcnow().isoformat(),
        "cancelled_by": user.get("id"),
        "cancellation_reason": (data or {}).get("reason", ""),
    })


@router.post("/{sales_order_id}/convert-to-invoice", status_code=201)
def sales_order_to_invoice(sales_order_id: str, user: dict = Depends(get_current_user)):
    repo = SalesOrderRepository(user["org_id"])
    so = _so_load(repo, sales_order_id, user["org_id"])
    if so.get("status") in ("cancelled", "invoiced"):
        raise HTTPException(status_code=400, detail=f"ناتوانرێت دۆخی '{so.get('status')}' بکرێتە فاکتوور")

    so_with_lines = repo.get_with_lines(sales_order_id)
    inv_repo = InvoiceRepository(user["org_id"])
    seq_repo = SequenceRepository(user["org_id"])
    inv_number = seq_repo.get_next("invoice")
    total = float(so.get("total", 0) or 0)
    today = datetime.utcnow().isoformat()[:10]

    inv = inv_repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "invoice_number": inv_number,
        "contact_id": so.get("contact_id"),
        "date": today,
        "due_date": today,
        "currency": so.get("currency", "IQD"),
        "subtotal": so.get("subtotal", 0),
        "tax_amount": so.get("tax_amount", 0),
        "total": total,
        "balance_due": total,
        "status": "draft",
        "sales_order_id": sales_order_id,
        "notes": so.get("notes", ""),
    })
    lines = (so_with_lines or {}).get("lines") or []
    if lines:
        inv_repo.set_lines(inv["id"], [{k: v for k, v in ln.items() if k != "id"} for ln in lines])

    repo.update(sales_order_id, {"status": "invoiced", "invoice_id": inv["id"]})
    return {"id": inv["id"], "invoice_number": inv_number, "sales_order_id": sales_order_id}
