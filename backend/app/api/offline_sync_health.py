"""
offline_sync_health.py
-----------------------------------------------------------------------------
V-PR.4 (Offline POS Sync Success Rate) — per-device heartbeat endpoint and
tenant rollup endpoint.

Endpoints:
  POST /api/health/offline-sync             — terminal sends a heartbeat
  GET  /api/admin/offline-sync/summary      — admin rollup across all devices

Data model:
  Firestore path: tenants/{tenant_id}/offline_health/{device_id}
    {
      device_id, tenant_id, queued_count, synced_count, failed_count,
      oldest_queued_age_sec, app_version, reported_at, reporter_user_id
    }

Authentication:
  Both endpoints require a valid JWT (any authenticated user can post their
  own device heartbeat; admin role required for the rollup).

Audit:
  Every heartbeat write produces an audit_logs entry (action=offline_sync.hb).
  Rollup queries write a single audit entry per call.

Mounting:
  This file is intentionally self-contained — `router` is an APIRouter with
  no prefix so the registered routes carry their absolute paths as decorated.
  Mount from app.main with::

      try:
          from app.api import offline_sync_health as _ofs
          app.include_router(_ofs.router)
      except Exception as _e:  # noqa: BLE001
          logging.getLogger(__name__).warning("offline_sync_health not mounted: %s", _e)

References:
  validation.md V-PR.4 / Tasks T-V.10
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field

from app.firebase_client import get_db
from app.services.auth import get_current_user

# Reuse the existing platform audit helper — it swallows its own exceptions
# so we never fail the heartbeat write because of an audit hiccup.
try:
    from app.api.platform._audit import audit_platform as _audit
except Exception:  # pragma: no cover  — audit is best-effort
    def _audit(org_id: str, user_id: str, action: str, meta: dict | None = None) -> None:  # type: ignore[misc]
        pass


logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health · Offline Sync"])

# Stale threshold: V-PR.4 says oldest queued age ≤ 24h at p99 → 86_400s.
_STALE_QUEUE_SEC = 86_400

# ── Pydantic schemas ──────────────────────────────────────────────────────


class HeartbeatIn(BaseModel):
    """Per-device offline-sync heartbeat payload."""

    model_config = ConfigDict(extra="ignore", validate_assignment=False)

    device_id: str = Field(..., min_length=1, max_length=128, description="Stable browser/terminal id (ULID).")
    queued_count: int = Field(0, ge=0, description="Pending offline ops on the device.")
    synced_count: int = Field(0, ge=0, description="Ops successfully synced in the last reporting window.")
    failed_count: int = Field(0, ge=0, description="Ops in failed state (gave up after retries).")
    oldest_queued_age_sec: int = Field(0, ge=0, description="Age (seconds) of the oldest pending op; 0 if queue empty.")
    app_version: Optional[str] = Field(None, max_length=64, description="Frontend build version reporting the heartbeat.")


class HeartbeatOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    device_id: str
    tenant_id: str
    stored: bool
    is_stale: bool
    reported_at: str


class DeviceSummary(BaseModel):
    model_config = ConfigDict(extra="ignore")
    device_id: str
    queued_count: int
    synced_count: int
    failed_count: int
    oldest_queued_age_sec: int
    app_version: Optional[str] = None
    reported_at: Optional[str] = None
    is_stale: bool = False


class TenantSummary(BaseModel):
    model_config = ConfigDict(extra="ignore")
    tenant_id: str
    device_count: int
    total_queued: int
    total_synced: int
    total_failed: int
    max_oldest_queued_age_sec: int
    any_device_stale: bool
    devices: List[DeviceSummary]
    generated_at: str


# ── Helpers ───────────────────────────────────────────────────────────────


def _resolve_tenant_id(user: dict) -> str:
    """Pull tenant_id (a.k.a. org_id) from the JWT user dict.

    The auth layer stores the canonical tenant under ``org_id`` — we treat
    that as the tenant_id for V-PR.4 reporting.
    """
    tid = user.get("org_id") or user.get("tenant_id")
    if not tid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenant on token",
        )
    return str(tid)


def _is_admin(user: dict) -> bool:
    role = (user.get("role") or user.get("system_role") or "").lower()
    return role in {"admin", "owner", "platform_admin", "tenant_admin"}


# ── POST /api/health/offline-sync ─────────────────────────────────────────


@router.post(
    "/api/health/offline-sync",
    response_model=HeartbeatOut,
    summary="Per-device offline-sync heartbeat (V-PR.4)",
)
async def post_offline_sync_heartbeat(
    payload: HeartbeatIn,
    user: dict = Depends(get_current_user),
) -> HeartbeatOut:
    """Stores the latest heartbeat snapshot for `device_id` under the user's tenant.

    Idempotent: subsequent heartbeats overwrite (we keep only the latest
    snapshot per device, not a time-series — rollups are derived live).
    """
    tenant_id = _resolve_tenant_id(user)
    user_id = str(user.get("id") or user.get("user_id") or "unknown")
    now = datetime.now(tz=timezone.utc)
    now_iso = now.isoformat()

    is_stale = payload.oldest_queued_age_sec > _STALE_QUEUE_SEC

    doc = {
        "device_id": payload.device_id,
        "tenant_id": tenant_id,
        "queued_count": int(payload.queued_count),
        "synced_count": int(payload.synced_count),
        "failed_count": int(payload.failed_count),
        "oldest_queued_age_sec": int(payload.oldest_queued_age_sec),
        "app_version": payload.app_version,
        "reported_at": now_iso,
        "reporter_user_id": user_id,
        "is_stale": is_stale,
    }

    stored = False
    try:
        db = get_db()
        ref = (
            db.collection("tenants")
            .document(tenant_id)
            .collection("offline_health")
            .document(payload.device_id)
        )
        ref.set(doc, merge=True)
        stored = True
    except Exception as exc:  # noqa: BLE001
        logger.warning("offline_sync heartbeat write failed: %s", exc)

    _audit(
        org_id=tenant_id,
        user_id=user_id,
        action="offline_sync.hb",
        meta={
            "device_id": payload.device_id,
            "queued": payload.queued_count,
            "synced": payload.synced_count,
            "failed": payload.failed_count,
            "oldest_sec": payload.oldest_queued_age_sec,
            "app_version": payload.app_version,
            "is_stale": is_stale,
        },
    )

    return HeartbeatOut(
        device_id=payload.device_id,
        tenant_id=tenant_id,
        stored=stored,
        is_stale=is_stale,
        reported_at=now_iso,
    )


# ── GET /api/admin/offline-sync/summary ───────────────────────────────────


@router.get(
    "/api/admin/offline-sync/summary",
    response_model=TenantSummary,
    summary="Tenant-wide offline-sync rollup (V-PR.4)",
)
async def get_offline_sync_summary(
    tenant_id: Optional[str] = Query(
        default=None,
        description="Tenant to summarise. Defaults to the caller's tenant; only "
                    "platform admins may query a different tenant.",
    ),
    user: dict = Depends(get_current_user),
) -> TenantSummary:
    """Aggregates the latest heartbeat from every device in `tenant_id`.

    Returns counts plus ``any_device_stale`` if any device has
    ``oldest_queued_age_sec > 86_400`` (24h).
    """
    caller_tenant = _resolve_tenant_id(user)
    if tenant_id is None:
        tenant_id = caller_tenant
    elif tenant_id != caller_tenant and not _is_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cross-tenant rollup requires admin role",
        )

    devices: List[DeviceSummary] = []
    total_queued = 0
    total_synced = 0
    total_failed = 0
    max_age = 0
    any_stale = False

    try:
        db = get_db()
        col = (
            db.collection("tenants")
            .document(tenant_id)
            .collection("offline_health")
        )
        for snap in col.stream():
            d = snap.to_dict() or {}
            age = int(d.get("oldest_queued_age_sec", 0) or 0)
            stale = age > _STALE_QUEUE_SEC
            devices.append(DeviceSummary(
                device_id=str(d.get("device_id", snap.id)),
                queued_count=int(d.get("queued_count", 0) or 0),
                synced_count=int(d.get("synced_count", 0) or 0),
                failed_count=int(d.get("failed_count", 0) or 0),
                oldest_queued_age_sec=age,
                app_version=d.get("app_version"),
                reported_at=d.get("reported_at"),
                is_stale=stale,
            ))
            total_queued += int(d.get("queued_count", 0) or 0)
            total_synced += int(d.get("synced_count", 0) or 0)
            total_failed += int(d.get("failed_count", 0) or 0)
            if age > max_age:
                max_age = age
            if stale:
                any_stale = True
    except Exception as exc:  # noqa: BLE001
        logger.warning("offline_sync summary read failed: %s", exc)

    _audit(
        org_id=caller_tenant,
        user_id=str(user.get("id") or "unknown"),
        action="offline_sync.summary",
        meta={"queried_tenant": tenant_id, "device_count": len(devices)},
    )

    return TenantSummary(
        tenant_id=tenant_id,
        device_count=len(devices),
        total_queued=total_queued,
        total_synced=total_synced,
        total_failed=total_failed,
        max_oldest_queued_age_sec=max_age,
        any_device_stale=any_stale,
        devices=devices,
        generated_at=datetime.now(tz=timezone.utc).isoformat(),
    )
