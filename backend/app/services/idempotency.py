"""Idempotency key store for replay-safe mutations (POS offline sync, payments).

Firestore TTL is configured on ``idempotency_keys.expires_at`` (see
``firestore.indexes.json`` → ``fieldOverrides``). For TTL to actually fire,
``expires_at`` MUST be stored as a Firestore Timestamp — i.e. a Python
``datetime``, NOT an isoformat string. This module normalises both legacy
string values and new datetime values on read.

Default retention: 24 hours from creation (Wave T / requirement T1).
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional

from app.firebase_client import get_db

COLLECTION = "idempotency_keys"

DEFAULT_TTL_HOURS = 24


def _doc_id(org_id: str, scope: str, key: str) -> str:
    safe = key.replace("/", "_")[:120]
    return f"{org_id}_{scope}_{safe}"


def _expires_at_default() -> datetime:
    return datetime.utcnow() + timedelta(hours=DEFAULT_TTL_HOURS)


def _coerce_expires_at(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "").replace(" ", "T"))
        except ValueError:
            return None
    return None


def get_cached_response(org_id: str, scope: str, key: str) -> Optional[dict[str, Any]]:
    db = get_db()
    doc = db.collection(COLLECTION).document(_doc_id(org_id, scope, key)).get()
    if not doc.exists:
        return None
    data = doc.to_dict() or {}
    expires = _coerce_expires_at(data.get("expires_at"))
    if expires and expires < datetime.utcnow():
        return None
    return data.get("response")


def store_response(
    org_id: str,
    scope: str,
    key: str,
    response: dict[str, Any],
    *,
    ttl_hours: int = DEFAULT_TTL_HOURS,
    ttl_days: Optional[int] = None,  # backwards-compat shim
) -> None:
    """Persist an idempotency response with a Firestore-TTL datetime field."""
    db = get_db()
    now = datetime.utcnow()
    if ttl_days is not None:
        expires_at = now + timedelta(days=ttl_days)
    else:
        expires_at = now + timedelta(hours=ttl_hours)
    db.collection(COLLECTION).document(_doc_id(org_id, scope, key)).set({
        "org_id": org_id,
        "scope": scope,
        "key": key,
        "response": response,
        "created_at": now,
        "expires_at": expires_at,
    })


class IdempotencyService:
    """Thin OO wrapper around the idempotency key store.

    Used by middleware and tests (Wave I depends on this). All writes go through
    ``create_key`` which guarantees ``expires_at`` is set to a non-null
    ``datetime`` so Firestore TTL can reap stale entries.
    """

    def __init__(self, org_id: str):
        self.org_id = org_id
        self.db = get_db()
        self.collection = self.db.collection(COLLECTION)

    def _doc_ref(self, scope: str, key: str):
        return self.collection.document(_doc_id(self.org_id, scope, key))

    def create_key(
        self,
        scope: str,
        key: str,
        *,
        body_hash: Optional[str] = None,
        ttl_hours: int = DEFAULT_TTL_HOURS,
        response: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Insert an idempotency key with ``expires_at`` populated.

        Returns the persisted document dict.
        """
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=ttl_hours)
        doc = {
            "org_id": self.org_id,
            "scope": scope,
            "key": key,
            "body_hash": body_hash,
            "response": response,
            "created_at": now,
            "expires_at": expires_at,
            "status": "in_flight" if response is None else "completed",
        }
        self._doc_ref(scope, key).set(doc)
        return doc

    def get(self, scope: str, key: str) -> Optional[dict[str, Any]]:
        snap = self._doc_ref(scope, key).get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        expires = _coerce_expires_at(data.get("expires_at"))
        if expires and expires < datetime.utcnow():
            return None
        return data

    def complete(self, scope: str, key: str, response: dict[str, Any]) -> None:
        self._doc_ref(scope, key).update({
            "response": response,
            "status": "completed",
            "completed_at": datetime.utcnow(),
        })
