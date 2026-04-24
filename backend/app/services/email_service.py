"""Email Service for sending invoices, quotes, and reminders via SMTP."""
import uuid
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from datetime import datetime

from fastapi import HTTPException

from app.firestore.organizations import OrganizationRepository
from app.firestore.invoices import InvoiceRepository, QuoteRepository
from app.firestore.contacts import ContactRepository
from app.firestore.system import EmailLogRepository
from app.services.pdf_generator import generate_invoice_pdf, generate_quote_pdf


def _get_org(org_id: str) -> dict:
    """Get organization with SMTP settings"""
    org_repo = OrganizationRepository()
    org = org_repo.get(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="دامەزراوە نەدۆزرایەوە")
    if not org.get("smtp_host") or not org.get("smtp_user") or not org.get("smtp_password"):
        raise HTTPException(status_code=400, detail="ڕێکخستنی ئیمەیڵ تەواو نییە")
    return org


def _log_email(org_id: str, entity_type: str, entity_id: str, to_email: str, subject: str, status: str = "sent", error_message: str | None = None):
    """Log email to Firestore"""
    log_repo = EmailLogRepository(org_id)
    log_repo.create({
        "entity_type": entity_type,
        "entity_id": entity_id,
        "to_email": to_email,
        "subject": subject,
        "status": status,
        "error_message": error_message,
        "sent_at": datetime.utcnow(),
    })


def send_email(
    org_id: str,
    to_email: str,
    subject: str,
    body_html: str,
    attachment_bytes: bytes | None = None,
    attachment_name: str | None = None,
    entity_type: str = "general",
    entity_id: str = "",
) -> bool:
    """Send email via SMTP with optional attachment"""
    org = _get_org(org_id)

    msg = MIMEMultipart()
    msg["From"] = org.get("email_from") or org["smtp_user"]
    msg["To"] = to_email
    msg["Subject"] = subject

    msg.attach(MIMEText(body_html, "html", "utf-8"))

    if attachment_bytes and attachment_name:
        attachment = MIMEApplication(attachment_bytes, Name=attachment_name)
        attachment["Content-Disposition"] = f'attachment; filename="{attachment_name}"'
        msg.attach(attachment)

    try:
        context = ssl.create_default_context()
        port = org.get("smtp_port", 587)

        if port == 465:
            with smtplib.SMTP_SSL(org["smtp_host"], port, context=context, timeout=30) as server:
                server.login(org["smtp_user"], org["smtp_password"])
                server.sendmail(msg["From"], [to_email], msg.as_string())
        else:
            with smtplib.SMTP(org["smtp_host"], port, timeout=30) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(org["smtp_user"], org["smtp_password"])
                server.sendmail(msg["From"], [to_email], msg.as_string())

        _log_email(org_id, entity_type, entity_id, to_email, subject, "sent")
        return True

    except smtplib.SMTPException as e:
        _log_email(org_id, entity_type, entity_id, to_email, subject, "failed", str(e))
        raise HTTPException(status_code=500, detail=f"ئیمەیڵ نەنێردرا: {str(e)}")


def send_invoice_email(
    org_id: str,
    invoice_id: str,
    to_email: str | None = None,
    subject: str | None = None,
    message: str | None = None,
) -> bool:
    """Send invoice PDF via email"""
    invoice_repo = InvoiceRepository(org_id)
    invoice = invoice_repo.get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="پسووڵە نەدۆزرایەوە")

    org = _get_org(org_id)

    # Determine recipient
    recipient = to_email
    if not recipient:
        if invoice.get("contact_id"):
            contact_repo = ContactRepository(org_id)
            contact = contact_repo.get(invoice["contact_id"])
            if contact and contact.get("email"):
                recipient = contact["email"]
        if not recipient:
            raise HTTPException(status_code=400, detail="ئیمەیڵی وەرگر نادیارە")

    # Generate PDF
    pdf_buffer = generate_invoice_pdf(org_id, invoice_id, org)
    pdf_bytes = pdf_buffer.read()

    # Build email
    email_subject = subject or f"پسووڵە {invoice.get('invoice_number')} - {org.get('name')}"
    
    contact_name = ""
    if invoice.get("contact_id"):
        contact_repo = ContactRepository(org_id)
        contact = contact_repo.get(invoice["contact_id"])
        if contact:
            contact_name = contact.get("display_name", "")
    
    body = message or f"""
    <div dir="rtl" style="font-family: Arial, sans-serif;">
        <h2>پسووڵە: {invoice.get('invoice_number')}</h2>
        <p>بەڕێز {contact_name},</p>
        <p>پسووڵەکەت هاوپێچ کراوە.</p>
        <p>کۆی گشتی: {float(invoice.get('total', 0)):,.0f} د.ع</p>
        <p>سوپاس بۆ کاری لەگەڵمان.</p>
        <br>
        <p>{org.get('name')}</p>
    </div>
    """

    return send_email(
        org_id=org_id,
        to_email=recipient,
        subject=email_subject,
        body_html=body,
        attachment_bytes=pdf_bytes,
        attachment_name=f"{invoice.get('invoice_number')}.pdf",
        entity_type="invoice",
        entity_id=invoice_id,
    )


