"""Dispatch pending outbox events (Wave I)."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def dispatch_pending(org_id: str | None = None, max_events: int = 50) -> int:
    from app.firebase_client import get_db

    db = get_db()
    query = db.collection("outbox_events").where("status", "==", "pending").limit(max_events)
    if org_id:
        query = query.where("org_id", "==", org_id)
    dispatched = 0
    now = datetime.utcnow()
    for doc in query.stream():
        data = doc.to_dict() or {}
        next_retry = data.get("next_retry_at")
        if isinstance(next_retry, datetime) and next_retry > now:
            continue
        event_type = data.get("event_type", "")
        try:
            _handle_event(data.get("org_id"), event_type, data.get("payload") or {})
            doc.reference.update({
                "status": "delivered",
                "delivered_at": now,
                "updated_at": now,
            })
            dispatched += 1
        except Exception as exc:
            attempts = int(data.get("attempts") or 0) + 1
            doc.reference.update({
                "status": "pending" if attempts < 5 else "failed",
                "attempts": attempts,
                "last_error": str(exc)[:500],
                "next_retry_at": now + timedelta(minutes=attempts),
                "updated_at": now,
            })
            logger.warning("outbox_dispatch_failed", extra={"event_type": event_type, "error": str(exc)})
    return dispatched


def _handle_event(org_id: str, event_type: str, payload: dict) -> None:
    if event_type == "einvoice_dispatch":
        logger.info("outbox_einvoice_stub", extra={"org_id": org_id, "payload": payload})
        return
    logger.info("outbox_no_handler", extra={"event_type": event_type, "org_id": org_id})
