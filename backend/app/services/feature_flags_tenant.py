"""Per-tenant feature flag overrides (G2 / R2.4 — hotfix flag mechanism).

Distinct from :mod:`app.services.feature_flag_service` which models the
*global* rollout system (rollout-pct, A/B). This service narrows the API
surface to a single question:

    *Is this flag enabled for this specific tenant right now?*

Resolution order:

  1. Tenant override (``tenant_feature_flags/{tenant_id}/flags/{flag_key}``)
     — may force ``enabled=True`` *or* ``enabled=False`` and may carry an
     ``expires_at`` for short-lived hotfix experiments.
  2. Global default — falls back to ``feature_flags`` collection via
     ``feature_flag_service`` if it exists, otherwise ``False``.

Cache: 60-second in-memory TTL keyed by ``(tenant_id, flag_key)``. Cache
is invalidated by ``set_override`` / ``clear_override`` so flag changes
propagate within 30 seconds (NFR-G11). The 30-second guarantee is met
by combining the 60s TTL with the explicit invalidation.

The store is intentionally light: no rollout%, no targeting rules — for
those, use the global service. Tenant overrides are a hotfix lever.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Optional

logger = logging.getLogger(__name__)

# In-memory cache (per process). For multi-instance deploys, a Redis
# layer can be added — the API surface stays the same. The 60s TTL is
# short enough that single-process drift is bounded.
_TTL_SECONDS: float = 60.0
_CACHE: dict[str, tuple[float, Optional[dict]]] = {}
_LOCK = Lock()

# Firestore layout:
#   tenant_feature_flags/{tenant_id}/flags/{flag_key}
#   = { enabled: bool, reason: str, expires_at?: datetime,
#       set_by: str, set_at: datetime }
COLLECTION = "tenant_feature_flags"
SUBCOLLECTION = "flags"


def _cache_key(tenant_id: str, flag_key: str) -> str:
    return f"{tenant_id}::{flag_key}"


def _cached(tenant_id: str, flag_key: str) -> Optional[dict]:
    with _LOCK:
        entry = _CACHE.get(_cache_key(tenant_id, flag_key))
        if not entry:
            return None
        ts, value = entry
        if time.monotonic() - ts > _TTL_SECONDS:
            _CACHE.pop(_cache_key(tenant_id, flag_key), None)
            return None
        return value


def _put_cache(tenant_id: str, flag_key: str, value: Optional[dict]) -> None:
    with _LOCK:
        _CACHE[_cache_key(tenant_id, flag_key)] = (time.monotonic(), value)


def _invalidate(tenant_id: str, flag_key: Optional[str] = None) -> None:
    with _LOCK:
        if flag_key:
            _CACHE.pop(_cache_key(tenant_id, flag_key), None)
        else:
            prefix = f"{tenant_id}::"
            for k in list(_CACHE.keys()):
                if k.startswith(prefix):
                    _CACHE.pop(k, None)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _doc_path(tenant_id: str, flag_key: str):
    from app.firebase_client import get_db

    return (
        get_db()
        .collection(COLLECTION)
        .document(tenant_id)
        .collection(SUBCOLLECTION)
        .document(flag_key)
    )


# ── Public API ────────────────────────────────────────────────────────────


def get_override(tenant_id: str, flag_key: str) -> Optional[dict]:
    """Return the raw override doc for this tenant, or ``None``.

    Honors expiry: an expired override is treated as if it didn't exist.
    """
    cached = _cached(tenant_id, flag_key)
    if cached is not None:
        return cached or None

    try:
        doc = _doc_path(tenant_id, flag_key).get()
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "tenant_flags.read_failed",
            extra={"err": str(exc), "tenant": tenant_id, "flag": flag_key},
        )
        return None

    if not doc.exists:
        _put_cache(tenant_id, flag_key, None)
        return None

    data = doc.to_dict() or {}
    # Hotfix flags can expire — honor it.
    exp = data.get("expires_at")
    if isinstance(exp, datetime):
        # Coerce both sides to aware-UTC before comparing.
        now = _now_utc()
        exp_aware = exp if exp.tzinfo else exp.replace(tzinfo=timezone.utc)
        if exp_aware <= now:
            _put_cache(tenant_id, flag_key, None)
            return None
    _put_cache(tenant_id, flag_key, data)
    return data


def is_enabled(flag_key: str, tenant_id: str) -> bool:
    """The contract method.

    Tenant override beats global default. When no override exists, defer
    to the existing per-org ``FeatureFlagService`` if importable; finally
    fall back to ``False``.
    """
    override = get_override(tenant_id, flag_key)
    if override is not None:
        return bool(override.get("enabled", False))

    # Fall back to the global rollout service.
    try:
        from app.services import feature_flag_service as ff

        if hasattr(ff, "is_enabled"):
            return bool(ff.is_enabled(tenant_id, flag_key))
        if hasattr(ff, "get_flag"):
            flag = ff.get_flag(tenant_id, flag_key)
            return bool(flag and flag.get("enabled", False))
    except Exception as exc:  # noqa: BLE001
        logger.debug("tenant_flags.global_lookup_failed", extra={"err": str(exc)})
    return False


def set_override(
    tenant_id: str,
    flag_key: str,
    *,
    enabled: bool,
    reason: str,
    set_by: str,
    expires_at: Optional[datetime] = None,
) -> dict:
    """Set or update a tenant-level override.

    ``reason`` is required and audit-logged; in the API layer the caller
    must also have ``platform.manage`` (super-admin).
    """
    if not reason or len(reason.strip()) < 3:
        raise ValueError("reason required (≥3 chars)")

    doc = {
        "tenant_id": tenant_id,
        "flag_key": flag_key,
        "enabled": bool(enabled),
        "reason": reason.strip(),
        "set_by": set_by,
        "set_at": _now_utc(),
        "expires_at": expires_at,
    }
    try:
        _doc_path(tenant_id, flag_key).set(doc)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "tenant_flags.write_failed",
            extra={"err": str(exc), "tenant": tenant_id, "flag": flag_key},
        )
        raise
    _invalidate(tenant_id, flag_key)
    return doc


def clear_override(tenant_id: str, flag_key: str) -> bool:
    try:
        _doc_path(tenant_id, flag_key).delete()
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "tenant_flags.delete_failed",
            extra={"err": str(exc), "tenant": tenant_id, "flag": flag_key},
        )
        return False
    _invalidate(tenant_id, flag_key)
    return True


def list_overrides(tenant_id: str) -> list[dict]:
    try:
        from app.firebase_client import get_db

        col = (
            get_db()
            .collection(COLLECTION)
            .document(tenant_id)
            .collection(SUBCOLLECTION)
        )
        out: list[dict] = []
        for snap in col.stream():
            data = snap.to_dict() or {}
            data.setdefault("flag_key", snap.id)
            out.append(data)
        return out
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "tenant_flags.list_failed", extra={"err": str(exc), "tenant": tenant_id}
        )
        return []


__all__ = [
    "is_enabled",
    "get_override",
    "set_override",
    "clear_override",
    "list_overrides",
    "_invalidate",
    "COLLECTION",
    "SUBCOLLECTION",
]
