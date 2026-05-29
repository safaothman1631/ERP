"""Grace-period finalizer for tenant erasure requests (T-SF.2.22).

Companion to :mod:`app.services.data_rights_service`. Confirming an erasure
request does not delete anything immediately — it schedules a hard delete after
the 30-day grace window (:data:`app.services.gdpr_service.GRACE_DAYS`). This
module performs the destruction once that window elapses and is wired into the
APScheduler the same way :func:`app.services.gdpr_service.hard_delete_due_users`
is (see ``app.services.scheduler``).

Cross-org job: it scans the ``data_rights_requests`` collection across all orgs
for ``status="scheduled"`` rows whose ``scheduled_purge_at`` is in the past, then
hard-deletes every org-scoped document for that organization.

Destruction model
-----------------
For each due request we stream every exportable collection for the org and hard
delete the documents via the raw Firestore reference (bypassing
``BaseRepository.delete``'s reference-guard, which is intended for interactive
deletes — a right-to-be-forgotten purge must not be blocked by FK references).
The originating request row is itself preserved as a tamper-evident audit record
(its ``status`` becomes ``completed`` with ``purged_at`` + ``documents_purged``).
"""
from __future__ import annotations

import logging
from datetime import datetime

from app.firebase_client import get_db
from app.firestore.data_rights_repo import DataRightsRequestRepository
from app.services.data_rights_service import (
    ERASURE_COMPLETED,
    ERASURE_SCHEDULED,
    EXPORTABLE_COLLECTIONS,
)

logger = logging.getLogger(__name__)


def _hard_delete_org_documents(org_id: str) -> int:
    """Hard-delete every exportable document belonging to ``org_id``.

    Returns the number of documents removed. Iterates in batches keyed by
    ``org_id`` so we never touch another tenant's data.
    """
    db = get_db()
    removed = 0
    for name in EXPORTABLE_COLLECTIONS:
        try:
            query = db.collection(name).where("org_id", "==", org_id)
            last_doc = None
            while True:
                q = query.limit(300)
                if last_doc is not None:
                    q = q.start_after(last_doc)
                batch = list(q.stream())
                if not batch:
                    break
                for doc in batch:
                    # Best-effort subcollection cleanup (e.g. invoice lines).
                    try:
                        for subcol in doc.reference.collections():
                            for subdoc in subcol.stream():
                                subdoc.reference.delete()
                    except Exception:  # noqa: BLE001
                        pass
                    doc.reference.delete()
                    removed += 1
                last_doc = batch[-1]
                if len(batch) < 300:
                    break
        except Exception as exc:  # noqa: BLE001 — one collection failing must not abort the purge
            logger.warning(
                "data_rights.purge.collection_failed",
                extra={"org_id": org_id, "collection": name, "error": str(exc)},
            )
            continue
    return removed


def run_due_erasures() -> dict:
    """Finalize every scheduled erasure whose grace period has elapsed.

    Designed for the APScheduler. Never raises — returns a summary dict.
    """
    db = get_db()
    now_iso = datetime.utcnow().isoformat()
    processed = 0
    errors: list[dict] = []

    try:
        docs = (
            db.collection("data_rights_requests")
            .where("kind", "==", "erasure")
            .where("status", "==", ERASURE_SCHEDULED)
            .limit(200)
            .stream()
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("data_rights.purge.scan_failed: %s", exc)
        return {"processed": 0, "errors": [{"error": str(exc)}]}

    for doc in docs:
        data = doc.to_dict() or {}
        org_id = data.get("org_id")
        request_id = doc.id
        scheduled = data.get("scheduled_purge_at") or ""
        if not org_id:
            continue
        if scheduled and scheduled > now_iso:
            continue  # grace period not yet elapsed
        try:
            count = _hard_delete_org_documents(org_id)
            DataRightsRequestRepository(org_id).update(request_id, {
                "status": ERASURE_COMPLETED,
                "purged_at": datetime.utcnow().isoformat(),
                "documents_purged": count,
            })
            processed += 1
            logger.info(
                "data_rights.purge.completed",
                extra={"org_id": org_id, "request_id": request_id, "documents": count},
            )
        except Exception as exc:  # noqa: BLE001
            errors.append({"request_id": request_id, "org_id": org_id, "error": str(exc)})
            logger.error("data_rights.purge.failed for %s: %s", request_id, exc)

    return {"processed": processed, "errors": errors}
