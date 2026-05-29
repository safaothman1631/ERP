"""Audit log hash-chain helpers."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any, Optional


GENESIS_HASH = "0" * 64


def compute_audit_hash(
    *,
    org_id: str,
    user_id: Optional[str],
    method: str,
    path: str,
    action: str,
    entity_type: str,
    entity_id: Optional[str],
    prev_hash: str,
    timestamp: datetime,
) -> str:
    payload = {
        "org_id": org_id,
        "user_id": user_id,
        "method": method,
        "path": path,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "prev_hash": prev_hash,
        "timestamp": timestamp.isoformat(),
    }
    raw = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def verify_audit_chain(entries: list[dict]) -> dict:
    """Verify hash chain over entries sorted ascending by created_at/timestamp."""
    sorted_entries = sorted(
        entries,
        key=lambda e: str(e.get("created_at") or e.get("timestamp") or ""),
    )
    prev = GENESIS_HASH
    broken_at = None
    for entry in sorted_entries:
        expected = compute_audit_hash(
            org_id=entry.get("org_id", ""),
            user_id=entry.get("user_id"),
            method=entry.get("method", ""),
            path=entry.get("path", ""),
            action=entry.get("action", ""),
            entity_type=entry.get("entity_type", ""),
            entity_id=entry.get("entity_id"),
            prev_hash=prev,
            timestamp=_coerce_ts(entry.get("created_at") or entry.get("timestamp")),
        )
        if entry.get("hash") != expected:
            broken_at = entry.get("id")
            break
        if entry.get("prev_hash") != prev:
            broken_at = entry.get("id")
            break
        prev = entry.get("hash") or prev
    return {
        "valid": broken_at is None,
        "broken_at": broken_at,
        "checked": len(sorted_entries),
    }


def _coerce_ts(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")[:26])
        except ValueError:
            pass
    return datetime.utcnow()
