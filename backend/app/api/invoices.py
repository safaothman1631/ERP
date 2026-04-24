import uuid
from datetime import datetime, date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from app.firestore.invoices import InvoiceRepository, PaymentReceivedRepository, RecurringInvoiceRepository
from app.firestore.taxes import TaxRateRepository
from app.firestore.items import ItemRepository
from app.firestore.system import SequenceRepository
from app.firestore.organizations import OrganizationRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services.pdf_generator import generate_invoice_pdf
from app.schemas.schemas import InvoiceCreate, InvoiceUpdate, InvoiceResponse, PaymentReceivedCreate

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


def _calculate_invoice_totals(lines_data: list, tax_repo: TaxRateRepository):
    """Calculate invoice totals from line items.

    Pre-loads all distinct tax_ids in ONE pass to avoid N queries per call
    (Firestore round-trip per line was the dominant latency on bulk endpoints).
    """
    # Collect distinct tax ids referenced in this invoice
    tax_ids = {l.get("tax_id") for l in lines_data if l.get("tax_id")}
    tax_map: dict = {}
    for tid in tax_ids:
        tax = tax_repo.get(tid)
        if tax:
            tax_map[tid] = tax

    subtotal = 0
    total_tax = 0

    for line_data in lines_data:
        qty = line_data.get("quantity", 1)
        price = line_data.get("unit_price", 0)
        discount_pct = line_data.get("discount_percent", 0)
        line_subtotal = qty * price
        discount_amt = line_subtotal * (discount_pct / 100)
        line_after_discount = line_subtotal - discount_amt

        tax_amount = 0
        tax_id = line_data.get("tax_id")
        if tax_id:
            tax = tax_map.get(tax_id)
            if tax:
                tax_amount = line_after_discount * (float(tax.get("rate", 0)) / 100)

        line_data["discount_amount"] = discount_amt
        line_data["tax_amount"] = tax_amount
        line_data["line_total"] = line_after_discount + tax_amount

        subtotal += line_after_discount
        total_tax += tax_amount

    return subtotal, total_tax


@router.get("")
def list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    status: str = Query("", max_length=20),
    contact_id: str = Query("", max_length=36),
    user: dict = Depends(get_current_user),
):
    repo = InvoiceRepository(user["org_id"])
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    if contact_id:
        filters.append({"field": "contact_id", "op": "==", "value": contact_id})
    
    items, total = repo.list(
        filters=filters,
        order_by="date",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("", status_code=201, dependencies=[Depends(require_perm("invoices.create"))])
def create_invoice(data: InvoiceCreate, user: dict = Depends(get_current_user)):
    seq_repo = SequenceRepository(user["org_id"])
    invoice_number = seq_repo.get_next("invoice")
    
    tax_repo = TaxRateRepository(user["org_id"])
    lines = [line.model_dump() for line in data.lines]
    subtotal, total_tax = _calculate_invoice_totals(lines, tax_repo)
    
    total = subtotal + total_tax + float(data.shipping_charge or 0) + float(data.adjustment or 0) - float(data.discount_amount or 0)
    
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.create({
        "id": str(uuid.uuid4()),
        "contact_id": data.contact_id,
        "invoice_number": invoice_number,
        "date": data.date,
        "due_date": data.due_date,
        "reference": data.reference,
        "currency_code": data.currency_code,
        "exchange_rate": data.exchange_rate,
        "discount_type": data.discount_type,
        "discount_amount": data.discount_amount,
        "shipping_charge": data.shipping_charge,
        "adjustment": data.adjustment,
        "notes": data.notes,
        "terms": data.terms,
        "subtotal": subtotal,
        "tax_amount": total_tax,
        "total": total,
        "balance_due": total,
        "status": "draft",
    })
    
    repo.set_lines(invoice["id"], lines)
    return invoice


@router.get("/{invoice_id}")
def get_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.get_with_lines(invoice_id)
    if not invoice or invoice.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="وەسڵ نەدۆزرایەوە")
    return invoice


