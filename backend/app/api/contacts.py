import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.contacts import ContactRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.schemas.schemas import ContactCreate, ContactUpdate, ContactResponse

router = APIRouter(prefix="/api/contacts", tags=["Contacts"])


@router.get("")
def list_contacts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    search: str = Query("", max_length=200),
    contact_type: str = Query("", max_length=20),
    user: dict = Depends(get_current_user),
):
    repo = ContactRepository(user["org_id"])
    
    # Include contacts where is_active is True OR not set (None/missing)
    filters = [{"field": "is_active", "op": "!=", "value": False}]
    if contact_type:
        filters.append({"field": "contact_type", "op": "==", "value": contact_type})
    
    # For search, we'll do client-side filtering due to Firestore limitations
    # In production, consider using Algolia or similar for full-text search
    items, total = repo.list(
        filters=filters,
        order_by="display_name",
        order_dir="ASCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    
    # Client-side text filtering
    if search:
        search_lower = search.lower()
        items = [
            c for c in items
            if search_lower in (c.get("display_name", "") or "").lower()
            or search_lower in (c.get("email", "") or "").lower()
            or search_lower in (c.get("phone", "") or "").lower()
            or search_lower in (c.get("company_name", "") or "").lower()
        ]
        total = len(items)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("", status_code=201, dependencies=[Depends(require_perm("contacts.create"))])
def create_contact(
    data: ContactCreate,
    user: dict = Depends(get_current_user),
):
    repo = ContactRepository(user["org_id"])
    contact = repo.create({
        "id": str(uuid.uuid4()),
        **data.model_dump(),
    })
    return contact


@router.get("/{contact_id}")
def get_contact(
    contact_id: str,
    user: dict = Depends(get_current_user),
):
    repo = ContactRepository(user["org_id"])
    contact = repo.get(contact_id)
    if not contact or contact.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پەیوەندی نەدۆزرایەوە")
    return contact


@router.put("/{contact_id}", dependencies=[Depends(require_perm("contacts.update"))])
def update_contact(
    contact_id: str,
    data: ContactUpdate,
    user: dict = Depends(get_current_user),
):
    repo = ContactRepository(user["org_id"])
    contact = repo.get(contact_id)
    if not contact or contact.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پەیوەندی نەدۆزرایەوە")
    
    update_data = data.model_dump(exclude_unset=True)
    contact = repo.update(contact_id, update_data)
    return contact


@router.delete("/{contact_id}", dependencies=[Depends(require_perm("contacts.delete"))])
def delete_contact(
    contact_id: str,
    user: dict = Depends(get_current_user),
):
    repo = ContactRepository(user["org_id"])
    contact = repo.get(contact_id)
    if not contact or contact.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پەیوەندی نەدۆزرایەوە")
    
    repo.update(contact_id, {"is_active": False})
    return {"message": "پەیوەندی سڕایەوە", "success": True}


# ===== CUSTOMER/VENDOR STATEMENTS =====

@router.get("/{contact_id}/statement")
def get_statement(contact_id: str, 
                  start_date: str = None, end_date: str = None,
                  user: dict = Depends(get_current_user)):
    """Get customer/vendor statement"""
    from app.firestore.invoices import InvoiceRepository, CreditNoteRepository
    from app.firestore.bills import BillRepository, VendorCreditRepository
    from app.firestore.payments import PaymentReceivedRepository, PaymentMadeRepository
    
    org_id = user["org_id"]
    contact_repo = ContactRepository(org_id)
    contact = contact_repo.get(contact_id)
    if not contact: raise HTTPException(404, "Contact not found")
    
    entries = []
    
    # Get invoices for customer
    inv_repo = InvoiceRepository(org_id)
    invoices, _ = inv_repo.list(
        filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
        order_by="date", order_dir="ASCENDING", limit=500
    )
    for inv in invoices:
        entries.append({
            "date": inv.get("date"),
            "type": "invoice",
            "number": inv.get("invoice_number"),
            "debit": float(inv.get("total", 0)),
            "credit": 0,
            "balance": 0,
            "status": inv.get("status"),
        })
    
    # Get payments received
    pay_repo = PaymentReceivedRepository(org_id)
    payments, _ = pay_repo.list(
        filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
        order_by="date", order_dir="ASCENDING", limit=500
    )
    for pay in payments:
        entries.append({
            "date": pay.get("date"),
            "type": "payment",
            "number": pay.get("payment_number", ""),
            "debit": 0,
            "credit": float(pay.get("amount", 0)),
            "balance": 0,
            "status": pay.get("status"),
        })
    
    # Get credit notes
    cn_repo = CreditNoteRepository(org_id)
    cns, _ = cn_repo.list(
        filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
        order_by="date", order_dir="ASCENDING", limit=500
    )
    for cn in cns:
        entries.append({
            "date": cn.get("date"),
            "type": "credit_note",
            "number": cn.get("credit_note_number", ""),
            "debit": 0,
            "credit": float(cn.get("total", 0)),
            "balance": 0,
        })
    
    # Sort by date and calculate running balance
    entries.sort(key=lambda x: str(x.get("date", "")))
    running_balance = 0
    for entry in entries:
        running_balance += entry["debit"] - entry["credit"]
        entry["balance"] = running_balance
    
    return {
        "contact": {"id": contact_id, "name": contact.get("display_name")},
        "entries": entries,
        "total_debit": sum(e["debit"] for e in entries),
        "total_credit": sum(e["credit"] for e in entries),
        "balance": running_balance,
    }
