# backend/app/services/scheduler.py
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import logging

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()

def process_recurring_invoices():
    """Check and generate invoices from recurring templates"""
    from datetime import datetime, timedelta
    from app.firestore.invoices import RecurringInvoiceRepository, InvoiceRepository
    from app.firestore.system import SequenceRepository
    from app.firebase_client import is_firebase_available
    
    if not is_firebase_available():
        return
    
    try:
        # Get all active recurring invoices across all orgs
        from app.firebase_client import get_db
        db = get_db()
        docs = db.collection("recurring_invoices") \
            .where("status", "==", "active") \
            .where("next_invoice_date", "<=", datetime.utcnow()) \
            .stream()
        
        for doc in docs:
            data = doc.to_dict()
            org_id = data.get("org_id")
            inv_repo = InvoiceRepository(org_id)
            seq_repo = SequenceRepository(org_id)
            
            # Create invoice from template
            invoice_data = {
                "contact_id": data.get("contact_id"),
                "invoice_number": seq_repo.get_next("invoice"),
                "date": datetime.utcnow(),
                "due_date": datetime.utcnow() + timedelta(days=data.get("payment_terms_days", 30)),
                "status": "draft",
                "subtotal": data.get("subtotal", 0),
                "tax_amount": data.get("tax_amount", 0),
                "total": data.get("total", 0),
                "balance_due": data.get("total", 0),
                "notes": data.get("notes", ""),
                "recurring_invoice_id": doc.id,
            }
            inv = inv_repo.create(invoice_data)
            
            # Copy line items from recurring template
            rec_repo = RecurringInvoiceRepository(org_id)
            lines = rec_repo.get_lines(doc.id)
            if lines:
                inv_repo.set_lines(inv["id"], lines)
            
            # Update next_invoice_date
            freq = data.get("frequency", "monthly")
            next_date = datetime.utcnow()
            if freq == "weekly": next_date += timedelta(weeks=1)
            elif freq == "biweekly": next_date += timedelta(weeks=2)
            elif freq == "monthly": next_date += timedelta(days=30)
            elif freq == "quarterly": next_date += timedelta(days=90)
            elif freq == "yearly": next_date += timedelta(days=365)
            
            rec_repo.update(doc.id, {"next_invoice_date": next_date, "last_generated": datetime.utcnow()})
            logger.info(f"Generated invoice {inv['id']} from recurring {doc.id}")
    except Exception as e:
        logger.error(f"Recurring invoice error: {e}")


def process_payment_reminders():
    """Send reminders for overdue invoices"""
    from datetime import datetime
    from app.firebase_client import is_firebase_available, get_db
    from app.services.email_service import send_email
    from app.firestore.contacts import ContactRepository
    from app.firestore.invoices import InvoiceRepository
    from app.firestore.organizations import OrganizationRepository
    
    if not is_firebase_available():
        return
    
    try:
        db = get_db()
        # Find overdue invoices
        docs = db.collection("invoices") \
            .where("status", "in", ["sent", "partially_paid"]) \
            .where("due_date", "<", datetime.utcnow()) \
            .stream()
        
        for doc in docs:
            data = doc.to_dict()
            org_id = data.get("org_id")
            contact_id = data.get("contact_id")
            
            # Skip if reminder was sent recently (within 7 days)
            last_reminder = data.get("last_reminder_sent_at")
            if last_reminder:
                if isinstance(last_reminder, str):
                    last_reminder = datetime.fromisoformat(last_reminder.replace("Z", ""))
                days_since = (datetime.utcnow() - last_reminder).days
                if days_since < 7:
                    continue
            
            try:
                # Get contact email
                contact_repo = ContactRepository(org_id)
                contact = contact_repo.get(contact_id)
                if not contact or not contact.get("email"):
                    continue
                
                # Get org name
                org_repo = OrganizationRepository()
                org = org_repo.get(org_id)
                org_name = org.get("name", "سیستەم") if org else "سیستەم"
                
                # Send reminder email
                subject = f"وەبیرخستنەوە: وەسڵی ژمارە {data.get('invoice_number')} بەسەرچووە"
                body = f"""<html>
                <body dir="rtl">
                <p>بەڕێز {contact.get('display_name', contact.get('company_name', ''))},</p>
                <p>وەسڵی ژمارە <strong>{data.get('invoice_number')}</strong> لە بەرواری <strong>{str(data.get('due_date'))[:10]}</strong> بەسەرچووە.</p>
                <p>بڕی ماوە: <strong>{data.get('balance_due')} {data.get('currency_code', 'IQD')}</strong></p>
                <p>تکایە بڕەکە لە کاتی خۆیدا بنێرە.</p>
                <p>سوپاس،<br>{org_name}</p>
                </body></html>"""
                
                send_email(
                    org_id=org_id,
                    to_email=contact["email"],
                    subject=subject,
                    body_html=body,
                    entity_type="invoice",
                    entity_id=doc.id,
                )
                
                # Update last_reminder_sent_at
                inv_repo = InvoiceRepository(org_id)
                inv_repo.update(doc.id, {"last_reminder_sent_at": datetime.utcnow()})
                
                logger.info(f"Reminder sent for invoice {doc.id}")
            except Exception as email_err:
                logger.error(f"Failed to send reminder for {doc.id}: {email_err}")
                continue
    except Exception as e:
        logger.error(f"Reminder error: {e}")


def start_scheduler():
    """Start the background scheduler"""
    scheduler.add_job(process_recurring_invoices, CronTrigger(hour=1, minute=0), id="recurring_invoices", replace_existing=True)
    scheduler.add_job(process_payment_reminders, CronTrigger(hour=9, minute=0), id="payment_reminders", replace_existing=True)
    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    """Stop the background scheduler"""
    if scheduler.running:
        scheduler.shutdown()
