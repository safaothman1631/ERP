"""Outbox events for exactly-once side effects (Pool 3.3 event bus).

The transactional-outbox pattern: an event is written in the SAME transaction as
the business write that produced it, so it is persisted iff that write commits.
A scheduled worker (``outbox_dispatcher.dispatch_pending``) then delivers it
at-least-once to the registered handlers.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from .base import BaseRepository


class OutboxEventRepository(BaseRepository):
    collection_name = "outbox_events"

    def enqueue(self, event_type: str, payload: dict, *, idempotency_key: str | None = None) -> dict:
        """Non-transactional enqueue (own write). Use ``enqueue_in_transaction``
        to couple the event to a business write."""
        return self.create({
            "event_type": event_type,
            "payload": payload,
            "status": "pending",
            "attempts": 0,
            "next_retry_at": datetime.utcnow(),
            "idempotency_key": idempotency_key,
        })


def build_outbox_event(
    org_id: str, event_type: str, payload: dict, *, idempotency_key: str | None = None,
) -> dict:
    """Pure outbox-event document. ``id`` defaults to ``idempotency_key`` so a
    re-emitted event dedupes to the same doc."""
    now = datetime.utcnow()
    return {
        "id": idempotency_key or str(uuid.uuid4()),
        "org_id": org_id,
        "event_type": event_type,
        "payload": payload,
        "status": "pending",
        "attempts": 0,
        "next_retry_at": now,
        "created_at": now,
        "idempotency_key": idempotency_key,
    }


def enqueue_in_transaction(
    transaction: Any,
    db: Any,
    org_id: str,
    event_type: str,
    payload: dict,
    *,
    idempotency_key: str | None = None,
) -> str:
    """Write an outbox event inside an existing Firestore transaction (so it
    commits atomically with the business write). Returns the event id.

    This is a WRITE — call it AFTER all reads in the transaction (Firestore
    forbids read-after-write). Callers opt in; nothing in the hot JE/invoice path
    enqueues unless explicitly wired + flag-gated."""
    event = build_outbox_event(org_id, event_type, payload, idempotency_key=idempotency_key)
    ref = db.collection("outbox_events").document(event["id"])
    transaction.set(ref, event)
    return event["id"]