def send_quote_email(
    org_id: str,
    quote_id: str,
    to_email: str | None = None,
    subject: str | None = None,
    message: str | None = None,
) -> bool:
    """Send quote PDF via email"""
    quote_repo = QuoteRepository(org_id)
    quote = quote_repo.get(quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="پێشنیار نەدۆزرایەوە")

    org = _get_org(org_id)

    # Determine recipient
    recipient = to_email
    if not recipient:
        if quote.get("contact_id"):
            contact_repo = ContactRepository(org_id)
            contact = contact_repo.get(quote["contact_id"])
            if contact and contact.get("email"):
                recipient = contact["email"]
        if not recipient:
            raise HTTPException(status_code=400, detail="ئیمەیڵی وەرگر نادیارە")

    # Generate PDF
    pdf_buffer = generate_quote_pdf(org_id, quote_id, org)
    pdf_bytes = pdf_buffer.read()

    # Build email
    email_subject = subject or f"پێشنیار {quote.get('quote_number')} - {org.get('name')}"
    
    contact_name = ""
    if quote.get("contact_id"):
        contact_repo = ContactRepository(org_id)
        contact = contact_repo.get(quote["contact_id"])
        if contact:
            contact_name = contact.get("display_name", "")
    
    body = message or f"""
    <div dir="rtl" style="font-family: Arial, sans-serif;">
        <h2>پێشنیار: {quote.get('quote_number')}</h2>
        <p>بەڕێز {contact_name},</p>
        <p>پێشنیارەکەت هاوپێچ کراوە.</p>
        <p>کۆی گشتی: {float(quote.get('total', 0)):,.0f} د.ع</p>
        <br>
        <p>{org.get('name')}</p>
    </div>
    """

    return send_email(
        org_id=org_id,
        to_email=recipient,
        subject=email_subject,
        body_html=body,
        attachment_bytes=pdf_bytes,
        attachment_name=f"{quote.get('quote_number')}.pdf",
        entity_type="quote",
        entity_id=quote_id,
    )


def send_reminder_email(org_id: str, invoice_id: str) -> bool:
    """Send payment reminder email for an invoice"""
    invoice_repo = InvoiceRepository(org_id)
    invoice = invoice_repo.get(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="پسووڵە نەدۆزرایەوە")

    if invoice.get("status") in ("paid", "void", "draft"):
        raise HTTPException(status_code=400, detail="ناتوانرێت بیرخستنەوە بنێردرێت بۆ ئەم پسووڵەیە")

    org = _get_org(org_id)

    # Get contact
    contact = None
    if invoice.get("contact_id"):
        contact_repo = ContactRepository(org_id)
        contact = contact_repo.get(invoice["contact_id"])
    
    if not contact or not contact.get("email"):
        raise HTTPException(status_code=400, detail="ئیمەیڵی کڕیار نادیارە")

    # Generate PDF
    pdf_buffer = generate_invoice_pdf(org_id, invoice_id, org)
    pdf_bytes = pdf_buffer.read()

    reminder_count = invoice.get("reminder_count", 0) + 1
    subject = f"بیرخستنەوە #{reminder_count}: پسووڵە {invoice.get('invoice_number')} - {org.get('name')}"
    body = f"""
    <div dir="rtl" style="font-family: Arial, sans-serif;">
        <h2>بیرخستنەوەی پارەدان</h2>
        <p>بەڕێز {contact.get('display_name')},</p>
        <p>ئەم ئیمەیلە بیرخستنەوەیە بۆ پسووڵەی <strong>{invoice.get('invoice_number')}</strong>.</p>
        <p>بڕی ماوە: <strong>{float(invoice.get('balance_due', 0)):,.0f} د.ع</strong></p>
        {"<p>بەرواری دوایی: " + str(invoice.get('due_date', ''))[:10] + "</p>" if invoice.get('due_date') else ""}
        <p>تکایە پارەدانەکە بکە لە کاتی خۆیدا.</p>
        <br>
        <p>سوپاس,</p>
        <p>{org.get('name')}</p>
    </div>
    """

    result = send_email(
        org_id=org_id,
        to_email=contact["email"],
        subject=subject,
        body_html=body,
        attachment_bytes=pdf_bytes,
        attachment_name=f"{invoice.get('invoice_number')}.pdf",
        entity_type="invoice_reminder",
        entity_id=invoice_id,
    )

    # Update reminder tracking
    invoice_repo.update(invoice_id, {
        "reminder_count": reminder_count,
        "last_reminder_sent_at": datetime.utcnow(),
    })

    return result