@router.put("/{invoice_id}", dependencies=[Depends(require_perm("invoices.update"))])
def update_invoice(invoice_id: str, data: InvoiceUpdate, user: dict = Depends(get_current_user)):
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.get(invoice_id)
    if not invoice or invoice.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="وەسڵ نەدۆزرایەوە")
    
    update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
    invoice = repo.update(invoice_id, update_data)
    
    if data.lines:
        tax_repo = TaxRateRepository(user["org_id"])
        lines = [line.model_dump() for line in data.lines]
        subtotal, total_tax = _calculate_invoice_totals(lines, tax_repo)
        
        total = subtotal + total_tax + float(invoice.get("shipping_charge", 0)) + float(invoice.get("adjustment", 0)) - float(invoice.get("discount_amount", 0))
        
        repo.update(invoice_id, {
            "subtotal": subtotal,
            "tax_amount": total_tax,
            "total": total,
            "balance_due": total - invoice.get("amount_paid", 0)
        })
        repo.set_lines(invoice_id, lines)
    
    return repo.get_with_lines(invoice_id)


@router.delete("/{invoice_id}", dependencies=[Depends(require_perm("invoices.delete"))])
def void_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.get(invoice_id)
    if not invoice or invoice.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="وەسڵ نەدۆزرایەوە")
    
    repo.update(invoice_id, {"status": "void"})
    return {"message": "وەسڵ هەڵوەشێنرایەوە", "success": True}


# FIX-102: Invoice cancel (state machine) — cancellable only before payment
@router.post("/{invoice_id}/cancel", dependencies=[Depends(require_perm("invoices.update"))])
def cancel_invoice(invoice_id: str, data: dict = None, user: dict = Depends(get_current_user)):
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.get(invoice_id)
    if not invoice or invoice.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="وەسڵ نەدۆزرایەوە")
    if invoice.get("status") in ("paid", "void", "cancelled"):
        raise HTTPException(status_code=400, detail=f"ناتوانرێت دۆخی '{invoice.get('status')}' هەڵبوەشێنرێت")
    if float(invoice.get("amount_paid", 0) or 0) > 0:
        raise HTTPException(status_code=400, detail="ناتوانرێت وەسڵی بەشە‌پێدراو هەڵبوەشێنرێت — یەکەم پارەکە بگەڕێنەوە")
    return repo.update(invoice_id, {
        "status": "cancelled",
        "cancelled_at": datetime.utcnow().isoformat(),
        "cancelled_by": user.get("id"),
        "cancellation_reason": (data or {}).get("reason", ""),
    })


@router.post("/{invoice_id}/send", dependencies=[Depends(require_perm("invoices.update"))])
def send_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    """Mark invoice as sent"""
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.get(invoice_id)
    if not invoice or invoice.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="وەسڵ نەدۆزرایەوە")
    
    repo.update(invoice_id, {"status": "sent", "sent_date": datetime.utcnow()})

    auto_submit_result = None
    try:
        from app.firestore.contacts import ContactRepository
        from app.firestore.einvoice import EInvoiceSubmissionRepository
        from app.firestore.system import SettingsRepository
        from app.services.einvoice_service import (
            generate_fiscal_id,
            generate_qr_payload,
            generate_xml,
            merge_einvoice_config,
            sign_xml,
            submit_to_ita,
        )

        settings_repo = SettingsRepository(user["org_id"])
        config = merge_einvoice_config(settings_repo.get_by_key("einvoice_config", "integrations") or {})
        if config.get("enabled") and config.get("auto_submit_on_send"):
            invoice = repo.get_with_lines(invoice_id)
            org = OrganizationRepository(user["org_id"]).get(user["org_id"])
            contact = None
            if invoice and invoice.get("contact_id"):
                contact = ContactRepository(user["org_id"]).get(invoice["contact_id"])

            submission_repo = EInvoiceSubmissionRepository(user["org_id"])
            existing = submission_repo.get_by_invoice_id(invoice_id)
            fiscal_id = generate_fiscal_id(invoice or {}, existing.get("fiscal_id") if existing else None)
            seller_tax_id = config.get("seller_tax_id") or (org or {}).get("tax_number") or ""
            xml_content = generate_xml(invoice or {}, org or {}, contact, (invoice or {}).get("lines") or [], seller_tax_id, fiscal_id)
            signature = sign_xml(
                xml_content,
                config.get("private_key_pem") or "",
                config.get("private_key_password") or "",
            )
            provider_result = submit_to_ita(config, xml_content, signature, invoice or {}, fiscal_id)

            payload = {
                "invoice_id": invoice_id,
                "invoice_number": (invoice or {}).get("invoice_number"),
                "fiscal_id": fiscal_id,
                "seller_tax_id": seller_tax_id,
                "xml_content": xml_content,
                "qr_payload": generate_qr_payload(invoice or {}, seller_tax_id, fiscal_id),
                "signature": signature.get("signature"),
                "signature_algorithm": signature.get("algorithm"),
                "preview_signature": signature.get("preview_signature", False),
                "provider_uuid": provider_result.get("provider_uuid"),
                "provider_payload": provider_result.get("provider_payload"),
                "status": provider_result.get("provider_status", "submitted"),
                "error_message": provider_result.get("error_message"),
                "submitted_at": datetime.utcnow().isoformat(),
            }

            if existing:
                submission = submission_repo.update(existing["id"], payload)
            else:
                submission = submission_repo.create(payload)

            auto_submit_result = {
                "submission_id": submission.get("id"),
                "status": submission.get("status"),
                "provider_uuid": submission.get("provider_uuid"),
            }
    except Exception as exc:
        auto_submit_result = {"error": str(exc)}

    return {"message": "وەسڵ نێردرا", "success": True, "einvoice": auto_submit_result}


