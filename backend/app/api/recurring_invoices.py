import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.invoices import RecurringInvoiceRepository
from app.firestore.system import SequenceRepository
from app.services.auth import get_current_user
from app.schemas.schemas import RecurringInvoiceCreate, RecurringInvoiceResponse

router = APIRouter(prefix="/api/recurring-invoices", tags=["Recurring Invoices"])

@router.get("")
def list_recurring_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    status: str = Query("", max_length=20),
    user: dict = Depends(get_current_user),
):
    repo = RecurringInvoiceRepository(user["org_id"])
    filters = [{"field": "status", "op": "==", "value": status}] if status else []
    items, total = repo.list(filters=filters, order_by="date", order_dir="DESCENDING", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": (total+page_size-1)//page_size}

@router.post("", status_code=201)
def create_recurring_invoice(data: RecurringInvoiceCreate, user: dict = Depends(get_current_user)):
    seq_repo = SequenceRepository(user["org_id"])
    number = seq_repo.get_next("recurring_invoice")
    repo = RecurringInvoiceRepository(user["org_id"])
    item = repo.create({"id": str(uuid.uuid4()), "name": number, **data.model_dump(exclude={"lines"})} )
    if hasattr(data, "lines") and data.lines:
        repo.set_lines(item["id"], [line.model_dump() for line in data.lines])
    return item

# FIX-110: was @router.get("/{{recurring_invoice_id}}") — double-brace bug
@router.get("/{recurring_invoice_id}")
def get_recurring_invoice(recurring_invoice_id: str, user: dict = Depends(get_current_user)):
    repo = RecurringInvoiceRepository(user["org_id"])
    item = repo.get(recurring_invoice_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="وەسڵی دووبارە نەدۆزرایەوە")
    return item
