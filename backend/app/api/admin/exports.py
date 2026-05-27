"""Tenant export endpoint (P4 / R7.7).

``POST /api/admin/tenants/{tenant_id}/export`` schedules a zip export of all
documents under ``tenants/{tenant_id}/...`` to a GCS bucket, then returns a
short-lived signed URL once the file is ready.

The export runs in-process for now (small/medium tenants). Very large tenants
should be migrated to a backgrounded Cloud Tasks job — out of scope for P4
but the response model accommodates an async "pending" state.

RBAC
----
Requires the caller to have the ``admin`` role (or ``super_admin``). Audited
via :func:`_audit_export`.
"""
from __future__ import annotations

import asyncio
import io
import json
import logging
import time
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, ConfigDict, Field

from app.security.dependencies import get_current_user
from app.firestore.client import get_async_client

log = logging.getLogger("api.admin.exports")

router = APIRouter(prefix="/api/admin", tags=["Admin / Exports"])


# ── Schemas ────────────────────────────────────────────────────────────────


class ExportResponse(BaseModel):
    """Response payload for a tenant export request."""

    model_config = ConfigDict(extra="ignore")

    tenant_id: str = Field(..., description="Tenant whose data was exported")
    status: str = Field(..., description='"ready" or "pending"')
    signed_url: Optional[str] = Field(
        None, description="GCS signed URL valid for 1 hour"
    )
    gcs_path: Optional[str] = Field(None, description="Object path inside the bucket")
    bytes: Optional[int] = Field(None, description="Compressed archive size in bytes")
    document_count: Optional[int] = Field(None, description="Total docs included")
    requested_at: datetime
    completed_at: Optional[datetime] = None


class ExportErrorResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    error: str
    detail: str


# ── Permission helpers ─────────────────────────────────────────────────────


def _require_admin(user: dict) -> None:
    """Raise 403 unless ``user`` has an admin role."""
    role = (user.get("role") or "").lower()
    if role not in ("admin", "super_admin") and not user.get("is_platform_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin role required",
        )


def _require_tenant_access(user: dict, tenant_id: str) -> None:
    """Allow super_admin everywhere; tenant admin only on own tenant."""
    if user.get("is_platform_admin") or (user.get("role") or "").lower() == "super_admin":
        return
    user_tenant = user.get("tenant_id") or user.get("org_id")
    if user_tenant != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="tenant mismatch",
        )


# ── Audit ──────────────────────────────────────────────────────────────────


async def _audit_export(tenant_id: str, user: dict, gcs_path: Optional[str]) -> None:
    """Best-effort audit log entry. Never raises."""
    try:
        client = get_async_client()
        await client.collection("audit_logs").document(uuid.uuid4().hex).set({
            "type": "tenant_export",
            "tenant_id": tenant_id,
            "actor_id": user.get("id"),
            "actor_role": user.get("role"),
            "gcs_path": gcs_path,
            "ts": datetime.now(timezone.utc),
        })
    except Exception as e:  # noqa: BLE001
        log.warning("audit.export_failed", extra={"err": str(e)})


# ── Iteration ──────────────────────────────────────────────────────────────


_DEFAULT_COLLECTIONS: tuple[str, ...] = (
    "contacts",
    "items",
    "invoices",
    "bills",
    "quotes",
    "expenses",
    "payments",
    "projects",
    "accounts",
    "journals",
    "tasks",
    "activities",
    "users",
)


async def _iterate_tenant_docs(tenant_id: str) -> dict[str, list[dict]]:
    """Read every doc in ``tenants/{tid}/...`` collections.

    Returns a mapping ``{collection_name: [doc_dict, ...]}``. Each doc has its
    Firestore id under ``_id``.
    """
    client = get_async_client()
    tenant_ref = client.collection("tenants").document(tenant_id)

    out: dict[str, list[dict]] = {}
    # The tenant root doc itself:
    try:
        root_snap = await tenant_ref.get()
        if root_snap.exists:
            out["_root"] = [{"_id": tenant_id, **(root_snap.to_dict() or {})}]
    except Exception as e:  # noqa: BLE001
        log.warning("export.root_read_failed", extra={"err": str(e), "tenant": tenant_id})

    # Iterate subcollections. ``list_collections`` is sync-only on most SDKs;
    # we fall back to a known whitelist if discovery fails.
    subcollections: list[str] = []
    try:
        # AsyncClient exposes async iteration of collections in some versions.
        async for sub in tenant_ref.collections():  # type: ignore[attr-defined]
            subcollections.append(sub.id)
    except Exception:  # noqa: BLE001
        subcollections = list(_DEFAULT_COLLECTIONS)

    for name in subcollections:
        rows: list[dict] = []
        try:
            async for snap in tenant_ref.collection(name).stream():
                rows.append({"_id": snap.id, **(snap.to_dict() or {})})
        except Exception as e:  # noqa: BLE001
            log.warning(
                "export.collection_failed",
                extra={"err": str(e), "tenant": tenant_id, "collection": name},
            )
            continue
        if rows:
            out[name] = rows

    return out


