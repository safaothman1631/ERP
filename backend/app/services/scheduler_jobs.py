"""APScheduler job definitions for P4 housekeeping.

Three jobs:

1. ``hard_delete_expired_tenants`` — every 24h. Permanently removes documents
   under tenants soft-deleted more than 30 days ago.
2. ``verify_backup_freshness`` — every 6h. Reads the ``backups`` collection
   and raises if the latest entry is older than 24h (alerts via Sentry).
3. ``cleanup_old_audit_logs`` — monthly. Trims ``audit_logs`` to the most
   recent 18 months.

Each job emits structured log events so we can see runs in Cloud Logging.

Wiring
------
Register the jobs from ``main.py`` lifespan startup::

    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from app.services.scheduler_jobs import register_jobs

    scheduler = AsyncIOScheduler()
    register_jobs(scheduler)
    scheduler.start()
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.api.admin.pii_delete import GRACE_DAYS
from app.firestore.client import get_async_client

log = logging.getLogger("services.scheduler_jobs")


# Retain audit logs this many months (R7 / SOX-equivalent).
AUDIT_LOG_RETENTION_MONTHS: int = 18

# Verification threshold for backup freshness.
BACKUP_MAX_AGE_HOURS: int = 24


# ── Job 1: hard-delete expired soft-deleted tenants ─────────────────────────


async def hard_delete_expired_tenants() -> dict[str, Any]:
    """Hard-delete tenants whose ``deleted_at`` is older than GRACE_DAYS.

    Returns a summary dict (used by tests and the job-run audit trail).
    """
    started = datetime.now(timezone.utc)
    cutoff = started - timedelta(days=GRACE_DAYS)
    client = get_async_client()

    tenants_deleted = 0
    docs_deleted = 0
    errors = 0

    log.info(
        "scheduler.hard_delete.start",
        extra={"cutoff": cutoff.isoformat()},
    )

    try:
        # Find soft-deleted tenants past the grace window.
        query = client.collection("tenants").where("deleted_at", "<=", cutoff)
        async for snap in query.stream():
            tenant_id = snap.id
            try:
                # Delete all subcollections, then the root.
                tenant_ref = snap.reference
                try:
                    async for sub in tenant_ref.collections():  # type: ignore[attr-defined]
                        async for doc in sub.stream():
                            await doc.reference.delete()
                            docs_deleted += 1
                except Exception as e:  # noqa: BLE001
                    log.warning(
                        "scheduler.hard_delete.subcoll_failed",
                        extra={"tenant_id": tenant_id, "err": str(e)},
                    )
                    errors += 1
                await tenant_ref.delete()
                docs_deleted += 1
                tenants_deleted += 1
                log.info(
                    "scheduler.hard_delete.tenant",
                    extra={"tenant_id": tenant_id, "docs_deleted": docs_deleted},
                )
            except Exception as e:  # noqa: BLE001
                errors += 1
                log.warning(
                    "scheduler.hard_delete.tenant_failed",
                    extra={"tenant_id": tenant_id, "err": str(e)},
                )
    except Exception as e:  # noqa: BLE001
        log.exception("scheduler.hard_delete.query_failed", extra={"err": str(e)})
        errors += 1

    finished = datetime.now(timezone.utc)
    summary = {
        "job": "hard_delete_expired_tenants",
        "started_at": started.isoformat(),
        "finished_at": finished.isoformat(),
        "tenants_deleted": tenants_deleted,
        "docs_deleted": docs_deleted,
        "errors": errors,
        "duration_s": (finished - started).total_seconds(),
    }
    log.info("scheduler.hard_delete.complete", extra=summary)
    return summary


# ── Job 2: verify backup freshness ─────────────────────────────────────────


class BackupFreshnessError(RuntimeError):
    """Raised when no recent backup record exists."""


async def verify_backup_freshness() -> dict[str, Any]:
    """Read the most recent ``backups`` entry; raise if too old.

    A ``backups`` document is expected to have a ``completed_at`` (timestamp)
    and a ``status: 'ok'`` field, written by the nightly backup workflow.
    """
    started = datetime.now(timezone.utc)
    cutoff = started - timedelta(hours=BACKUP_MAX_AGE_HOURS)
    client = get_async_client()

    log.info("scheduler.backup_check.start", extra={"cutoff": cutoff.isoformat()})

    latest: Optional[dict] = None
    try:
        async for snap in (
            client.collection("backups")
            .where("status", "==", "ok")
            .order_by("completed_at", direction="DESCENDING")
            .limit(1)
            .stream()
        ):
            d = snap.to_dict() or {}
            d["_id"] = snap.id
            latest = d
            break
    except Exception as e:  # noqa: BLE001
        log.exception("scheduler.backup_check.query_failed", extra={"err": str(e)})
        raise BackupFreshnessError(f"could not query backups: {e}") from e

    if latest is None:
        log.error("scheduler.backup_check.no_records")
        raise BackupFreshnessError("no backup records found")

    completed_at = latest.get("completed_at")
    if isinstance(completed_at, str):
        try:
            completed_at = datetime.fromisoformat(completed_at)
        except ValueError:
            completed_at = None

    if completed_at is None:
        log.error(
            "scheduler.backup_check.no_completed_at",
            extra={"backup_id": latest.get("_id")},
        )
        raise BackupFreshnessError("latest backup lacks completed_at")

    if completed_at.tzinfo is None:
        completed_at = completed_at.replace(tzinfo=timezone.utc)

    if completed_at < cutoff:
        age_hours = (started - completed_at).total_seconds() / 3600
        log.error(
            "scheduler.backup_check.stale",
            extra={
                "backup_id": latest.get("_id"),
                "completed_at": completed_at.isoformat(),
                "age_hours": age_hours,
            },
        )
        raise BackupFreshnessError(
            f"latest backup is {age_hours:.1f}h old (max {BACKUP_MAX_AGE_HOURS}h)"
        )

    summary = {
        "job": "verify_backup_freshness",
        "started_at": started.isoformat(),
        "latest_backup_id": latest.get("_id"),
        "completed_at": completed_at.isoformat(),
        "age_hours": (started - completed_at).total_seconds() / 3600,
        "status": "ok",
    }
    log.info("scheduler.backup_check.complete", extra=summary)
    return summary


# ── Job 3: cleanup old audit logs ──────────────────────────────────────────


async def cleanup_old_audit_logs() -> dict[str, Any]:
    """Delete audit logs older than the retention window (default 18 months)."""
    started = datetime.now(timezone.utc)
    cutoff = started - timedelta(days=AUDIT_LOG_RETENTION_MONTHS * 30)
    client = get_async_client()

    log.info(
        "scheduler.audit_cleanup.start",
        extra={"cutoff": cutoff.isoformat(), "retention_months": AUDIT_LOG_RETENTION_MONTHS},
    )

    deleted = 0
    errors = 0
    try:
        query = (
            client.collection("audit_logs")
            .where("ts", "<", cutoff)
            .limit(500)  # batch through; APScheduler retriggers monthly
        )
        async for snap in query.stream():
            try:
                await snap.reference.delete()
                deleted += 1
            except Exception as e:  # noqa: BLE001
                errors += 1
                log.warning(
                    "scheduler.audit_cleanup.delete_failed",
                    extra={"doc_id": snap.id, "err": str(e)},
                )
    except Exception as e:  # noqa: BLE001
        log.exception("scheduler.audit_cleanup.query_failed", extra={"err": str(e)})
        errors += 1

    finished = datetime.now(timezone.utc)
    summary = {
        "job": "cleanup_old_audit_logs",
        "started_at": started.isoformat(),
        "finished_at": finished.isoformat(),
        "deleted": deleted,
        "errors": errors,
        "duration_s": (finished - started).total_seconds(),
    }
    log.info("scheduler.audit_cleanup.complete", extra=summary)
    return summary


# ── Registration helper ────────────────────────────────────────────────────


def register_jobs(scheduler: Any) -> list[str]:
    """Attach all three jobs to an APScheduler instance.

    Args:
        scheduler: an ``AsyncIOScheduler`` (or compatible) instance.

    Returns:
        A list of registered job ids — for assertion in tests / startup logs.
    """
    job_ids: list[str] = []

    scheduler.add_job(
        hard_delete_expired_tenants,
        trigger="interval",
        hours=24,
        id="hard_delete_expired_tenants",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )
    job_ids.append("hard_delete_expired_tenants")

    scheduler.add_job(
        verify_backup_freshness,
        trigger="interval",
        hours=6,
        id="verify_backup_freshness",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=600,
    )
    job_ids.append("verify_backup_freshness")

    scheduler.add_job(
        cleanup_old_audit_logs,
        trigger="cron",
        day=1,  # first day of every month
        hour=3,
        minute=0,
        id="cleanup_old_audit_logs",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )
    job_ids.append("cleanup_old_audit_logs")

    log.info("scheduler.jobs_registered", extra={"jobs": job_ids})
    return job_ids


__all__ = [
    "hard_delete_expired_tenants",
    "verify_backup_freshness",
    "cleanup_old_audit_logs",
    "register_jobs",
    "BackupFreshnessError",
    "AUDIT_LOG_RETENTION_MONTHS",
    "BACKUP_MAX_AGE_HOURS",
]