@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(
    invoice_id: str, 
    lang: str = Query("en", pattern="^(en|ku)$"),
    user: dict = Depends(get_current_user)
):
    """Generate and download invoice as PDF
    
    Query Parameters:
        - lang: Language code ('en' or 'ku'). Default: 'en'
    """
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.get(invoice_id)
    if not invoice or invoice.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="وەسڵ نەدۆزرایەوە")
    
    # Get organization data
    org_repo = OrganizationRepository()
    org = org_repo.get(user["org_id"])
    if not org:
        raise HTTPException(status_code=500, detail="زانیاری ڕێکخراو نەدۆزرایەوە")
    
    # Generate PDF
    try:
        pdf_buffer = generate_invoice_pdf(user["org_id"], invoice_id, org, lang=lang)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"هەڵە لە دروستکردنی PDF: {str(e)}")
    
    # Return as downloadable file
    filename = f"invoice_{invoice.get('invoice_number', invoice_id)}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/{invoice_id}/send-reminder", dependencies=[Depends(require_perm("invoices.update"))])
def send_payment_reminder(invoice_id: str, user: dict = Depends(get_current_user)):
    """Manually send payment reminder for a specific invoice"""
    from app.services.email_service import send_email
    from app.firestore.contacts import ContactRepository
    from app.firestore.organizations import OrganizationRepository
    
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.get(invoice_id)
    if not invoice or invoice.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="وەسڵ نەدۆزرایەوە")
    
    contact_repo = ContactRepository(user["org_id"])
    contact = contact_repo.get(invoice["contact_id"])
    if not contact or not contact.get("email"):
        raise HTTPException(status_code=400, detail="ئیمەیڵی کڕیار نییە")
    
    org_repo = OrganizationRepository()
    org = org_repo.get(user["org_id"])
    org_name = org.get("name", "سیستەم") if org else "سیستەم"
    
    subject = f"وەبیرخستنەوە: وەسڵی ژمارە {invoice.get('invoice_number')}"
    body = f"""<html>
    <body dir="rtl">
    <p>بەڕێز {contact.get('display_name', contact.get('company_name', ''))},</p>
    <p>وەسڵی ژمارە <strong>{invoice.get('invoice_number')}</strong> لە بەرواری <strong>{str(invoice.get('due_date'))[:10]}</strong> دەگاتە کۆتایی.</p>
    <p>بڕی ماوە: <strong>{invoice.get('balance_due')} {invoice.get('currency_code', 'IQD')}</strong></p>
    <p>تکایە بڕەکە لە کاتی خۆیدا بنێرە.</p>
    <p>سوپاس،<br>{org_name}</p>
    </body></html>"""
    
    send_email(
        org_id=user["org_id"],
        to_email=contact["email"],
        subject=subject,
        body_html=body,
        entity_type="invoice",
        entity_id=invoice_id,
    )
    
    repo.update(invoice_id, {"last_reminder_sent_at": datetime.utcnow()})
    
    return {"success": True, "message": "وەبیرخستنەوە بۆ کڕیار نێردرا"}


# ===== PAYMENTS RECEIVED =====
payments_router = APIRouter(prefix="/api/payments-received", tags=["Payments Received"])


