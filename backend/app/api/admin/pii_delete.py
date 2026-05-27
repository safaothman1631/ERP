"""Tenant soft-delete + hard-delete grace window (P4 / R7.7).

``POST /api/admin/tenants/{tenant_id}/delete`` soft-deletes the tenant by
setting ``deleted_at`` on the tenant root document and every reachable
subdocument. An APScheduler job (``hard_delete_expired_tenants`` in
:mod:`app.services.scheduler_jobs`) hard-deletes documents whose
``deleted_at`` is more than 30 days old.

PDPL / GDPR
-----------
Users see a confirmation that data is scheduled for permanent removal after
30 days. Until then, the tenant remains "frozen" — soft-deleted markers
short-circuit normal reads via the existing soft-delete middleware.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Path, status
from pydantic import BaseModel, ConfigDict, Field

from app.security.dependencies import get_current_user
from app.firestore.client import get_async_client

log = logging.getLogger("api.admin.pii_delete")

router = APIRouter(prefix="/api/admin", tags=["Admin / PII Delete"])


# Grace period before hard delete (R7.7).
GRACE_DAYS: int = 30


# ── Schemas ────────────────────────────────────────────────────────────────


class DeleteRequest(BaseModel):
    """Body for tenant delete — requires an explicit confirmation phrase."""

    model_config = ConfigDict(extra="ignore")

    confirm: str = Field(
        ..., description='Must equal "DELETE-<tenant_id>" to proceed'
    )
    reason: Optional[str] = Field(None, max_length=500)


class DeleteResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    tenant_id: str
    status: str = Field(..., description='"soft_deleted"')
    deleted_at: datetime
    hard_delete_after: datetime
    documents_marked: int


class DeleteErrorResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    error: str
    detail: str


# ── Permission helpers ─────────────────────────────────────────────────────


def _require_admin(user: dict) -> None:
    role = (user.get("role") or "").lower()
    if role not in ("admin", "super_admin") and not user.get("is_platform_admin"):
        raise HTTPException(status_code=403, detail="admin role required")


def _require_tenant_access(user: dict, tenant_id: str) -> None:
    if user.get("is_platform_admin") or (user.get("role") or "").lower() == "super_admin":
        return
    user_tenant = user.get("tenant_id") or user.get("org_id")
    if user_tenant != tenant_id:
        raise HTTPException(status_code=403, detail="tenant mismatch")


# ── Soft-delete walk ───────────────────────────────────────────────────────


async def _soft_delete_subtree(
    tenant_id: str, deleted_at: datetime, actor_id: Optional[str]
) -> int:
    """Set ``deleted_at`` on the tenant root and every doc under it."""
    client = get_async_client()
    tenant_ref = client.collection("tenants").document(tenant_id)
    marker = {
        "deleted_at": deleted_at,
        "deleted_by": actor_id,
        "deleted_status": "soft",
    }

    count = 0
    # Root doc:
    try:
        await tenant_ref.set(marker, merge=True)
        count += 1
    except Exception as e:  # noqa: BLE001
        log.warning("pii_delete.root_failed", extra={"err": str(e)})

    # Subcollections:
    subcollections: list[str] = []
    try:
        async for sub in tenant_ref.collections():  # type: ignore[attr-defined]
            subcollections.append(sub.id)
    except Exception:  # noqa: BLE001
        # Fallback whitelist mirrors the exports module.
        subcollections = [
            "contacts", "items", "invoices", "bills", "quotes",
            "expenses", "payments", "projects", "accounts",
            "journals", "tasks", "activities", "users",
        ]

    for name in subcollections:
        try:
            async for snap in tenant_ref.collection(name).stream():
                await snap.reference.set(marker, merge=True)
                count += 1
        except Exception as e:  # noqa: BLE001
            log.warning(
                "pii_delete.collection_failed",
                extra={"err": str(e), "collection": name},
            )

    return count


# ── Audit ──────────────────────────────────────────────────────────────────


async def _audit_delete(
    tenant_id: str, user: dict, count: int, reason: Optional[str]
) -> None:
    try:
        client = get_async_client()
        await client.collection("audit_logs").document(uuid.uuid4().hex).set({
            "type": "tenant_soft_delete",
            "tenant_id": tenant_id,
            "actor_id": user.get("id"),
            "actor_role": user.get("role"),
            "documents_marked": count,
            "reason": reason,
            "ts": datetime.now(timezone.utc),
        })
    except Exception as e:  # noqa: BLE001
        log.warning("audit.delete_failed", extra={"err": str(e)})


# ── Endpoint ───────────────────────────────────────────────────────────────


@router.post(
    "/tenants/{tenant_id}/delete",
    response_model=DeleteResponse,
    responses={
        400: {"model": DeleteErrorResponse},
        403: {"model": DeleteErrorResponse},
        500: {"model": DeleteErrorResponse},
    },
    summary="Soft-delete a tenant; hard-deletes after 30 days (R7.7)",
)
async def soft_delete_tenant(
    tenant_id: str = Path(..., min_length=1, max_length=128),
    body: DeleteRequest = Body(...),
    user: dict = Depends(get_current_user),
) -> DeleteResponse:
    """Mark the tenant subtree as deleted; APScheduler removes it after 30 days."""
    _require_admin(user)
    _require_tenant_access(user, tenant_id)

    expected = f"DELETE-{tenant_id}"
    if body.confirm != expected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'confirmation phrase must equal "{expected}"',
        )

    now = datetime.now(timezone.utc)
    log.info(
        "pii_delete.start",
        extra={"tenant_id": tenant_id, "actor": user.get("id"), "reason": body.reason},
    )

    try:
        count = await _soft_delete_subtree(
            tenant_id, deleted_at=now, actor_id=user.get("id")
        )
    except Exception as e:  # noqa: BLE001
        log.exception("pii_delete.failed")
        raise HTTPException(status_code=500, detail="soft delete failed") from e

    await _audit_delete(tenant_id, user, count, body.reason)

    log.info(
        "pii_delete.complete",
        extra={"tenant_id": tenant_id, "documents_marked": count},
    )

    return DeleteResponse(
        tenant_id=tenant_id,
        status="soft_deleted",
        deleted_at=now,
        hard_delete_after=now + timedelta(days=GRACE_DAYS),
        documents_marked=count,
    )


__all__ = ["router", "DeleteRequest", "DeleteResponse", "GRACE_DAYS"]
