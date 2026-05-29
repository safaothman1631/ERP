"""Per-tenant feature-flag override endpoints (G2 / R2.4).

Three endpoints under ``/api/admin/tenants/{tid}/flags``:

  * ``GET``                  — list current overrides
  * ``PUT  /{flag_key}``     — set or update an override
  * ``DELETE /{flag_key}``   — remove an override

Every mutating call is audit-logged through
:mod:`app.middleware.audit` plus an explicit row in
``audit_logs`` (so super-admin activity stands out in queries).
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status
from pydantic import BaseModel, ConfigDict, Field

from app.security.dependencies import get_current_user
from app.services import feature_flags_tenant as flags

log = logging.getLogger("api.admin.tenant_flags")

router = APIRouter(prefix="/api/admin/tenants", tags=["Admin / Tenant Flags"])


# ── Schemas ────────────────────────────────────────────────────────────────


class TenantFlagOverride(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool
    reason: str = Field(..., min_length=3, max_length=500)
    expires_at: Optional[datetime] = None


class TenantFlagDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")

    tenant_id: str
    flag_key: str
    enabled: bool
    reason: str
    set_by: str
    set_at: datetime
    expires_at: Optional[datetime] = None


class TenantFlagListResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    items: list[TenantFlagDoc]


# ── Permission ─────────────────────────────────────────────────────────────


def _require_super_admin(user: dict) -> None:
    role = (user.get("role") or "").lower()
    if role == "super_admin" or user.get("is_platform_admin"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="super_admin role required for tenant feature-flag overrides",
    )


# ── Audit helper ───────────────────────────────────────────────────────────


def _audit(action: str, tenant_id: str, flag_key: str, user: dict, payload: dict) -> None:
    try:
        from app.firebase_client import get_db

        get_db().collection("audit_logs").document(uuid.uuid4().hex).set(
            {
                "type": f"tenant_flag.{action}",
                "tenant_id": tenant_id,
                "flag_key": flag_key,
                "actor_id": user.get("id"),
                "actor_email": user.get("email"),
                "payload": payload,
                "ts": datetime.now(timezone.utc),
            }
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("audit.tenant_flag_failed", extra={"err": str(exc)})


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get(
    "/{tenant_id}/flags",
    response_model=TenantFlagListResponse,
    summary="List per-tenant feature flag overrides",
)
async def list_flags(
    tenant_id: str = Path(..., min_length=1, max_length=128),
    user: dict = Depends(get_current_user),
) -> TenantFlagListResponse:
    _require_super_admin(user)
    docs = flags.list_overrides(tenant_id)
    items: list[TenantFlagDoc] = []
    for d in docs:
        try:
            items.append(TenantFlagDoc(**d))
        except Exception:  # noqa: BLE001
            continue
    return TenantFlagListResponse(items=items)


@router.put(
    "/{tenant_id}/flags/{flag_key}",
    response_model=TenantFlagDoc,
    summary="Set or update a per-tenant feature flag override",
)
async def set_flag(
    payload: TenantFlagOverride,
    tenant_id: str = Path(..., min_length=1, max_length=128),
    flag_key: str = Path(..., min_length=1, max_length=128, pattern=r"^[a-z0-9_.-]+$"),
    user: dict = Depends(get_current_user),
) -> TenantFlagDoc:
    _require_super_admin(user)

    doc = flags.set_override(
        tenant_id,
        flag_key,
        enabled=payload.enabled,
        reason=payload.reason,
        set_by=user.get("id") or "unknown",
        expires_at=payload.expires_at,
    )
    _audit("set", tenant_id, flag_key, user, payload.model_dump())
    # set_override already echoes flag_key in the doc; merge so the explicit
    # path value wins and we don't pass the keyword twice.
    return TenantFlagDoc(**{**doc, "flag_key": flag_key})


@router.delete(
    "/{tenant_id}/flags/{flag_key}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a per-tenant feature flag override",
)
async def clear_flag(
    tenant_id: str = Path(..., min_length=1, max_length=128),
    flag_key: str = Path(..., min_length=1, max_length=128, pattern=r"^[a-z0-9_.-]+$"),
    user: dict = Depends(get_current_user),
):
    _require_super_admin(user)
    ok = flags.clear_override(tenant_id, flag_key)
    _audit("clear", tenant_id, flag_key, user, {"ok": ok})
    return None


ALL_ROUTERS = [router]

__all__ = ["router", "ALL_ROUTERS"]