@payments_router.get("")
def list_payments_received(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    repo = PaymentReceivedRepository(user["org_id"])
    items, total = repo.list(
        order_by="date",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@payments_router.post("", status_code=201)
def create_payment_received(data: PaymentReceivedCreate, user: dict = Depends(get_current_user)):
    seq_repo = SequenceRepository(user["org_id"])
    payment_number = seq_repo.get_next("payment_received")
    
    repo = PaymentReceivedRepository(user["org_id"])
    payment = repo.create({
        "id": str(uuid.uuid4()),
        "payment_number": payment_number,
        **data.model_dump(),
    })
    
    # Update invoice balance
    if data.invoice_id:
        inv_repo = InvoiceRepository(user["org_id"])
        inv_repo.record_payment(data.invoice_id, data.amount)
    
    return payment


# ===== EARLY PAYMENT DISCOUNT =====
@router.get("/{invoice_id}/discount-amount")
def get_early_payment_discount(invoice_id: str, user: dict = Depends(get_current_user)):
    """Calculate early payment discount if paid within discount_days"""
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.get(invoice_id)
    if not invoice or invoice.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="وەسڵ نەدۆزرایەوە")
    
    discount_days = invoice.get("discount_days")
    discount_percent = invoice.get("discount_percent")
    
    if not discount_days or not discount_percent:
        return {
            "eligible": False,
            "discount_amount": 0,
            "discount_percent": 0,
            "days_remaining": 0,
            "due_date": invoice.get("due_date")
        }
    
    from datetime import datetime, timedelta
    invoice_date = datetime.fromisoformat(invoice["date"]) if isinstance(invoice["date"], str) else invoice["date"]
    discount_deadline = invoice_date + timedelta(days=int(discount_days))
    now = datetime.utcnow()
    
    days_remaining = (discount_deadline - now).days
    eligible = days_remaining > 0
    
    discount_amount = 0
    if eligible:
        balance = float(invoice.get("balance_due", 0))
        discount_amount = balance * (float(discount_percent) / 100)
    
    return {
        "eligible": eligible,
        "discount_amount": discount_amount,
        "discount_percent": discount_percent,
        "days_remaining": max(0, days_remaining),
        "due_date": invoice.get("due_date")
    }


# ===== PROGRESS INVOICING =====
@router.get("/from-quote/{quote_id}/progress")
def get_quote_progress(quote_id: str, user: dict = Depends(get_current_user)):
    """Show how much of quote has been invoiced"""
    from app.firestore.invoices import QuoteRepository
    quote_repo = QuoteRepository(user["org_id"])
    quote = quote_repo.get(quote_id)
    if not quote or quote.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پێشنیار نەدۆزرایەوە")
    
    # Find all invoices linked to this quote
    repo = InvoiceRepository(user["org_id"])
    invoices, _ = repo.list(filters=[{"field": "quote_id", "op": "==", "value": quote_id}], limit=1000)
    
    total_invoiced = sum(float(inv.get("total", 0)) for inv in invoices if inv.get("status") != "void")
    quote_total = float(quote.get("total", 0))
    
    return {
        "quote_id": quote_id,
        "quote_total": quote_total,
        "total_invoiced": total_invoiced,
        "remaining": quote_total - total_invoiced,
        "percent_invoiced": (total_invoiced / quote_total * 100) if quote_total > 0 else 0,
        "invoice_count": len(invoices)
    }

@router.post("/from-quote/{quote_id}/progress", status_code=201)
def create_progress_invoice(quote_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Create a progress invoice from a quote"""
    from app.firestore.invoices import QuoteRepository
    quote_repo = QuoteRepository(user["org_id"])
    quote = quote_repo.get_with_lines(quote_id)
    if not quote or quote.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پێشنیار نەدۆزرایەوە")
    
    percent = data.get("percent", 100) / 100
    lines_progress = data.get("lines", [])
    
    # Create invoice lines from quote lines
    quote_lines = quote.get("lines", [])
    invoice_lines = []
    
    for qline in quote_lines:
        # Find line-specific progress percent if provided
        line_percent = percent
        for lp in lines_progress:
            if lp.get("quote_line_id") == qline.get("id"):
                line_percent = lp.get("progress_percent", 100) / 100
                break
        
        invoice_lines.append({
            "item_id": qline.get("item_id"),
            "description": qline.get("description"),
            "quantity": float(qline.get("quantity", 0)) * line_percent,
            "unit_price": qline.get("unit_price"),
            "discount_percent": qline.get("discount_percent", 0),
            "tax_id": qline.get("tax_id"),
        })
    
    # Create invoice
    seq_repo = SequenceRepository(user["org_id"])
    invoice_number = seq_repo.get_next("invoice")
    
    tax_repo = TaxRateRepository(user["org_id"])
    subtotal, total_tax = _calculate_invoice_totals(invoice_lines, tax_repo)
    total = subtotal + total_tax
    
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.create({
        "id": str(uuid.uuid4()),
        "contact_id": quote["contact_id"],
        "quote_id": quote_id,
        "invoice_number": invoice_number,
        "date": datetime.utcnow().isoformat(),
        "due_date": quote.get("expiry_date"),
        "reference": f"Progress invoice from quote {quote.get('quote_number', '')}",
        "currency_code": quote.get("currency_code", "IQD"),
        "exchange_rate": quote.get("exchange_rate", 1),
        "notes": f"Progress: {percent*100}%",
        "subtotal": subtotal,
        "tax_amount": total_tax,
        "total": total,
        "balance_due": total,
        "status": "draft",
    })
    
    repo.set_lines(invoice["id"], invoice_lines)
    return invoice


# ===== RETAINER INVOICES =====
@router.post("/retainer", status_code=201)
def create_retainer_invoice(data: dict, user: dict = Depends(get_current_user)):
    """Create a retainer invoice"""
    seq_repo = SequenceRepository(user["org_id"])
    invoice_number = seq_repo.get_next("invoice")
    
    amount = float(data.get("amount", 0))
    
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.create({
        "id": str(uuid.uuid4()),
        "contact_id": data["contact_id"],
        "invoice_number": invoice_number,
        "invoice_type": "retainer",
        "date": data.get("date", datetime.utcnow().isoformat()),
        "due_date": data.get("due_date"),
        "reference": data.get("reference", "Retainer"),
        "currency_code": data.get("currency_code", "IQD"),
        "exchange_rate": data.get("exchange_rate", 1),
        "notes": data.get("notes", ""),
        "subtotal": amount,
        "tax_amount": 0,
        "total": amount,
        "balance_due": amount,
        "status": "draft",
    })
    
    # Create a simple line item
    repo.set_lines(invoice["id"], [{
        "description": data.get("description", "Retainer payment"),
        "quantity": 1,
        "unit_price": amount,
        "discount_percent": 0,
        "line_total": amount,
    }])
    
    return invoice

@router.post("/retainer/{retainer_id}/apply")
def apply_retainer(retainer_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Apply retainer to regular invoice"""
    repo = InvoiceRepository(user["org_id"])
    
    # Get retainer invoice
    retainer = repo.get(retainer_id)
    if not retainer or retainer.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="وەسڵی retainer نەدۆزرایەوە")
    
    if retainer.get("invoice_type") != "retainer":
        raise HTTPException(status_code=400, detail="ئەم وەسڵە retainer نیە")
    
    # Get target invoice
    target_invoice_id = data["invoice_id"]
    target_invoice = repo.get(target_invoice_id)
    if not target_invoice or target_invoice.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="وەسڵ نەدۆزرایەوە")
    
    amount = float(data["amount"])
    retainer_balance = float(retainer.get("balance_due", 0))
    target_balance = float(target_invoice.get("balance_due", 0))
    
    # Validate amount
    if amount > retainer_balance:
        raise HTTPException(status_code=400, detail="بڕەکە لە باڵانسی retainer زیاترە")
    
    if amount > target_balance:
        raise HTTPException(status_code=400, detail="بڕەکە لە باڵانسی وەسڵ زیاترە")
    
    # Update both invoices
    repo.update(retainer_id, {"balance_due": retainer_balance - amount})
    repo.update(target_invoice_id, {"balance_due": target_balance - amount})
    
    # Record application in retainer_applications collection
    from app.firestore.invoices import RetainerApplicationRepository
    app_repo = RetainerApplicationRepository(user["org_id"])
    application = app_repo.create({
        "id": str(uuid.uuid4()),
        "retainer_invoice_id": retainer_id,
        "invoice_id": target_invoice_id,
        "amount": amount,
        "date": datetime.utcnow().isoformat(),
    })
    
    return {
        "success": True,
        "application": application,
        "retainer_balance_remaining": retainer_balance - amount,
        "invoice_balance_remaining": target_balance - amount,
    }

