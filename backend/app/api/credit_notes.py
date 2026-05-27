import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.firestore.invoices import CreditNoteRepository, InvoiceRepository
from app.firestore.system import SequenceRepository
from app.firestore.organizations import OrganizationRepository
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
from app.services.pdf_generator import generate_credit_note_pdf
from app.services.module_gate import require_module
from app.schemas.schemas import CreditNoteCreate, CreditNoteResponse

router = APIRouter(
    prefix="/api/credit-notes",
    tags=["Credit Notes"],
    dependencies=[Depends(require_module("sales"))],
)

class CreditNoteApplicationRepository(BaseRepository):
    collection_name = "credit_note_applications"

@router.get("")
def list_credit_notes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    status: str = Query("", max_length=20),
    user: dict = Depends(get_current_user),
):
    repo = CreditNoteRepository(user["org_id"])
    filters = [{"field": "status", "op": "==", "value": status}] if status else []
    items, total = repo.list(filters=filters, order_by="date", order_dir="DESCENDING", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": (total+page_size-1)//page_size}

@router.post("", status_code=201)
def create_credit_note(data: CreditNoteCreate, user: dict = Depends(get_current_user)):
    from app.services.numbering_service import get_next_number
    
    # Get branch_id from request or user default
    branch_id = getattr(data, 'branch_id', None) or user.get('default_branch_id')
    
    # Generate credit note number if not provided
    auto_numbered = False
    if hasattr(data, 'credit_note_number') and data.credit_note_number:
        number = data.credit_note_number
    else:
        number = get_next_number(user["org_id"], branch_id, "credit_note", "CN")
        auto_numbered = True
    
    repo = CreditNoteRepository(user["org_id"])
    item = repo.create({"id": str(uuid.uuid4()), "credit_note_number": number, "auto_numbered": auto_numbered, **data.model_dump(exclude={"lines"})} )
    if hasattr(data, "lines") and data.lines:
        repo.set_lines(item["id"], [line.model_dump() for line in data.lines])
    return item

@router.get("/{credit_note_id}")
def get_credit_note(credit_note_id: str, user: dict = Depends(get_current_user)):
    repo = CreditNoteRepository(user["org_id"])
    item = repo.get(credit_note_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تێبینی قەرز نەدۆزرایەوە")
    return item

@router.put("/{credit_note_id}")
def update_credit_note(credit_note_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = CreditNoteRepository(user["org_id"])
    item = repo.get(credit_note_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تێبینی قەرز نەدۆزرایەوە")
    updated = repo.update(credit_note_id, data)
    return updated

@router.delete("/{credit_note_id}")
def delete_credit_note(credit_note_id: str, user: dict = Depends(get_current_user)):
    repo = CreditNoteRepository(user["org_id"])
    item = repo.get(credit_note_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تێبینی قەرز نەدۆزرایەوە")
    repo.update(credit_note_id, {"status": "void"})
    return {"message": "تێبینی قەرز باتڵکرا"}

@router.get("/{credit_note_id}/available-invoices")
def get_available_invoices(credit_note_id: str, user: dict = Depends(get_current_user)):
    cn_repo = CreditNoteRepository(user["org_id"])
    credit_note = cn_repo.get(credit_note_id)
    if not credit_note or credit_note.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تێبینی قەرز نەدۆزرایەوە")
    
    contact_id = credit_note.get("contact_id")
    if not contact_id:
        return {"items": [], "total": 0}
    
    inv_repo = InvoiceRepository(user["org_id"])
    filters = [
        {"field": "contact_id", "op": "==", "value": contact_id},
        {"field": "status", "op": "in", "value": ["sent", "partially_paid", "overdue"]}
    ]
    invoices, total = inv_repo.list(filters=filters, order_by="date", order_dir="DESCENDING")
    return {"items": invoices, "total": total}

@router.post("/{credit_note_id}/apply")
def apply_credit_note(credit_note_id: str, data: dict, user: dict = Depends(get_current_user)):
    cn_repo = CreditNoteRepository(user["org_id"])
    credit_note = cn_repo.get(credit_note_id)
    if not credit_note or credit_note.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تێبینی قەرز نەدۆزرایەوە")
    
    invoice_id = data.get("invoice_id")
    amount = float(data.get("amount", 0))
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="بڕ دەبێت زیاتر لە سفر بێت")
    
    balance_remaining = float(credit_note.get("balance_remaining", credit_note.get("total", 0)))
    if amount > balance_remaining:
        raise HTTPException(status_code=400, detail="بڕ زیاترە لە باڵانسی ماوە")
    
    # Get invoice
    inv_repo = InvoiceRepository(user["org_id"])
    invoice = inv_repo.get(invoice_id)
    if not invoice or invoice.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پسوڵە نەدۆزرایەوە")
    
    invoice_balance = float(invoice.get("balance_due", invoice.get("total", 0)))
    if amount > invoice_balance:
        raise HTTPException(status_code=400, detail="بڕ زیاترە لە باڵانسی پسوڵە")
    
    # Create application
    app_repo = CreditNoteApplicationRepository(user["org_id"])
    application = {
        "id": str(uuid.uuid4()),
        "credit_note_id": credit_note_id,
        "invoice_id": invoice_id,
        "amount": amount,
        "org_id": user["org_id"],
        "created_at": str(uuid.uuid4())
    }
    app_repo.create(application)
    
    # Update credit note balance
    new_cn_balance = balance_remaining - amount
    cn_repo.update(credit_note_id, {"balance_remaining": new_cn_balance})
    
    # Update invoice balance
    new_inv_balance = invoice_balance - amount
    inv_status = "paid" if new_inv_balance == 0 else "partially_paid"
    inv_repo.update(invoice_id, {"balance_due": new_inv_balance, "status": inv_status})
    
    return {"message": "قەرز جێبەجێکرا", "application_id": application["id"]}

@router.delete("/applications/{application_id}")
def remove_credit_application(application_id: str, user: dict = Depends(get_current_user)):
    app_repo = CreditNoteApplicationRepository(user["org_id"])
    application = app_repo.get(application_id)
    if not application or application.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="جێبەجێکردن نەدۆزرایەوە")
    
    amount = float(application.get("amount", 0))
    credit_note_id = application.get("credit_note_id")
    invoice_id = application.get("invoice_id")
    
    # Restore credit note balance
    cn_repo = CreditNoteRepository(user["org_id"])
    credit_note = cn_repo.get(credit_note_id)
    if credit_note:
        balance = float(credit_note.get("balance_remaining", 0))
        cn_repo.update(credit_note_id, {"balance_remaining": balance + amount})
    
    # Restore invoice balance
    inv_repo = InvoiceRepository(user["org_id"])
    invoice = inv_repo.get(invoice_id)
    if invoice:
        balance = float(invoice.get("balance_due", 0))
        new_balance = balance + amount
        inv_repo.update(invoice_id, {"balance_due": new_balance, "status": "sent"})
    
    # Delete application
    app_repo.delete(application_id)
    return {"message": "جێبەجێکردن سڕایەوە"}

@router.get("/{credit_note_id}/pdf")
def download_credit_note_pdf(
    credit_note_id: str,
    lang: str = Query("en", pattern="^(en|ku)$"),
    user: dict = Depends(get_current_user)
):
    """Generate and download credit note as PDF
    
    Query Parameters:
        - lang: Language code ('en' or 'ku'). Default: 'en'
    """
    repo = CreditNoteRepository(user["org_id"])
    credit_note = repo.get(credit_note_id)
    if not credit_note or credit_note.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تێبینی قەرز نەدۆزرایەوە")
    
    # Get organization data
    org_repo = OrganizationRepository()
    org = org_repo.get(user["org_id"])
    if not org:
        raise HTTPException(status_code=500, detail="زانیاری ڕێکخراو نەدۆزرایەوە")
    
    # Generate PDF
    try:
        pdf_buffer = generate_credit_note_pdf(user["org_id"], credit_note_id, org, lang=lang)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"هەڵە لە دروستکردنی PDF: {str(e)}")
    
    # Return as downloadable file
    filename = f"credit_note_{credit_note.get('credit_note_number', credit_note_id)}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/contacts/{contact_id}/credit-balance")
def get_contact_credit_balance(contact_id: str, user: dict = Depends(get_current_user)):
    repo = CreditNoteRepository(user["org_id"])
    filters = [
        {"field": "contact_id", "op": "==", "value": contact_id},
        {"field": "status", "op": "==", "value": "open"}
    ]
    credit_notes, total = repo.list(filters=filters)
    
    total_credit = sum(float(cn.get("balance_remaining", 0)) for cn in credit_notes)
    return {"contact_id": contact_id, "total_credit": total_credit, "credit_notes_count": total}


@router.post("/{credit_note_id}/approve")
def approve_credit_note(credit_note_id: str, user: dict = Depends(get_current_user)):
    """Approve a draft credit note: status draft -> open."""
    from datetime import datetime as _dt
    repo = CreditNoteRepository(user["org_id"])
    cn = repo.get(credit_note_id)
    if not cn or cn.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تێبینی قەرز نەدۆزرایەوە")
    if cn.get("status") not in ("draft", None, ""):
        raise HTTPException(status_code=400, detail=f"تەنها draft دەستوور دەدرێت (دۆخی ئێستا: {cn.get('status')})")
    return repo.update(credit_note_id, {
        "status": "open",
        "approved_at": _dt.utcnow().isoformat(),
        "approved_by": user.get("id"),
    })

