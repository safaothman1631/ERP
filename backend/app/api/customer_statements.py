import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.firestore.invoices import InvoiceRepository
from app.firestore.contacts import ContactRepository
from app.firestore.journals import JournalEntryRepository
from app.firestore.organizations import OrganizationRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services.email_service import send_email
from app.services.pdf_generator import generate_customer_statement_pdf

router = APIRouter(prefix="/api/customer-statements", tags=["Customer Statements"])


class BulkEmailRequest(BaseModel):
    contact_ids: list[str]
    date_from: Optional[str] = None
    date_to: Optional[str] = None


def _parse_date(date_str: str | datetime) -> datetime:
    """Parse date string or datetime to datetime"""
    if isinstance(date_str, datetime):
        return date_str
    try:
        return datetime.fromisoformat(date_str.replace(" ", "T").rstrip("Z"))
    except:
        return datetime.utcnow()


@router.get("/{contact_id}")
def get_customer_statement(
    contact_id: str,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """Get customer statement: opening balance + transactions + closing balance"""
    contact_repo = ContactRepository(user["org_id"])
    contact = contact_repo.get(contact_id)
    if not contact or contact.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="کڕیار نەدۆزرایەوە")
    
    # Get all invoices, payments, credit notes for this contact
    invoice_repo = InvoiceRepository(user["org_id"])
    all_invoices, _ = invoice_repo.list(limit=5000)
    
    # Filter by contact and date range
    transactions = []
    opening_balance = 0.0
    
    for inv in all_invoices:
        if inv.get("contact_id") != contact_id:
            continue
        
        inv_date = _parse_date(inv.get("invoice_date", datetime.utcnow()))
        
        # If date range specified, filter
        if date_from:
            from_dt = _parse_date(date_from)
            if inv_date < from_dt:
                # Count towards opening balance
                if inv.get("status") != "paid" and inv.get("status") != "void":
                    opening_balance += inv.get("total", 0)
                continue
        
        if date_to:
            to_dt = _parse_date(date_to)
            if inv_date > to_dt:
                continue
        
        # Include in statement
        transactions.append({
            "date": inv_date.date().isoformat(),
            "type": "invoice",
            "reference": inv.get("invoice_number", ""),
            "description": f"فاکتوور {inv.get('invoice_number', '')}",
            "debit": inv.get("total", 0),
            "credit": 0.0,
            "balance": 0.0,  # will calculate below
        })
        
        # If invoice is paid, add payment transaction
        if inv.get("status") == "paid":
            transactions.append({
                "date": inv_date.date().isoformat(),
                "type": "payment",
                "reference": inv.get("invoice_number", ""),
                "description": f"وەرگرتنی پارە - {inv.get('invoice_number', '')}",
                "debit": 0.0,
                "credit": inv.get("total", 0),
                "balance": 0.0,
            })
    
    # Sort by date
    transactions.sort(key=lambda x: x["date"])
    
    # Calculate running balance
    running_balance = opening_balance
    for txn in transactions:
        running_balance += txn["debit"] - txn["credit"]
        txn["balance"] = running_balance
    
    closing_balance = running_balance
    
    return {
        "contact_id": contact_id,
        "contact_name": contact.get("display_name", ""),
        "date_from": date_from,
        "date_to": date_to,
        "opening_balance": opening_balance,
        "closing_balance": closing_balance,
        "transactions": transactions,
    }


@router.post("/{contact_id}/email", dependencies=[Depends(require_perm("invoices.send"))])
def email_customer_statement(
    contact_id: str,
    background_tasks: BackgroundTasks,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """Send customer statement via email"""
    contact_repo = ContactRepository(user["org_id"])
    contact = contact_repo.get(contact_id)
    if not contact or contact.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="کڕیار نەدۆزرایەوە")
    
    email = contact.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="کڕیار ئیمەیڵی نییە")
    
    # Get statement data
    statement = get_customer_statement(contact_id, date_from, date_to, user)
    
    # Build email HTML
    subject = f"رێکەوتی هەژمار - {contact.get('display_name', '')}"
    body_html = f"""
    <h2>رێکەوتی هەژمار</h2>
    <p>بەڕێز {contact.get('display_name', '')},</p>
    <p>لە خوارەوە رێکەوتی هەژمارەکەتان:</p>
    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <tr>
            <th>بەروار</th>
            <th>جۆر</th>
            <th>ژمارە</th>
            <th>دەبێت</th>
            <th>دراو</th>
            <th>باڵانس</th>
        </tr>
        <tr>
            <td colspan="5" style="text-align: right;"><strong>باڵانسی سەرەتا:</strong></td>
            <td><strong>{statement['opening_balance']:,.2f}</strong></td>
        </tr>
    """
    
    for txn in statement["transactions"]:
        body_html += f"""
        <tr>
            <td>{txn['date']}</td>
            <td>{txn['type']}</td>
            <td>{txn['reference']}</td>
            <td>{txn['debit']:,.2f}</td>
            <td>{txn['credit']:,.2f}</td>
            <td>{txn['balance']:,.2f}</td>
        </tr>
        """
    
    body_html += f"""
        <tr>
            <td colspan="5" style="text-align: right;"><strong>باڵانسی کۆتایی:</strong></td>
            <td><strong>{statement['closing_balance']:,.2f}</strong></td>
        </tr>
    </table>
    <p>سوپاس</p>
    """
    
    # Send email in background
    background_tasks.add_task(
        send_email,
        user["org_id"],
        email,
        subject,
        body_html,
        entity_type="statement",
        entity_id=contact_id,
    )
    
    return {"success": True, "message": "ئیمەیڵ دەنێردرێت"}


@router.get("/{contact_id}/pdf")
def get_customer_statement_pdf(
    contact_id: str,
    lang: str = Query("en", pattern="^(en|ku)$"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """Generate PDF for customer statement"""
    # Get statement data
    statement = get_customer_statement(contact_id, date_from, date_to, user)
    
    # Get organization data
    org_repo = OrganizationRepository()
    org = org_repo.get(user["org_id"])
    if not org:
        raise HTTPException(status_code=500, detail="زانیاری ڕێکخراو نەدۆزرایەوە")
    
    # Get full contact data
    contact_repo = ContactRepository(user["org_id"])
    contact = contact_repo.get(contact_id)
    
    # Build statement data with contact for PDF
    statement_data = {
        "contact": contact,
        "opening_balance": statement["opening_balance"],
        "closing_balance": statement["closing_balance"],
        "transactions": statement["transactions"],
    }
    
    # Generate PDF
    try:
        pdf_buffer = generate_customer_statement_pdf(user["org_id"], contact_id, statement_data, org, lang=lang)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"هەڵە لە دروستکردنی PDF: {str(e)}")
    
    # Return as downloadable file
    filename = f"statement_{contact.get('display_name', contact_id).replace(' ', '_')}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/bulk-email", dependencies=[Depends(require_perm("invoices.send"))])
def bulk_email_statements(
    data: BulkEmailRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """Send statements to multiple customers"""
    sent_count = 0
    failed = []
    
    for contact_id in data.contact_ids:
        try:
            email_customer_statement(
                contact_id,
                background_tasks,
                data.date_from,
                data.date_to,
                user
            )
            sent_count += 1
        except Exception as e:
            failed.append({"contact_id": contact_id, "error": str(e)})
    
    return {
        "success": True,
        "sent_count": sent_count,
        "failed_count": len(failed),
        "failed": failed,
    }
