"""Tenant-facing GDPR/PDPL data-rights endpoints (T-SF.2.22).

This router is **per-tenant**: every endpoint acts on the caller's own
``org_id`` (resolved from :func:`app.services.auth.get_current_user`). It is the
self-service counterpart to the super-admin tooling in ``app.api.admin.exports``
/ ``app.api.admin.pii_delete`` — a tenant admin can only ever export or erase
*their own* organization's data.

Endpoints (all under ``/api/data-rights``):

  * ``POST /export``               — enqueue a full-tenant data export.
  * ``GET  /export/{request_id}``  — status of an export request.
  * ``POST /erasure``              — open a tenant data-erasure request.
  * ``GET  /erasure/{request_id}`` — status of an erasure request.

Permission gates mirror :mod:`app.services.permissions`:

  * ``privacy.export``  guards the export request.
  * ``privacy.erasure`` guards the (more dangerous) erasure request.

The heavy lifting lives in :mod:`app.services.data_rights_service`; this layer
only validates input, scopes to ``org_id``, maps service errors to HTTP, and
shapes the response. The export request runs in-process (the service iterates
collections synchronously) but is dispatched through a threadpool so it never
blocks the event loop.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field

from app.services import data_rights_service
from app.services.auth import get_current_user
from app.services.permissions import require_perm

log = logging.getLogger("api.data_rights")

router = APIRouter(prefix="/api/data-rights", tags=["Data Rights (GDPR/PDPL)"])


# ── Helpers ──────────────────────────────────────────────────────────────


def _org_id(user: dict) -> str:
    """Resolve the caller's tenant id (``org_id`` is the per-tenant key)."""
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="no tenant context on the current user",
        )
    return org_id


# ── Schemas ──────────────────────────────────────────────────────────────


class ExportRequestResponse(BaseModel):
    """Echoes the persisted ``data_rights_requests`` row for an export."""

    model_config = ConfigDict(extra="ignore")

    id: str
    kind: str
    status: str
    requested_by: Optional[str] = None
    requested_by_email: Optional[str] = None
    requested_at: Optional[str] = None
    completed_at: Optional[str] = None
    signed_url: Optional[str] = None
    bytes: Optional[int] = None
    document_count: Optional[int] = None
    collections: Optional[dict[str, int]] = None
    error: Optional[str] = None


class ErasureCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: Optional[str] = Field(default=None, max_length=2000)


class ErasureRequestResponse(BaseModel):
    """Echoes the persisted ``data_rights_requests`` row for an erasure.

    ``confirm_token`` is intentionally surfaced once on creation so the admin can
    confirm the request; it is dropped from the stored record after confirmation.
    """

    model_config = ConfigDict(extra="ignore")

    id: str
    kind: str
    status: str
    requested_by: Optional[str] = None
    requested_by_email: Optional[str] = None
    reason: Optional[str] = None
    requested_at: Optional[str] = None
    confirm_token: Optional[str] = None
    grace_days: Optional[int] = None
    confirmed_at: Optional[str] = None
    scheduled_purge_at: Optional[str] = None
    purged_at: Optional[str] = None
    documents_purged: Optional[int] = None
    cancelled_at: Optional[str] = None


def _shape_export(rec: dict[str, Any]) -> ExportRequestResponse:
    return ExportRequestResponse(**rec)


def _shape_erasure(rec: dict[str, Any]) -> ErasureRequestResponse:
    return ErasureRequestResponse(**rec)


# ── Export ─────────────────────────────────────────────────────────────────


@router.post(
    "/export",
    response_model=ExportRequestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_perm("privacy.export"))],
    summary="Request a full-tenant data export (GDPR Art. 15/20, PDPL access)",
)
async def request_export(
    response: Response,
    user: dict = Depends(get_current_user),
) -> ExportRequestResponse:
    """Assemble and persist a full-tenant export, returning the request record.

    Returns ``202 Accepted``. The record's ``status`` is ``ready`` (with a
    short-lived ``signed_url``) when an export bucket is configured, otherwise
    ``pending`` (archive not persisted offline). ``failed`` is returned in-body
    if collection iteration errored.
    """
    org_id = _org_id(user)
    try:
        rec = await run_in_threadpool(
            data_rights_service.request_export,
            org_id,
            requested_by=user.get("id") or "unknown",
            requested_by_email=user.get("email"),
        )
    except Exception as exc:  # noqa: BLE001
        log.exception("data_rights.export.request_failed", extra={"org_id": org_id})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="could not assemble data export",
        ) from exc

    response.headers["Location"] = f"/api/data-rights/export/{rec['id']}"
    return _shape_export(rec)


@router.get(
    "/export/{request_id}",
    response_model=ExportRequestResponse,
    dependencies=[Depends(require_perm("privacy.export"))],
    summary="Status of a data-export request",
)
async def get_export(
    request_id: str = Path(..., min_length=1, max_length=128),
    user: dict = Depends(get_current_user),
) -> ExportRequestResponse:
    org_id = _org_id(user)
    rec = await run_in_threadpool(data_rights_service.get_export, org_id, request_id)
    if not rec or rec.get("kind") != "export":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="export request not found",
        )
    return _shape_export(rec)


# ── Erasure ──────────────────────────────────────────────────────────────


@router.post(
    "/erasure",
    response_model=ErasureRequestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_perm("privacy.erasure"))],
    summary="Request tenant data erasure (GDPR Art. 17, PDPL right to be forgotten)",
)
async def request_erasure(
    payload: ErasureCreateRequest,
    response: Response,
    user: dict = Depends(get_current_user),
) -> ErasureRequestResponse:
    """Open an erasure request in the *awaiting confirmation* state.

    Returns ``202 Accepted`` with a ``confirm_token`` the admin must echo to
    confirm. Nothing is deleted at this stage — confirmation schedules a hard
    delete after the standard grace window.
    """
    org_id = _org_id(user)
    try:
        rec = await run_in_threadpool(
            data_rights_service.request_erasure,
            org_id,
            requested_by=user.get("id") or "unknown",
            requested_by_email=user.get("email"),
            reason=payload.reason,
        )
    except Exception as exc:  # noqa: BLE001
        log.exception("data_rights.erasure.request_failed", extra={"org_id": org_id})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="could not record erasure request",
        ) from exc

    response.headers["Location"] = f"/api/data-rights/erasure/{rec['id']}"
    return _shape_erasure(rec)


@router.get(
    "/erasure/{request_id}",
    response_model=ErasureRequestResponse,
    dependencies=[Depends(require_perm("privacy.erasure"))],
    summary="Status of a data-erasure request",
)
async def get_erasure(
    request_id: str = Path(..., min_length=1, max_length=128),
    user: dict = Depends(get_current_user),
) -> ErasureRequestResponse:
    org_id = _org_id(user)
    # The service exposes a single scoped fetch for both request kinds.
    rec = await run_in_threadpool(data_rights_service.get_export, org_id, request_id)
    if not rec or rec.get("kind") != "erasure":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="erasure request not found",
        )
    return _shape_erasure(rec)


ALL_ROUTERS = [router]

__all__ = ["router", "ALL_ROUTERS"]