@router.get("/contacts/{contact_id}/retainer-credits")
def get_contact_retainer_credits(contact_id: str, user: dict = Depends(get_current_user)):
    """List retainer invoices with remaining balance for contact"""
    repo = InvoiceRepository(user["org_id"])
    
    # Find all retainer invoices for this contact with balance remaining
    filters = [
        {"field": "contact_id", "op": "==", "value": contact_id},
        {"field": "invoice_type", "op": "==", "value": "retainer"},
    ]
    
    retainers, total = repo.list(filters=filters, limit=100)
    
    # Filter those with balance > 0
    available_retainers = [
        r for r in retainers 
        if float(r.get("balance_due", 0)) > 0 and r.get("status") not in ["void", "draft"]
    ]
    
    total_credit = sum(float(r.get("balance_due", 0)) for r in available_retainers)
    
    return {
        "contact_id": contact_id,
        "retainers": available_retainers,
        "total_credit_available": total_credit,
        "count": len(available_retainers)
    }


# ─────────────────────── Recurring Invoices (FIX-54) ─────────────────────

class RecurringInvoiceCreate(BaseModel):
    contact_id: str
    description: Optional[str] = None
    line_items: list[dict] = Field(default_factory=list)
    frequency: str = Field(..., description="monthly|quarterly|yearly")
    start_date: str
    end_date: Optional[str] = None
    is_active: bool = True


