"""Background scheduler service for automated tasks (Wave L + existing).

Runs 5 background jobs:
1. Subscription renewal - generates invoices for due subscriptions (Wave L)
2. Scheduled reports - executes scheduled reports (Wave L)
3. Dunning - sends payment reminders for past-due subscriptions (Wave L)
4. Recurring invoices - legacy job from Phase 1
5. Payment reminders - legacy job for overdue invoices
"""
from __future__ import annotations
import logging
import os
from datetime import datetime, timedelta
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

# Module-level scheduler instance
_scheduler: Optional[AsyncIOScheduler] = None


def start_scheduler(app=None):
    """Initialize and start the background scheduler."""
    global _scheduler

    # Check if scheduler is disabled via env var
    if not os.getenv("SCHEDULER_ENABLED", "true").lower() in ("true", "1", "yes"):
        logger.info("🚫 Scheduler disabled via SCHEDULER_ENABLED env var")
        return

    if _scheduler is not None:
        logger.warning("Scheduler already started")
        return

    logger.info("🕐 Starting background scheduler...")

    _scheduler = AsyncIOScheduler()

    # Wave L jobs
    _scheduler.add_job(
        _job_subscription_renewal,
        trigger=IntervalTrigger(hours=1),
        id="subscription_renewal",
        name="Subscription Invoice Generation",
        replace_existing=True,
    )

    _scheduler.add_job(
        _job_scheduled_reports,
        trigger=IntervalTrigger(minutes=15),
        id="scheduled_reports",
        name="Scheduled Reports Execution",
        replace_existing=True,
    )

    _scheduler.add_job(
        _job_dunning,
        trigger=IntervalTrigger(hours=6),
        id="dunning",
        name="Dunning Notice Processing",
        replace_existing=True,
    )

    # Legacy jobs
    _scheduler.add_job(
        process_recurring_invoices,
        trigger=CronTrigger(hour=1, minute=0),
        id="recurring_invoices",
        name="Recurring Invoice Generation",
        replace_existing=True,
    )

    _scheduler.add_job(
        process_payment_reminders,
        trigger=CronTrigger(hour=9, minute=0),
        id="payment_reminders",
        name="Payment Reminder Emails",
        replace_existing=True,
    )

    # Wave N: Monthly depreciation
    _scheduler.add_job(
        _job_monthly_depreciation,
        trigger=CronTrigger(day=1, hour=2, minute=0),
        id="monthly_depreciation",
        name="Fixed Assets Monthly Depreciation",
        replace_existing=True,
    )

    # System Health Backup: Daily backup of all organizations
    _scheduler.add_job(
        _job_daily_backup,
        trigger=CronTrigger(
            hour=int(os.getenv("BACKUP_CRON_HOUR", "2")),
            minute=int(os.getenv("BACKUP_CRON_MINUTE", "0")),
        ),
        id="daily_backup",
        name="Daily Organization Backup",
        replace_existing=True,
    )

    # Phase 2: GDPR hard-delete after grace period
    _scheduler.add_job(
        _job_gdpr_hard_delete,
        trigger=CronTrigger(hour=3, minute=0),
        id="gdpr_hard_delete_grace",
        name="GDPR Hard Delete After Grace Period",
        replace_existing=True,
    )

    # Phase 4: e-invoice dispatch retries
    _scheduler.add_job(
        _job_einvoice_dispatcher,
        trigger=IntervalTrigger(minutes=5),
        id="einvoice_dispatcher",
        name="E-Invoice Submission Dispatcher",
        replace_existing=True,
    )

    # Phase 3: lot expiry alerts
    _scheduler.add_job(
        _job_lot_expiry_alerts,
        trigger=CronTrigger(hour=8, minute=0),
        id="lot_expiry_alerts",
        name="Inventory Lot Expiry Alerts",
        replace_existing=True,
    )

    # Performance wave: hard-delete soft-deleted docs past retention
    _scheduler.add_job(
        _job_soft_delete_purge,
        trigger=CronTrigger(day_of_week="sun", hour=4, minute=0),
        id="soft_delete_purge",
        name="Soft-Delete Retention Purge",
        replace_existing=True,
    )

    _scheduler.add_job(
        _job_refresh_org_counters,
        trigger=CronTrigger(day=1, hour=5, minute=0),
        id="refresh_org_counters",
        name="Refresh AR/AP Dashboard Counters",
        replace_existing=True,
    )

    _scheduler.add_job(
        _job_outbox_dispatch,
        trigger=IntervalTrigger(minutes=1),
        id="outbox_dispatch",
        name="Outbox Event Dispatcher",
        replace_existing=True,
    )

    _scheduler.add_job(
        _job_audit_retention,
        trigger=CronTrigger(day=1, hour=6, minute=0),
        id="audit_retention",
        name="Audit Log Retention Purge",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info("✅ Scheduler started with 14 jobs")


def shutdown_scheduler():
    """Gracefully shutdown the scheduler."""
    global _scheduler
    if _scheduler is not None:
        logger.info("🛑 Shutting down scheduler...")
        _scheduler.shutdown(wait=True)
        _scheduler = None
        logger.info("✅ Scheduler stopped")


# Legacy alias for backwards compatibility
stop_scheduler = shutdown_scheduler


def get_scheduler() -> Optional[AsyncIOScheduler]:
    """Get the scheduler instance (for status checks)."""
    return _scheduler


# ═══════════════════════════════════════════════════════════════════════════
# Wave L: New job implementations
# ═══════════════════════════════════════════════════════════════════════════

def _job_subscription_renewal():
    """Scan all organizations for subscriptions due for renewal."""
    from app.firestore.job_runs import JobRunRepository
    from app.firebase_client import get_firestore_client
    from app.api.subscriptions import _generate_invoice_for_sub

    started_at = datetime.utcnow().isoformat()
    total_processed = 0
    total_failed = 0
    errors = []

    try:
        logger.info("🔄 Running subscription renewal job...")
        db = get_firestore_client()

        # Scan all organizations
        orgs_ref = db.collection("organizations")
        orgs = list(orgs_ref.stream())

        for org_doc in orgs:
            org_id = org_doc.id
            try:
                # Find subscriptions due for renewal
                subs_ref = db.collection("subscriptions").where("org_id", "==", org_id)
                today = datetime.utcnow().isoformat()[:10]

                for sub_doc in subs_ref.stream():
                    sub = sub_doc.to_dict()
                    sub_id = sub_doc.id
                    status = sub.get("status")
                    next_invoice_date = sub.get("next_invoice_date", "")

                    # Only process active/trial subs that are due
                    if status in ("active", "trial") and next_invoice_date and next_invoice_date[:10] <= today:
                        try:
                            _generate_invoice_for_sub(org_id, sub_id)
                            total_processed += 1
                        except Exception as e:
                            total_failed += 1
                            errors.append({"item_id": sub_id, "error_msg": str(e)})
                            logger.error(f"Failed to generate invoice for sub {sub_id}: {e}")

            except Exception as e:
                logger.error(f"Error processing org {org_id}: {e}")

        finished_at = datetime.utcnow().isoformat()
        status = "success" if total_failed == 0 else ("partial" if total_processed > 0 else "failed")

        # Record run (no org_id - cross-org job)
        job_run_repo = JobRunRepository("__system__")
        job_run_repo.create_run(
            job_name="subscription_renewal",
            items_processed=total_processed,
            items_failed=total_failed,
            errors=errors,
            started_at=started_at,
            finished_at=finished_at,
            status=status,
        )

        logger.info(f"✅ Subscription renewal: {total_processed} processed, {total_failed} failed")

    except Exception as e:
        logger.error(f"❌ Subscription renewal job failed: {e}")
        # Record failure
        job_run_repo = JobRunRepository("__system__")
        job_run_repo.create_run(
            job_name="subscription_renewal",
            items_processed=total_processed,
            items_failed=total_failed,
            errors=[{"error_msg": str(e)}],
            started_at=started_at,
            finished_at=datetime.utcnow().isoformat(),
            status="failed",
        )


def _job_scheduled_reports():
    """Execute scheduled reports that are due."""
    from app.firestore.job_runs import JobRunRepository
    from app.firebase_client import get_firestore_client
    from app.api.scheduled_reports import _execute_scheduled_report

    started_at = datetime.utcnow().isoformat()
    total_processed = 0
    total_failed = 0
    errors = []

    try:
        logger.info("📊 Running scheduled reports job...")
        db = get_firestore_client()

        # Scan all organizations
        orgs_ref = db.collection("organizations")
        orgs = list(orgs_ref.stream())

        for org_doc in orgs:
            org_id = org_doc.id
            try:
                # Find active reports that are due
                reports_ref = db.collection("scheduled_reports").where("org_id", "==", org_id)
                now = datetime.utcnow().isoformat()

                for report_doc in reports_ref.stream():
                    report = report_doc.to_dict()
                    report_id = report_doc.id
                    active = report.get("active", True)
                    next_run_at = report.get("next_run_at")

                    if active and next_run_at and next_run_at <= now:
                        try:
                            _execute_scheduled_report(org_id, report_id)
                            total_processed += 1
                        except Exception as e:
                            total_failed += 1
                            errors.append({"item_id": report_id, "error_msg": str(e)})
                            logger.error(f"Failed to execute report {report_id}: {e}")

            except Exception as e:
                logger.error(f"Error processing org {org_id}: {e}")

        finished_at = datetime.utcnow().isoformat()
        status = "success" if total_failed == 0 else ("partial" if total_processed > 0 else "failed")

        job_run_repo = JobRunRepository("__system__")
        job_run_repo.create_run(
            job_name="scheduled_reports",
            items_processed=total_processed,
            items_failed=total_failed,
            errors=errors,
            started_at=started_at,
            finished_at=finished_at,
            status=status,
        )

        logger.info(f"✅ Scheduled reports: {total_processed} processed, {total_failed} failed")

    except Exception as e:
        logger.error(f"❌ Scheduled reports job failed: {e}")
        job_run_repo = JobRunRepository("__system__")
        job_run_repo.create_run(
            job_name="scheduled_reports",
            items_processed=total_processed,
            items_failed=total_failed,
            errors=[{"error_msg": str(e)}],
            started_at=started_at,
            finished_at=datetime.utcnow().isoformat(),
            status="failed",
        )


def _job_dunning():
    """Process past-due subscriptions with dunning workflow."""
    from app.firestore.job_runs import JobRunRepository
    from app.firebase_client import get_firestore_client
    from app.api.subscriptions import _run_dunning_step

    started_at = datetime.utcnow().isoformat()
    total_processed = 0
    total_failed = 0
    errors = []

    try:
        logger.info("📧 Running dunning job...")
        db = get_firestore_client()

        # Scan all organizations
        orgs_ref = db.collection("organizations")
        orgs = list(orgs_ref.stream())

        for org_doc in orgs:
            org_id = org_doc.id
            try:
                # Find past-due subscriptions
                subs_ref = db.collection("subscriptions").where("org_id", "==", org_id)

                for sub_doc in subs_ref.stream():
                    sub = sub_doc.to_dict()
                    sub_id = sub_doc.id
                    status = sub.get("status")

                    if status == "past_due":
                        try:
                            _run_dunning_step(org_id, sub_id)
                            total_processed += 1
                        except Exception as e:
                            total_failed += 1
                            errors.append({"item_id": sub_id, "error_msg": str(e)})
                            logger.error(f"Failed to run dunning for sub {sub_id}: {e}")

            except Exception as e:
                logger.error(f"Error processing org {org_id}: {e}")

        finished_at = datetime.utcnow().isoformat()
        status = "success" if total_failed == 0 else ("partial" if total_processed > 0 else "failed")

        job_run_repo = JobRunRepository("__system__")
        job_run_repo.create_run(
            job_name="dunning",
            items_processed=total_processed,
            items_failed=total_failed,
            errors=errors,
            started_at=started_at,
            finished_at=finished_at,
            status=status,
        )

        logger.info(f"✅ Dunning: {total_processed} processed, {total_failed} failed")

    except Exception as e:
        logger.error(f"❌ Dunning job failed: {e}")
        job_run_repo = JobRunRepository("__system__")
        job_run_repo.create_run(
            job_name="dunning",
            items_processed=total_processed,
            items_failed=total_failed,
            errors=[{"error_msg": str(e)}],
            started_at=started_at,
            finished_at=datetime.utcnow().isoformat(),
            status="failed",
        )


def _job_monthly_depreciation():
    """Run monthly depreciation for all organizations (Wave N).
    
    Runs on 1st of each month at 02:00.
    Processes previous month's depreciation.
    """
    from app.firestore.job_runs import JobRunRepository
    from app.firebase_client import get_firestore_client
    from app.services.depreciation_service import run_monthly_depreciation_batch

    started_at = datetime.utcnow().isoformat()
    total_processed = 0
    total_failed = 0
    errors = []

    try:
        logger.info("🏢 Running monthly depreciation job...")
        db = get_firestore_client()

        # Calculate previous month period (YYYY-MM)
        now = datetime.utcnow()
        if now.month == 1:
            prev_month = datetime(now.year - 1, 12, 1)
        else:
            prev_month = datetime(now.year, now.month - 1, 1)
        period = prev_month.strftime("%Y-%m")

        # Scan all organizations
        orgs_ref = db.collection("organizations")
        orgs = list(orgs_ref.stream())

        for org_doc in orgs:
            org_id = org_doc.id
            try:
                result = run_monthly_depreciation_batch(org_id, period)
                total_processed += result["processed"]
                total_failed += result["failed"]
                if result["errors"]:
                    errors.extend([{"org_id": org_id, **e} for e in result["errors"]])
                logger.info(f"Org {org_id}: {result['processed']} assets depreciated, {result['failed']} failed")
            except Exception as e:
                total_failed += 1
                errors.append({"org_id": org_id, "error_msg": str(e)})
                logger.error(f"Error processing org {org_id}: {e}")

        finished_at = datetime.utcnow().isoformat()
        status = "success" if total_failed == 0 else ("partial" if total_processed > 0 else "failed")

        job_run_repo = JobRunRepository("__system__")
        job_run_repo.create_run(
            job_name="monthly_depreciation",
            items_processed=total_processed,
            items_failed=total_failed,
            errors=errors,
            started_at=started_at,
            finished_at=finished_at,
            status=status,
            metadata={"period": period},
        )

        logger.info(f"✅ Monthly depreciation ({period}): {total_processed} processed, {total_failed} failed")

    except Exception as e:
        logger.error(f"❌ Monthly depreciation job failed: {e}")
        job_run_repo = JobRunRepository("__system__")
        job_run_repo.create_run(
            job_name="monthly_depreciation",
            items_processed=total_processed,
            items_failed=total_failed,
            errors=[{"error_msg": str(e)}],
            started_at=started_at,
            finished_at=datetime.utcnow().isoformat(),
            status="failed",
        )


def _job_gdpr_hard_delete():
    """Finalize user deletions whose 30-day grace period has elapsed."""
    from app.services.gdpr_service import hard_delete_due_users

    try:
        logger.info("🔒 Running GDPR hard-delete job...")
        result = hard_delete_due_users()
        logger.info(
            "✅ GDPR hard-delete: %s processed, %s errors",
            result.get("processed", 0),
            len(result.get("errors") or []),
        )
    except Exception as e:
        logger.error("❌ GDPR hard-delete job failed: %s", e)


def _job_einvoice_dispatcher():
    """Retry pending/failed e-invoice submissions (preview/stub safe)."""
    from app.firebase_client import get_firestore_client
    from app.firestore.einvoice import EInvoiceSubmissionRepository

    try:
        logger.info("📨 Running e-invoice dispatcher...")
        db = get_firestore_client()
        processed = 0
        for org_doc in db.collection("organizations").stream():
            org_id = org_doc.id
            repo = EInvoiceSubmissionRepository(org_id)
            items, _ = repo.list(limit=100)
            for sub in items:
                status = sub.get("status") or ""
                retries = int(sub.get("retry_count") or 0)
                if status not in ("generated", "failed", "retry") or retries >= 5:
                    continue
                try:
                    from app.services.einvoice_service import submit_to_portal_stub
                    invoice_id = sub.get("invoice_id")
                    if not invoice_id:
                        continue
                    result = submit_to_portal_stub(org_id, invoice_id, sub)
                    repo.update(sub["id"], {
                        "status": result.get("status", "submitted"),
                        "provider_uuid": result.get("provider_uuid"),
                        "last_dispatch_at": datetime.utcnow().isoformat(),
                        "retry_count": retries + 1,
                    })
                    processed += 1
                except Exception as exc:
                    repo.update(sub["id"], {
                        "status": "failed",
                        "last_error": str(exc),
                        "retry_count": retries + 1,
                        "last_dispatch_at": datetime.utcnow().isoformat(),
                    })
        logger.info("✅ E-invoice dispatcher: %s processed", processed)
    except Exception as e:
        logger.error("❌ E-invoice dispatcher failed: %s", e)


def _job_lot_expiry_alerts():
    """Log lots expiring within 30 days (hook for email/notifications)."""
    from app.firebase_client import get_firestore_client
    from app.services.lot_allocation import LotAllocationService

    try:
        alerts = 0
        db = get_firestore_client()
        for org_doc in db.collection("organizations").stream():
            org_id = org_doc.id
            expiring = LotAllocationService.check_expiring_soon(org_id, days=30)
            alerts += len(expiring)
        logger.info("✅ Lot expiry scan: %s lots expiring within 30 days", alerts)
    except Exception as e:
        logger.error("❌ Lot expiry alerts job failed: %s", e)


def _job_refresh_org_counters():
    """Reconcile denormalized org_counters from streamed invoices/bills."""
    try:
        from app.firebase_client import get_firestore_client
        from app.services.org_counters import refresh_counters_from_stream

        db = get_firestore_client()
        count = 0
        for org_doc in db.collection("organizations").stream():
            refresh_counters_from_stream(org_doc.id)
            count += 1
        logger.info("✅ Org counter refresh: %s organizations", count)
    except Exception as e:
        logger.error("❌ Org counter refresh failed: %s", e)


def _job_soft_delete_purge():
    """Hard-delete soft-deleted documents older than retention (stream_org_docs)."""
    try:
        from app.services.soft_delete_purge import run_scheduled_purge

        removed = run_scheduled_purge()
        logger.info("✅ Soft-delete purge: %s documents removed", removed)
    except Exception as e:
        logger.error("❌ Soft-delete purge failed: %s", e)


def _job_outbox_dispatch():
    """Deliver pending outbox events (Wave I)."""
    try:
        from app.services.outbox_dispatcher import dispatch_pending

        n = dispatch_pending(max_events=100)
        logger.info("✅ Outbox dispatch: %s events", n)
    except Exception as e:
        logger.error("❌ Outbox dispatch failed: %s", e)


def _job_audit_retention():
    """Purge audit logs older than AUDIT_RETENTION_MONTHS (Wave T6)."""
    try:
        from app.config import settings
        from app.firebase_client import get_firestore_client

        months = int(getattr(settings, "AUDIT_RETENTION_MONTHS", 24) or 24)
        cutoff = datetime.utcnow() - timedelta(days=months * 30)
        db = get_firestore_client()
        removed = 0
        for doc in db.collection("audit_logs").limit(5000).stream():
            data = doc.to_dict() or {}
            ts = data.get("created_at") or data.get("timestamp")
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts.replace("Z", "").replace(" ", "T"))
                except ValueError:
                    continue
            if isinstance(ts, datetime) and ts < cutoff:
                doc.reference.delete()
                removed += 1
        logger.info("✅ Audit retention purge: %s logs (>%s mo)", removed, months)
    except Exception as e:
        logger.error("❌ Audit retention failed: %s", e)


