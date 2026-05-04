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


def _ri_load(repo, recurring_invoice_id: str, org_id: str):
    item = repo.get(recurring_invoice_id)
    if not item or item.get("org_id") != org_id:
        raise HTTPException(status_code=404, detail="وەسڵی دووبارە نەدۆزرایەوە")
    return item


@router.post("/{recurring_invoice_id}/pause")
def pause_recurring_invoice(recurring_invoice_id: str, user: dict = Depends(get_current_user)):
    """Pause a recurring invoice schedule."""
    from datetime import datetime as _dt
    repo = RecurringInvoiceRepository(user["org_id"])
    _ri_load(repo, recurring_invoice_id, user["org_id"])
    return repo.update(recurring_invoice_id, {
        "status": "paused",
        "paused_at": _dt.utcnow().isoformat(),
        "paused_by": user.get("id"),
    })


@router.post("/{recurring_invoice_id}/resume")
def resume_recurring_invoice(recurring_invoice_id: str, user: dict = Depends(get_current_user)):
    """Resume a paused recurring invoice."""
    from datetime import datetime as _dt
    repo = RecurringInvoiceRepository(user["org_id"])
    _ri_load(repo, recurring_invoice_id, user["org_id"])
    return repo.update(recurring_invoice_id, {
        "status": "active",
        "resumed_at": _dt.utcnow().isoformat(),
        "resumed_by": user.get("id"),
    })


@router.post("/{recurring_invoice_id}/generate-invoice", status_code=201)
def generate_invoice_from_recurring(recurring_invoice_id: str, user: dict = Depends(get_current_user)):
    """Generate a real invoice from a recurring template (one occurrence)."""
    from datetime import datetime as _dt
    from app.firestore.invoices import InvoiceRepository
    from app.services.numbering_service import get_next_number
    
    repo = RecurringInvoiceRepository(user["org_id"])
    template = _ri_load(repo, recurring_invoice_id, user["org_id"])
    
    inv_repo = InvoiceRepository(user["org_id"])
    branch_id = template.get("branch_id") or user.get("default_branch_id")
    invoice_number = get_next_number(user["org_id"], branch_id, "invoice", "INV")
    today = _dt.utcnow().date().isoformat()
    
    new_invoice = {
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_number,
        "contact_id": template.get("contact_id"),
        "date": today,
        "due_date": today,
        "currency_code": template.get("currency_code", "IQD"),
        "exchange_rate": template.get("exchange_rate", 1.0),
        "subtotal": template.get("subtotal", 0),
        "tax_total": template.get("tax_total", 0),
        "total": template.get("total", 0),
        "balance_due": template.get("total", 0),
        "status": "draft",
        "recurring_template_id": recurring_invoice_id,
        "created_by_id": user["id"],
    }
    invoice = inv_repo.create(new_invoice)
    
    repo.update(recurring_invoice_id, {
        "last_generated_at": _dt.utcnow().isoformat(),
        "invoices_generated": (template.get("invoices_generated", 0) + 1),
    })
    
    return invoice
