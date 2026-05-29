"""Auditor-export REST endpoints for Iraq e-Fakhata.

    POST /api/efakhata/auditor-export      → creates a batch
    GET  /api/efakhata/auditor-export      → list past batches
    GET  /api/efakhata/auditor-export/{id} → status + signed URL when ready

The actual ZIP building runs in-process here for simplicity; production
deployments may swap this for a Cloud Task / Cloud Run job. The
endpoint returns 202 with a batch_id immediately when ``async_build``
is True (default) and processes synchronously when False (used by tests
and small datasets).
"""
from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from app.efakhata.auditor_export import (
    AuditorExportBatchRepository,
    create_export_batch,
    run_export_batch,
)
from app.services.auth import get_current_user
from app.services.permissions import require_perm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/efakhata", tags=["efakhata-export"])

ALL_ROUTERS = [router]


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────


class CreateExportRequest(BaseModel):
    start_date: date
    end_date: date

    @field_validator("end_date")
    @classmethod
    def _range_valid(cls, v: date, info) -> date:
        start = (info.data or {}).get("start_date")
        if start and v < start:
            raise ValueError("end_date must be >= start_date")
        return v


class ExportBatchResponse(BaseModel):
    id: str
    status: str
    start_date: str
    end_date: str
    requested_by: str
    invoice_count: int = 0
    gcs_path: Optional[str] = None
    signed_url: Optional[str] = None
    signed_url_expires_at: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────


@router.post(
    "/auditor-export",
    status_code=202,
    response_model=ExportBatchResponse,
    dependencies=[Depends(require_perm("reports.export"))],
)
def create_auditor_export(
    payload: CreateExportRequest,
    background: BackgroundTasks,
    async_build: bool = Query(True),
    user: dict = Depends(get_current_user),
):
    org_id = user["org_id"]
    record = create_export_batch(
        tenant_id=org_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        requested_by=user.get("id", "system"),
    )

    invoice_lookup = _build_invoice_lookup(org_id)

    if async_build:
        background.add_task(
            _safe_run_batch, org_id, record["id"], invoice_lookup
        )
    else:
        _safe_run_batch(org_id, record["id"], invoice_lookup)
        record = AuditorExportBatchRepository(org_id).get(record["id"]) or record

    return ExportBatchResponse(**_to_response(record))


@router.get(
    "/auditor-export",
    dependencies=[Depends(require_perm("reports.export"))],
)
def list_auditor_exports(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    repo = AuditorExportBatchRepository(user["org_id"])
    items, total = repo.list(limit=limit, order_by="created_at")
    return {"items": [_to_response(it) for it in items], "total": total}


@router.get(
    "/auditor-export/{batch_id}",
    response_model=ExportBatchResponse,
    dependencies=[Depends(require_perm("reports.export"))],
)
def get_auditor_export(batch_id: str, user: dict = Depends(get_current_user)):
    repo = AuditorExportBatchRepository(user["org_id"])
    record = repo.get(batch_id)
    if not record:
        raise HTTPException(404, "batch_not_found")
    return ExportBatchResponse(**_to_response(record))


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _build_invoice_lookup(org_id: str):
    """Return a callable that fetches an invoice by id, lines included."""
    from app.firestore.base import BaseRepository

    class _InvRepo(BaseRepository):
        collection_name = "invoices"

    repo = _InvRepo(org_id)

    def _lookup(invoice_id: str) -> Optional[dict]:
        inv = repo.get(invoice_id)
        if inv:
            inv["lines"] = repo.get_lines(invoice_id)
        return inv

    return _lookup


def _safe_run_batch(org_id: str, batch_id: str, invoice_lookup) -> None:
    try:
        run_export_batch(
            tenant_id=org_id,
            batch_id=batch_id,
            invoice_lookup=invoice_lookup,
        )
    except Exception:
        logger.exception("efakhata_auditor_export_failed",
                         extra={"batch_id": batch_id, "org_id": org_id})
        try:
            repo = AuditorExportBatchRepository(org_id)
            repo.update(batch_id, {"status": "failed",
                                   "completed_at": datetime.utcnow().isoformat()})
        except Exception:
            pass


def _to_response(record: dict) -> dict:
    return {
        "id": record.get("id"),
        "status": record.get("status") or "pending",
        "start_date": record.get("start_date") or "",
        "end_date": record.get("end_date") or "",
        "requested_by": record.get("requested_by") or "",
        "invoice_count": int(record.get("invoice_count") or 0),
        "gcs_path": record.get("gcs_path"),
        "signed_url": record.get("signed_url"),
        "signed_url_expires_at": record.get("signed_url_expires_at"),
        "created_at": record.get("created_at"),
        "completed_at": record.get("completed_at"),
    }