def _job_daily_backup():
    """Run daily backup for all organizations.

    Fetches all organizations from Firestore and runs BackupService for each.
    Logs start time, org list, total duration, count backed up, and failures.
    Continues to the next org on per-org failure (never aborts the full run).
    """
    import asyncio
    from app.firebase_client import get_firestore_client
    from app.services.backup_service import BackupService

    started_at = datetime.utcnow()
    logger.info(f"🗄️ Daily backup job started at {started_at.isoformat()}")

    db = get_firestore_client()
    orgs = list(db.collection("organizations").stream())
    org_ids = [doc.id for doc in orgs]
    logger.info(f"🗄️ Daily backup: {len(org_ids)} organizations to back up: {org_ids}")

    backed_up = 0
    failures = []

    for org_id in org_ids:
        try:
            record = asyncio.run(BackupService(org_id).run_backup())
            backed_up += 1
            logger.info(f"✅ Backup completed for org {org_id}: status={record.status}, integrity={record.integrity_status}")
        except Exception as e:
            failures.append(org_id)
            logger.error(f"❌ Backup failed for org {org_id}: {e}")

    duration_seconds = (datetime.utcnow() - started_at).total_seconds()
    logger.info(
        f"🗄️ Daily backup finished in {duration_seconds:.1f}s — "
        f"{backed_up} backed up, {len(failures)} failed"
        + (f": {failures}" if failures else "")
    )


# ═══════════════════════════════════════════════════════════════════════════
# Legacy job implementations (preserved from original)
# ═══════════════════════════════════════════════════════════════════════════

def process_recurring_invoices():
    """Check and generate invoices from recurring templates"""
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