@router.post("/recurring", status_code=201, dependencies=[Depends(require_perm("invoices.create"))])
def create_recurring_invoice(data: RecurringInvoiceCreate, user: dict = Depends(get_current_user)):
    """Create a recurring invoice template."""
    repo = RecurringInvoiceRepository(user["org_id"])
    return repo.create({
        **data.model_dump(),
        "created_at": datetime.utcnow().isoformat(),
    })


@router.post("/recurring/trigger", dependencies=[Depends(require_perm("invoices.create"))])
def trigger_recurring_invoices(user: dict = Depends(get_current_user)):
    """Generate due invoices from active recurring templates. (FIX-54 cron)
    
    This checks all active recurring invoices and creates next invoice if:
    - today >= next_due_date
    - (end_date is None OR today <= end_date)
    """
    from app.firestore.system import SequenceRepository
    
    org_id = user["org_id"]
    rec_repo = RecurringInvoiceRepository(org_id)
    seq_repo = SequenceRepository(org_id)
    inv_repo = InvoiceRepository(org_id)
    tax_repo = TaxRateRepository(org_id)
    
    active, _ = rec_repo.list(
        filters=[{"field": "is_active", "op": "==", "value": True}],
        limit=1000,
    )
    
    today = date.today()
    generated = []
    
    for rec in active:
        try:
            # Check if we should generate next invoice
            next_due_str = rec.get("next_due_date")
            next_due = date.fromisoformat(next_due_str) if next_due_str else date.fromisoformat(rec["start_date"][:10])
            
            if today < next_due:
                continue  # Not yet due
            
            end_date_str = rec.get("end_date")
            if end_date_str:
                end_date = date.fromisoformat(end_date_str[:10])
                if today > end_date:
                    # Mark as inactive
                    rec_repo.update(rec["id"], {"is_active": False})
                    continue
            
            # Generate invoice
            inv_number = seq_repo.next_sequence(org_id, "invoice")
            
            lines_data = rec.get("line_items") or []
            subtotal, total_tax = _calculate_invoice_totals(lines_data, tax_repo)
            total = subtotal + total_tax
            
            invoice = inv_repo.create({
                "id": str(uuid.uuid4()),
                "contact_id": rec["contact_id"],
                "recurring_invoice_id": rec["id"],
                "invoice_number": inv_number,
                "date": datetime.utcnow().isoformat(),
                "due_date": (today + timedelta(days=30)).isoformat(),
                "line_items": lines_data,
                "subtotal": round(subtotal, 2),
                "tax_total": round(total_tax, 2),
                "total": round(total, 2),
                "status": "draft",
            })
            
            # Compute next due date
            freq = rec.get("frequency", "monthly")
            if freq == "quarterly":
                next_due = next_due + timedelta(days=91)
            elif freq == "yearly":
                next_due = next_due + timedelta(days=365)
            else:  # monthly
                try:
                    next_due = next_due + timedelta(days=30)
                except ValueError:
                    next_due = next_due + timedelta(days=28)
            
            rec_repo.update(rec["id"], {"next_due_date": next_due.isoformat()})
            generated.append(invoice)
        except Exception as e:
            # Log error but continue
            pass
    
    return {"generated": len(generated), "invoices": [{"id": i["id"], "invoice_number": i.get("invoice_number")} for i in generated]}

