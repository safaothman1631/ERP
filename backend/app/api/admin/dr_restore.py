"""Super-admin disaster-recovery restore endpoints (SF3 / T-SF.3.9, T-SF.3.11).

Exposes a **four-eyes** (two-person) per-tenant restore workflow with a diff
preview, under ``/api/admin/dr/restore``:

  * ``POST   /api/admin/dr/restore``                       — create a restore request
  * ``GET    /api/admin/dr/restore``                       — list requests (optional ?org_id=)
  * ``GET    /api/admin/dr/restore/{id}``                  — fetch one request
  * ``POST   /api/admin/dr/restore/{id}/preview``          — (re)compute the diff preview
  * ``POST   /api/admin/dr/restore/{id}/approve``          — approve (must be a DIFFERENT super-admin)
  * ``POST   /api/admin/dr/restore/{id}/reject``           — reject
  * ``POST   /api/admin/dr/restore/{id}/cancel``           — cancel
  * ``POST   /api/admin/dr/restore/{id}/execute``          — mark approved request as executing
  * ``GET    /api/admin/dr/restore/{id}/command``          — print the exact shell command to run

Design notes
------------
* RBAC: every endpoint requires ``super_admin`` / ``is_platform_admin`` — a
  tenant restore overwrites a customer's production data and is a platform
  operation, never a tenant-level one.
* Four-eyes: :meth:`DrRestoreService.approve` refuses self-approval; execution
  is only allowed from the ``approved`` state. This is the core control of
  T-SF.3.9.
* The API never spawns ``gcloud``. ``/execute`` flips the request to
  ``executing`` and returns the precise ``scripts/dr/restore-tenant.sh`` command
  an operator runs on the incident bridge. After the script finishes, the
  operator (or a worker) reports the result back. This keeps the request handler
  fast and the destructive work out of the web process.
* Every mutation also writes an explicit ``audit_logs`` row so super-admin DR
  activity is trivially queryable alongside the normal audit middleware.

The service layer (:mod:`app.services.dr_restore_service`) holds all state and
is fully mockable; the tests patch ``DrRestoreService`` / ``compute_diff_preview``.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, status
from pydantic import BaseModel, ConfigDict, Field

from app.security.dependencies import get_current_user
from app.services.dr_restore_service import (
    DrRestoreService,
    FourEyesViolation,
    InvalidTransition,
    RestoreRequest,
    compute_diff_preview,
)

log = logging.getLogger("api.admin.dr_restore")

router = APIRouter(prefix="/api/admin/dr/restore", tags=["Admin / DR Restore"])


# ── Schemas ────────────────────────────────────────────────────────────────


class RestoreCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    org_id: str = Field(..., min_length=1, max_length=128)
    source_path: str = Field(
        ...,
        min_length=1,
        max_length=1024,
        description="GCS/local backup archive path, e.g. backups/<org>/<date>/backup_*.json.gz",
    )
    mode: Literal["upsert", "replace"] = Field(
        "upsert",
        description="upsert = additive merge; replace = also delete docs absent from the backup",
    )
    reason: str = Field(..., min_length=5, max_length=1000, description="Why this restore is needed")
    compute_preview: bool = Field(
        True, description="Compute a diff preview at request time (recommended)"
    )


class RejectCancelBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: Optional[str] = Field(None, max_length=1000)


class RestoreRequestDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    org_id: str
    source_path: str
    status: str
    mode: str
    reason: str
    requested_by: str
    requested_by_email: Optional[str] = None
    requested_at: str
    approved_by: Optional[str] = None
    approved_by_email: Optional[str] = None
    approved_at: Optional[str] = None
    rejected_by: Optional[str] = None
    rejected_at: Optional[str] = None
    executed_at: Optional[str] = None
    result: Optional[dict] = None
    diff_preview: Optional[dict] = None
    error_message: Optional[str] = None


class RestoreListResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    items: list[RestoreRequestDoc]
    total: int


class CommandResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    request_id: str
    org_id: str
    command: str
    note: str


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    error: str
    detail: str


# ── Permission ─────────────────────────────────────────────────────────────


def _require_super_admin(user: dict) -> None:
    """Tenant restore is a platform operation — super_admin only."""
    role = (user.get("role") or "").lower()
    if role == "super_admin" or user.get("is_platform_admin"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="super_admin role required for disaster-recovery restores",
    )


def _audit(action: str, request: RestoreRequest, user: dict, extra: Optional[dict] = None) -> None:
    """Best-effort explicit audit row. Never raises."""
    try:
        from app.firebase_client import get_db

        get_db().collection("audit_logs").document(uuid.uuid4().hex).set(
            {
                "type": f"dr_restore.{action}",
                "request_id": request.id,
                "org_id": request.org_id,
                "status": request.status,
                "actor_id": user.get("id"),
                "actor_email": user.get("email"),
                "extra": extra or {},
                "ts": datetime.now(timezone.utc),
            }
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("audit.dr_restore_failed", extra={"err": str(exc), "action": action})


def _doc(req: RestoreRequest) -> RestoreRequestDoc:
    return RestoreRequestDoc(**req.to_dict())


def _service() -> DrRestoreService:
    # Indirection so tests can patch app.api.admin.dr_restore.DrRestoreService.
    return DrRestoreService()


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.post(
    "",
    response_model=RestoreRequestDoc,
    status_code=status.HTTP_201_CREATED,
    responses={400: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
    summary="Create a four-eyes tenant restore request (with optional diff preview)",
)
async def create_request(
    body: RestoreCreate,
    user: dict = Depends(get_current_user),
) -> RestoreRequestDoc:
    _require_super_admin(user)

    diff_preview: Optional[dict] = None
    if body.compute_preview:
        try:
            diff_preview = compute_diff_preview(org_id=body.org_id, source_path=body.source_path)
        except FileNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"backup archive not found: {body.source_path}",
            ) from exc
        except Exception as exc:  # noqa: BLE001
            # A preview failure must not block creating the request; record it.
            log.warning("dr_restore.preview_failed", extra={"err": str(exc)})
            diff_preview = {"error": f"preview failed: {exc}"}

    svc = _service()
    try:
        req = svc.request_restore(
            org_id=body.org_id,
            source_path=body.source_path,
            mode=body.mode,
            reason=body.reason,
            requested_by=user.get("id") or "unknown",
            requested_by_email=user.get("email"),
            diff_preview=diff_preview,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    _audit("request", req, user, {"mode": body.mode, "source_path": body.source_path})
    return _doc(req)


@router.get(
    "",
    response_model=RestoreListResponse,
    summary="List tenant restore requests (super-admin)",
)
async def list_requests(
    org_id: Optional[str] = Query(None, max_length=128),
    limit: int = Query(100, ge=1, le=500),
    user: dict = Depends(get_current_user),
) -> RestoreListResponse:
    _require_super_admin(user)
    items = _service().repo.list(org_id=org_id, limit=limit)
    return RestoreListResponse(items=[_doc(r) for r in items], total=len(items))


@router.get(
    "/{request_id}",
    response_model=RestoreRequestDoc,
    responses={404: {"model": ErrorResponse}},
    summary="Fetch a single restore request",
)
async def get_request(
    request_id: str = Path(..., min_length=1, max_length=128),
    user: dict = Depends(get_current_user),
) -> RestoreRequestDoc:
    _require_super_admin(user)
    req = _service().repo.get(request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="restore request not found")
    return _doc(req)


@router.post(
    "/{request_id}/preview",
    response_model=RestoreRequestDoc,
    responses={404: {"model": ErrorResponse}, 400: {"model": ErrorResponse}},
    summary="(Re)compute the diff preview for a restore request",
)
async def recompute_preview(
    request_id: str = Path(..., min_length=1, max_length=128),
    user: dict = Depends(get_current_user),
) -> RestoreRequestDoc:
    _require_super_admin(user)
    svc = _service()
    req = svc.repo.get(request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="restore request not found")
    try:
        preview = compute_diff_preview(org_id=req.org_id, source_path=req.source_path)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"backup archive not found: {req.source_path}",
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"preview failed: {exc}") from exc

    svc.repo.update(request_id, {"diff_preview": preview})
    req.diff_preview = preview
    _audit("preview", req, user)
    return _doc(req)


@router.post(
    "/{request_id}/approve",
    response_model=RestoreRequestDoc,
    responses={
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
    },
    summary="Approve a restore request (four-eyes: must differ from requester)",
)
async def approve_request(
    request_id: str = Path(..., min_length=1, max_length=128),
    user: dict = Depends(get_current_user),
) -> RestoreRequestDoc:
    _require_super_admin(user)
    svc = _service()
    try:
        req = svc.approve(
            request_id,
            approver_id=user.get("id") or "unknown",
            approver_email=user.get("email"),
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="restore request not found")
    except FourEyesViolation as exc:
        # 403 — the caller is not permitted to approve THIS request (self-approval).
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except InvalidTransition as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    _audit("approve", req, user)
    return _doc(req)


@router.post(
    "/{request_id}/reject",
    response_model=RestoreRequestDoc,
    responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
    summary="Reject a restore request",
)
async def reject_request(
    request_id: str = Path(..., min_length=1, max_length=128),
    body: RejectCancelBody = Body(default=RejectCancelBody()),
    user: dict = Depends(get_current_user),
) -> RestoreRequestDoc:
    _require_super_admin(user)
    svc = _service()
    try:
        req = svc.reject(request_id, actor_id=user.get("id") or "unknown")
    except KeyError:
        raise HTTPException(status_code=404, detail="restore request not found")
    except InvalidTransition as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    _audit("reject", req, user, {"reason": body.reason})
    return _doc(req)


@router.post(
    "/{request_id}/cancel",
    response_model=RestoreRequestDoc,
    responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
    summary="Cancel an open restore request",
)
async def cancel_request(
    request_id: str = Path(..., min_length=1, max_length=128),
    body: RejectCancelBody = Body(default=RejectCancelBody()),
    user: dict = Depends(get_current_user),
) -> RestoreRequestDoc:
    _require_super_admin(user)
    svc = _service()
    try:
        req = svc.cancel(request_id, actor_id=user.get("id") or "unknown")
    except KeyError:
        raise HTTPException(status_code=404, detail="restore request not found")
    except InvalidTransition as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    _audit("cancel", req, user, {"reason": body.reason})
    return _doc(req)


@router.post(
    "/{request_id}/execute",
    response_model=CommandResponse,
    responses={
        403: {"model": ErrorResponse},
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse},
    },
    summary="Mark an APPROVED request executing and return the operator command",
)
async def execute_request(
    request_id: str = Path(..., min_length=1, max_length=128),
    user: dict = Depends(get_current_user),
) -> CommandResponse:
    """Flip an approved request to ``executing`` and return the exact
    ``restore-tenant.sh`` invocation. The web process never runs gcloud itself.
    """
    _require_super_admin(user)
    svc = _service()
    try:
        req = svc.mark_executing(request_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="restore request not found")
    except InvalidTransition as exc:
        # 409 — most commonly "must be approved first" (four-eyes not satisfied).
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    _audit("execute", req, user)
    command = (
        "scripts/dr/restore-tenant.sh "
        f"--org-id {req.org_id} "
        f"--source {req.source_path} "
        f"--apply --mode {req.mode} --yes"
    )
    return CommandResponse(
        request_id=req.id,
        org_id=req.org_id,
        command=command,
        note=(
            "Run this on the incident bridge with prod gcloud creds. After it "
            "completes, report the result via POST /api/admin/dr/restore/"
            f"{req.id}/result (or the worker will). Rollback guidance is printed "
            "by the script and in docs/runbooks/dr-restore.md."
        ),
    )


@router.post(
    "/{request_id}/result",
    response_model=RestoreRequestDoc,
    responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
    summary="Report the outcome of an executed restore (completes/fails the request)",
)
async def report_result(
    request_id: str = Path(..., min_length=1, max_length=128),
    result: dict = Body(..., description="Per-collection summary from the restore script"),
    error_message: Optional[str] = Body(None, embed=True),
    user: dict = Depends(get_current_user),
) -> RestoreRequestDoc:
    _require_super_admin(user)
    svc = _service()
    try:
        req = svc.mark_executed(request_id, result=result, error_message=error_message)
    except KeyError:
        raise HTTPException(status_code=404, detail="restore request not found")
    _audit("result", req, user, {"error_message": error_message})
    return _doc(req)


ALL_ROUTERS = [router]

__all__ = ["router", "ALL_ROUTERS"]
