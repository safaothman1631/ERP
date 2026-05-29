"""APScheduler-driven worker that drains the e-Fakhata submission queue.

Polling interval: 30 seconds (registered in ``app/services/scheduler.py``
when this module is wired in; until then it can be invoked manually for
tests and ad-hoc operator runs).

Per-tick algorithm:

    for tenant in tenants_with_pending_submissions():
        for submission in queue.list_due(batch_size=50):
            try:
                queue.mark_submitting(submission.id)
                ack = mof_client.submit_invoice(...)
                queue.mark_submitted(submission.id, ack_number=ack.ack_number)
            except MoFRejected as e:
                queue.mark_rejected(submission.id, ...)
            except MoFTransient as e:
                queue.mark_failed(submission.id, ...)  # auto-schedules retry
            except MoFNotConfigured:
                break  # leave pending; alert ops

The worker is intentionally tenant-aware so a misconfigured tenant
doesn't poison the queue for healthy tenants.
"""
from __future__ import annotations

import logging
import os
from typing import Iterable, Optional

from app.efakhata import submission_queue as q
from app.efakhata.mof_client import (
    MoFClient,
    MoFNotConfigured,
    MoFRejected,
    MoFTransient,
)
from app.efakhata.submission_queue import SubmissionQueueRepository

logger = logging.getLogger(__name__)


BATCH_SIZE = 50
POLL_SECONDS = 30


def process_tenant_queue(
    tenant_id: str,
    *,
    client: Optional[MoFClient] = None,
    repo: Optional[SubmissionQueueRepository] = None,
    batch_size: int = BATCH_SIZE,
) -> dict:
    """Drain one tenant's queue. Returns a counters dict for ops dashboards."""
    repo = repo or SubmissionQueueRepository(tenant_id)
    counters = {
        "processed": 0,
        "submitted": 0,
        "rejected": 0,
        "failed": 0,
        "skipped_not_configured": 0,
    }

    try:
        client = client or MoFClient(tenant_id=tenant_id)
    except MoFNotConfigured:
        # No base URL configured — return early; nothing to do.
        counters["skipped_not_configured"] = 1
        return counters

    due = repo.list_due(batch_size=batch_size)
    for submission in due:
        sid = submission["id"]
        counters["processed"] += 1
        try:
            repo.mark_submitting(sid)
            ack = client.submit_invoice(
                xml_signed=submission["xml_signed"].encode("utf-8"),
                idempotency_key=sid,
            )
            repo.mark_submitted(sid, ack_number=ack.ack_number)
            counters["submitted"] += 1
        except MoFRejected as exc:
            repo.mark_rejected(sid, error_code=exc.code, error_message=exc.message)
            counters["rejected"] += 1
        except MoFNotConfigured as exc:
            # Mid-batch config loss — stop tightly, leave remainder pending.
            logger.warning("mof_not_configured_mid_batch",
                           extra={"tenant_id": tenant_id, "error": str(exc)})
            counters["skipped_not_configured"] += 1
            break
        except MoFTransient as exc:
            repo.mark_failed(sid, error_code="transient", error_message=str(exc))
            counters["failed"] += 1
        except Exception as exc:
            # Unknown failure — record but don't crash worker.
            logger.exception("mof_worker_unknown_error", extra={"sid": sid})
            repo.mark_failed(sid, error_code="unknown", error_message=str(exc))
            counters["failed"] += 1

    return counters


def run_once(tenants: Optional[Iterable[str]] = None) -> dict:
    """Cron-tick entrypoint. Iterates over every tenant or the given subset."""
    if tenants is None:
        tenants = _list_active_tenant_ids()
    summary = {"tenants": 0, "submitted": 0, "rejected": 0, "failed": 0}
    for tid in tenants:
        c = process_tenant_queue(tid)
        summary["tenants"] += 1
        summary["submitted"] += c["submitted"]
        summary["rejected"] += c["rejected"]
        summary["failed"] += c["failed"]
    return summary


def _list_active_tenant_ids() -> list[str]:
    """Best-effort list of active tenant org_ids.

    The codebase already has a multi-entity ``companies`` repo; we read
    from it if importable, otherwise honour a single-tenant default via
    the ``DEFAULT_TENANT_ID`` env var so the worker stays useful in dev.
    """
    try:
        from google.cloud import firestore as fs  # type: ignore
        from app.firebase_client import get_db

        db = get_db()
        ids: list[str] = []
        for doc in db.collection("organizations").stream():
            data = doc.to_dict() or {}
            if data.get("is_active", True):
                ids.append(doc.id)
        if ids:
            return ids
    except Exception:
        pass

    fallback = os.environ.get("DEFAULT_TENANT_ID")
    return [fallback] if fallback else []