# ── GCS upload ─────────────────────────────────────────────────────────────


def _build_zip(data: dict[str, list[dict]]) -> bytes:
    """Zip the dict-of-lists into a single archive with one JSON per collection."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for coll, rows in data.items():
            payload = json.dumps(rows, default=str, ensure_ascii=False, indent=2)
            zf.writestr(f"{coll}.json", payload)
    return buf.getvalue()


async def _upload_to_gcs(
    tenant_id: str, payload: bytes
) -> tuple[Optional[str], Optional[str]]:
    """Upload ``payload`` to GCS and return ``(gcs_path, signed_url)``.

    Falls back to ``(None, None)`` on configuration errors so the caller can
    respond with status="pending" and a clear error message.
    """
    import os
    try:
        from google.cloud import storage  # type: ignore
    except Exception as e:  # noqa: BLE001
        log.warning("export.gcs_lib_missing", extra={"err": str(e)})
        return None, None

    bucket_name = os.environ.get(
        "EXPORT_BUCKET", os.environ.get("FIREBASE_STORAGE_BUCKET", "")
    )
    if not bucket_name:
        log.warning("export.no_bucket_configured")
        return None, None

    object_path = f"tenant-exports/{tenant_id}/{int(time.time())}.zip"

    def _do_upload() -> tuple[str, str]:
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(object_path)
        blob.upload_from_string(payload, content_type="application/zip")
        url = blob.generate_signed_url(
            expiration=timedelta(hours=1),
            method="GET",
        )
        return object_path, url

    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(None, _do_upload)
    except Exception as e:  # noqa: BLE001
        log.warning("export.upload_failed", extra={"err": str(e)})
        return None, None


# ── Endpoint ───────────────────────────────────────────────────────────────


@router.post(
    "/tenants/{tenant_id}/export",
    response_model=ExportResponse,
    responses={
        403: {"model": ExportErrorResponse},
        500: {"model": ExportErrorResponse},
    },
    summary="Export all documents for a tenant to GCS (R7.7)",
)
async def export_tenant(
    tenant_id: str = Path(..., min_length=1, max_length=128),
    user: dict = Depends(get_current_user),
) -> ExportResponse:
    """Synchronously assemble a zip export and return a signed URL.

    Future work: switch to Cloud Tasks for tenants with > 50k docs.
    """
    _require_admin(user)
    _require_tenant_access(user, tenant_id)

    requested_at = datetime.now(timezone.utc)
    log.info(
        "export.start",
        extra={"tenant_id": tenant_id, "actor": user.get("id")},
    )

    try:
        data = await _iterate_tenant_docs(tenant_id)
    except Exception as e:  # noqa: BLE001
        log.exception("export.iteration_failed", extra={"err": str(e)})
        raise HTTPException(status_code=500, detail="export failed") from e

    doc_count = sum(len(v) for v in data.values())
    payload = _build_zip(data)
    gcs_path, signed_url = await _upload_to_gcs(tenant_id, payload)

    await _audit_export(tenant_id, user, gcs_path)

    completed_at = datetime.now(timezone.utc)
    log.info(
        "export.complete",
        extra={
            "tenant_id": tenant_id,
            "docs": doc_count,
            "bytes": len(payload),
            "duration_s": (completed_at - requested_at).total_seconds(),
        },
    )

    return ExportResponse(
        tenant_id=tenant_id,
        status="ready" if signed_url else "pending",
        signed_url=signed_url,
        gcs_path=gcs_path,
        bytes=len(payload),
        document_count=doc_count,
        requested_at=requested_at,
        completed_at=completed_at,
    )


__all__ = ["router", "ExportResponse"]
