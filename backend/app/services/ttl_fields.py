"""TTL helpers — Firestore requires ``expires_at`` as datetime (Wave T)."""
from __future__ import annotations

from datetime import datetime, timedelta

# Hours until document expiry per collection (must match firestore.indexes.json TTL groups)
COLLECTION_TTL_HOURS: dict[str, int] = {
    "sessions": 24 * 7,
    "rate_limit_buckets": 2,
    "ocr_cache": 24,
    "webhook_inbox": 24 * 7,
    "receipt_scans": 24 * 7,
    "revoked_tokens": 24 * 8,
    "idempotency_keys": 24,
}


def expires_at_from_hours(hours: int) -> datetime:
    return datetime.utcnow() + timedelta(hours=hours)


def expires_at_for_collection(collection: str) -> datetime | None:
    hours = COLLECTION_TTL_HOURS.get(collection)
    if hours is None:
        return None
    return expires_at_from_hours(hours)


def attach_ttl_fields(collection: str, data: dict) -> dict:
    exp = expires_at_for_collection(collection)
    if exp is not None:
        data = {**data, "expires_at": exp}
    return data
