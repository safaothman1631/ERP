"""
FeatureFlagService — manages feature flags stored in Firestore.

Storage layout:
    feature_flags/{org_id}/{flag_key}  (subcollection per org)

Each flag document contains:
    - key:         str   — unique flag identifier within the org
    - enabled:     bool  — master on/off switch
    - rollout_pct: int   — 0-100, percentage of users to enable for (gradual rollout)
    - description: str   — human-readable description
    - created_at:  datetime
    - updated_at:  datetime
    - org_id:      str   — owning organisation

Gradual rollout:
    When rollout_pct < 100, the flag is evaluated per-user by hashing
    "{org_id}:{flag_key}:{user_id}" and checking whether the resulting
    bucket (0-99) falls below rollout_pct.  This gives a stable, deterministic
    assignment — the same user always gets the same result for a given flag.

Caching:
    Flag values are cached in-process for 60 seconds per (org_id, flag_key)
    to avoid a Firestore round-trip on every request.  The cache is invalidated
    whenever a flag is created, updated, or deleted.
"""
from __future__ import annotations

import hashlib
import time
from threading import Lock
from typing import Any, Dict, List, Optional

from app.firebase_client import get_db

# ── In-process cache ──────────────────────────────────────────────────────────
_CACHE: Dict[str, tuple[float, Optional[Dict[str, Any]]]] = {}
_LOCK = Lock()
_TTL_SECONDS = 60.0

_COLLECTION = "feature_flags"


# ── Internal helpers ──────────────────────────────────────────────────────────

def _cache_key(org_id: str, flag_key: str) -> str:
    return f"{org_id}::{flag_key}"


def _org_collection(org_id: str):
    """Return the Firestore subcollection reference for an org's flags."""
    db = get_db()
    return db.collection(_COLLECTION).document(org_id).collection("flags")


def _doc_to_flag(doc) -> Dict[str, Any]:
    """Convert a Firestore document snapshot to a flag dict."""
    data = doc.to_dict() or {}
    data["id"] = doc.id
    data.setdefault("key", doc.id)
    data.setdefault("enabled", False)
    data.setdefault("rollout_pct", 100)
    data.setdefault("description", "")
    return data


def _invalidate(org_id: str, flag_key: Optional[str] = None) -> None:
    """Drop one flag from cache, or all flags for an org."""
    with _LOCK:
        if flag_key:
            _CACHE.pop(_cache_key(org_id, flag_key), None)
        else:
            prefix = f"{org_id}::"
            for k in list(_CACHE.keys()):
                if k.startswith(prefix):
                    _CACHE.pop(k, None)


# ── Public API ────────────────────────────────────────────────────────────────

def get_flag(org_id: str, flag_key: str) -> Optional[Dict[str, Any]]:
    """Return the flag document for (org_id, flag_key), or None if not found.

    Result is cached for _TTL_SECONDS.
    """
    ck = _cache_key(org_id, flag_key)
    now = time.time()
    with _LOCK:
        cached = _CACHE.get(ck)
        if cached and (now - cached[0]) < _TTL_SECONDS:
            return cached[1]

    col = _org_collection(org_id)
    doc = col.document(flag_key).get()
    flag = _doc_to_flag(doc) if doc.exists else None

    with _LOCK:
        _CACHE[ck] = (now, flag)
    return flag


def list_flags(org_id: str) -> List[Dict[str, Any]]:
    """Return all feature flags for an organisation, sorted by key."""
    col = _org_collection(org_id)
    docs = col.stream()
    flags = [_doc_to_flag(d) for d in docs]
    flags.sort(key=lambda f: f.get("key", ""))
    return flags


def set_flag(
    org_id: str,
    flag_key: str,
    enabled: bool,
    rollout_pct: int = 100,
    description: str = "",
) -> Dict[str, Any]:
    """Create or update a feature flag.

    Args:
        org_id:      Organisation identifier.
        flag_key:    Unique flag name within the org (e.g. "new_dashboard").
        enabled:     Master on/off switch.
        rollout_pct: 0-100 percentage for gradual rollout.  Defaults to 100.
        description: Human-readable description.

    Returns:
        The saved flag document.
    """
    if not 0 <= rollout_pct <= 100:
        raise ValueError(f"rollout_pct must be 0-100, got {rollout_pct}")

    from datetime import datetime

    col = _org_collection(org_id)
    doc_ref = col.document(flag_key)
    existing = doc_ref.get()

    now = datetime.utcnow()
    payload: Dict[str, Any] = {
        "key": flag_key,
        "enabled": bool(enabled),
        "rollout_pct": int(rollout_pct),
        "description": description,
        "org_id": org_id,
        "updated_at": now,
    }

    if existing.exists:
        doc_ref.update(payload)
    else:
        payload["created_at"] = now
        doc_ref.set(payload)

    _invalidate(org_id, flag_key)
    return get_flag(org_id, flag_key) or payload


def delete_flag(org_id: str, flag_key: str) -> bool:
    """Delete a feature flag.  Returns True if it existed, False otherwise."""
    col = _org_collection(org_id)
    doc_ref = col.document(flag_key)
    if not doc_ref.get().exists:
        return False
    doc_ref.delete()
    _invalidate(org_id, flag_key)
    return True


def is_enabled(org_id: str, flag_key: str, user_id: str = "") -> bool:
    """Evaluate whether a feature flag is active for a specific user.

    Evaluation rules:
    1. If the flag does not exist → False (fail-closed).
    2. If flag.enabled is False → False.
    3. If flag.rollout_pct == 100 → True.
    4. If flag.rollout_pct == 0 → False.
    5. Otherwise hash "{org_id}:{flag_key}:{user_id}" and check bucket < rollout_pct.
       If user_id is empty, treat as bucket 0 (always enabled when pct > 0).

    Args:
        org_id:   Organisation identifier.
        flag_key: Flag name.
        user_id:  Optional user identifier for gradual rollout bucketing.

    Returns:
        True if the flag is active for this user, False otherwise.
    """
    flag = get_flag(org_id, flag_key)
    if flag is None:
        return False
    if not flag.get("enabled", False):
        return False

    pct = int(flag.get("rollout_pct", 100))
    if pct >= 100:
        return True
    if pct <= 0:
        return False

    # Stable per-user bucket: 0-99
    if not user_id:
        return True  # no user context → treat as enabled when pct > 0

    raw = f"{org_id}:{flag_key}:{user_id}".encode()
    bucket = int(hashlib.sha256(raw).hexdigest(), 16) % 100
    return bucket < pct


def invalidate_all() -> None:
    """Drop entire cache.  Use only in tests or admin reset."""
    with _LOCK:
        _CACHE.clear()
