"""Outbox events for exactly-once side effects (Wave I)."""
from __future__ import annotations

from datetime import datetime, timedelta

from .base import BaseRepository


class OutboxEventRepository(BaseRepository):
    collection_name = "outbox_events"

    def enqueue(self, event_type: str, payload: dict) -> dict:
        return self.create({
            "event_type": event_type,
            "payload": payload,
            "status": "pending",
            "attempts": 0,
            "next_retry_at": datetime.utcnow(),
        })
