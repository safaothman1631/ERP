"""Public-API key repository (Pool 3.6 — public gateway).

Stores API keys issued to third-party integrations. The plaintext key is
returned **once** at creation time and never persisted — only a SHA-256 hash
plus a short, non-secret prefix (for display/lookup) are stored.

Document shape (collection ``api_keys``):
    id            str        Firestore doc id
    org_id        str        owning org (BaseRepository scopes every read)
    name          str        human label ("Zapier prod")
    key_prefix    str        first chars of the plaintext key, e.g. "pk_a1b2c3"
    key_hash      str        sha256 hex of the full plaintext key
    scopes        list[str]  granted read scopes (e.g. ["contacts", "items"])
    is_active     bool       revoked keys are flipped to False
    created_at    datetime
    last_used_at  datetime | None
"""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime
from typing import Optional

from app.firestore.base import BaseRepository

# Visible, non-secret prefix carried on every key so list views and the
# deterministic lookup have something to key on without exposing the secret.
_KEY_PREFIX = "pk_"
# Characters of the random body kept in ``key_prefix`` (after ``pk_``).
_PREFIX_BODY_LEN = 6


def _hash_key(plaintext: str) -> str:
    """Return the lowercase sha256 hex digest of a plaintext key."""
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def _mask(record: dict) -> dict:
    """Return a copy of ``record`` safe to expose (never includes the hash)."""
    out = {k: v for k, v in record.items() if k != "key_hash"}
    prefix = record.get("key_prefix") or ""
    out["key_masked"] = f"{prefix}{'•' * 8}"
    return out


class ApiKeyRepository(BaseRepository):
    """Repository for third-party public-API keys."""

    collection_name = "api_keys"

    def generate_key(self) -> tuple[str, str]:
        """Return ``(plaintext, key_prefix)`` for a fresh random key.

        The plaintext is high-entropy (URL-safe) and is the only time the full
        secret exists; callers must hand it to the user and discard it.
        """
        body = secrets.token_urlsafe(32)
        plaintext = f"{_KEY_PREFIX}{body}"
        key_prefix = f"{_KEY_PREFIX}{body[:_PREFIX_BODY_LEN]}"
        return plaintext, key_prefix

    def create(self, name: str, scopes: Optional[list[str]] = None) -> dict:
        """Create an API key and return the stored record PLUS the one-time plaintext.

        The returned dict carries an extra ``plaintext_key`` field that is NOT
        persisted — it is the only opportunity to read the secret.
        """
        plaintext, key_prefix = self.generate_key()
        payload = {
            "id": str(uuid.uuid4()),
            "name": (name or "").strip() or "API Key",
            "key_prefix": key_prefix,
            "key_hash": _hash_key(plaintext),
            "scopes": [str(s) for s in (scopes or [])],
            "is_active": True,
        }
        record = super().create(payload)
        masked = _mask(record)
        masked["plaintext_key"] = plaintext  # one-time only — never re-readable
        return masked

    def verify(self, plaintext: str) -> Optional[dict]:
        """Return the active key record for ``plaintext`` or ``None``.

        Resolution is deterministic: derive the public prefix from the plaintext,
        fetch only the (org-scoped) keys sharing that prefix, then constant-time
        compare the stored hash. Best-effort stamps ``last_used_at``.
        """
        if not plaintext or not plaintext.startswith(_KEY_PREFIX):
            return None
        body = plaintext[len(_KEY_PREFIX):]
        if len(body) < _PREFIX_BODY_LEN:
            return None
        key_prefix = f"{_KEY_PREFIX}{body[:_PREFIX_BODY_LEN]}"
        candidates, _ = self.list(
            filters=[{"field": "key_prefix", "op": "==", "value": key_prefix}],
            limit=25,
        )
        target_hash = _hash_key(plaintext)
        for rec in candidates:
            if not rec.get("is_active", False):
                continue
            if secrets.compare_digest(str(rec.get("key_hash", "")), target_hash):
                self._touch(rec["id"])
                return rec
        return None

    def _touch(self, key_id: str) -> None:
        """Best-effort update of ``last_used_at`` — never fails the request."""
        try:
            self.collection.document(key_id).update({"last_used_at": datetime.utcnow()})
        except Exception:
            pass

    def list_masked(self) -> list[dict]:
        """List the org's keys with the hash removed and a masked display value."""
        items, _ = self.list(order_by="created_at", order_dir="DESCENDING", limit=200)
        return [_mask(rec) for rec in items]

    def revoke(self, key_id: str) -> Optional[dict]:
        """Deactivate a key (soft revoke). Returns the masked record or ``None``."""
        existing = self.get(key_id)
        if not existing:
            return None
        updated = self.update(key_id, {"is_active": False})
        return _mask(updated) if updated else None
