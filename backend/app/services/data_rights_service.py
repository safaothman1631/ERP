"""Tenant-facing GDPR/PDPL data-rights orchestration (T-SF.2.22).

This service powers a tenant *admin's* self-service data rights — distinct from
the super-admin tooling in ``app.api.admin.exports`` / ``app.api.admin.pii_delete``
(which act on arbitrary tenants and require platform/super-admin). Here the
caller can only ever touch their own ``org_id``.

Two rights are implemented:

* **Export** (GDPR Art. 15 + 20 / Iraq PDPL access + portability): assemble a
  single ZIP containing one JSON document per org-scoped collection, upload it to
  the configured export bucket, and hand back a short-lived signed URL. Falls
  back to ``status="pending"`` with a clear ``error`` when no bucket / GCS lib is
  configured (mirrors the super-admin exporter's behaviour so dev works offline).

* **Erasure** (GDPR Art. 17 / Iraq PDPL right to be forgotten): a two-phase
  *request → confirm* flow. Confirming does **not** delete immediately — it
  schedules a hard delete after the same 30-day grace window used by
  :data:`app.services.gdpr_service.GRACE_DAYS`. ``app.services.data_rights_purge``
  finalizes confirmed requests once their grace period elapses, reusing the
  existing soft-delete markers + scheduler conventions.

Org scoping: reads use :meth:`BaseRepository.stream_org_docs`, which filters by
``org_id`` and therefore never crosses tenant boundaries.
"""
from __future__ import annotations

import io
import json
import logging
import os
import secrets
import time
import uuid
import zipfile
from datetime import datetime, timedelta
from typing import Any, Optional

from app.firestore.base import BaseRepository
from app.firestore.data_rights_repo import DataRightsRequestRepository
from app.services.gdpr_service import GRACE_DAYS

logger = logging.getLogger(__name__)


# ── Status enums ────────────────────────────────────────────────────────────

# Export lifecycle.
EXPORT_PENDING = "pending"      # accepted, archive not yet available (no bucket)
EXPORT_READY = "ready"          # signed URL available
EXPORT_FAILED = "failed"        # iteration/upload failed

# Erasure lifecycle.
ERASURE_AWAITING_CONFIRM = "awaiting_confirmation"
ERASURE_SCHEDULED = "scheduled"          # confirmed; hard-delete pending grace
ERASURE_COMPLETED = "completed"          # grace elapsed, data purged
ERASURE_CANCELLED = "cancelled"          # admin cancelled before grace ended


# ── Collections included in a full-tenant export ──────────────────────────────
#
# Mirrors the super-admin exporter's whitelist but extended with the records a
# tenant most often needs for a portability request. Each name is the top-level
# Firestore collection that ``BaseRepository`` reads with an ``org_id`` filter.
EXPORTABLE_COLLECTIONS: tuple[str, ...] = (
    "contacts",
    "items",
    "invoices",
    "quotes",
    "sales_orders",
    "credit_notes",
    "bills",
    "purchase_orders",
    "vendor_credits",
    "expenses",
    "payments",
    "projects",
    "tasks",
    "accounts",
    "journals",
    "journal_entries",
    "taxes",
    "bank_accounts",
    "warehouses",
    "inventory",
    "activities",
    "users",
)


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


class _ScopedRepo(BaseRepository):
    """Lightweight org-scoped reader for an arbitrary collection name.

    ``BaseRepository`` keys all reads off ``collection_name`` + ``org_id``; we set
    the collection name per-instance so a single class can stream any collection
    for the export without a dedicated subclass for each.
    """

    def __init__(self, org_id: str, collection_name: str):
        self.collection_name = collection_name
        super().__init__(org_id)


# ── Export ────────────────────────────────────────────────────────────────────


def _collect_org_data(org_id: str) -> dict[str, list[dict]]:
    """Stream every exportable collection for ``org_id`` into a dict-of-lists.

    Soft-deleted rows are included (``include_deleted=True``) so the export is a
    faithful record of what we hold — a portability request should not silently
    omit data pending purge.
    """
    out: dict[str, list[dict]] = {}
    for name in EXPORTABLE_COLLECTIONS:
        rows: list[dict] = []
        try:
            for doc in _ScopedRepo(org_id, name).stream_org_docs(include_deleted=True):
                rows.append(doc)
        except Exception as exc:  # noqa: BLE001 — one bad collection must not abort the export
            logger.warning(
                "data_rights.export.collection_failed",
                extra={"org_id": org_id, "collection": name, "error": str(exc)},
            )
            continue
        if rows:
            out[name] = rows
    return out


def build_export_zip(data: dict[str, list[dict]]) -> bytes:
    """Zip a dict-of-lists into one JSON file per collection + a manifest."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        manifest = {
            "generated_at": _now_iso(),
            "format": "json-per-collection",
            "collections": {coll: len(rows) for coll, rows in data.items()},
        }
        zf.writestr("manifest.json", json.dumps(manifest, indent=2, ensure_ascii=False))
        for coll, rows in data.items():
            payload = json.dumps(rows, default=str, ensure_ascii=False, indent=2)
            zf.writestr(f"{coll}.json", payload)
    return buf.getvalue()


def _upload_export(org_id: str, payload: bytes) -> tuple[Optional[str], Optional[str]]:
    """Upload ``payload`` to the export bucket; return ``(gcs_path, signed_url)``.

    Returns ``(None, None)`` when GCS is unavailable/unconfigured so the caller can
    record a ``pending`` request rather than failing — keeps dev/offline working.
    """
    try:
        from google.cloud import storage  # type: ignore
    except Exception as exc:  # noqa: BLE001
        logger.warning("data_rights.export.gcs_lib_missing", extra={"error": str(exc)})
        return None, None

    bucket_name = os.environ.get(
        "EXPORT_BUCKET", os.environ.get("FIREBASE_STORAGE_BUCKET", "")
    )
    if not bucket_name:
        logger.warning("data_rights.export.no_bucket_configured")
        return None, None

    object_path = f"data-rights-exports/{org_id}/{int(time.time())}-{secrets.token_hex(4)}.zip"
    try:
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(object_path)
        blob.upload_from_string(payload, content_type="application/zip")
        url = blob.generate_signed_url(expiration=timedelta(hours=1), method="GET")
        return object_path, url
    except Exception as exc:  # noqa: BLE001
        logger.warning("data_rights.export.upload_failed", extra={"error": str(exc)})
        return None, None


def request_export(org_id: str, *, requested_by: str, requested_by_email: Optional[str] = None) -> dict:
    """Assemble + persist a full-tenant export request and return its record.

    Runs in-process (small/medium tenants). The record is stored in
    ``data_rights_requests`` so the UI can list it and re-download via
    :func:`get_export` while the signed URL is valid.
    """
    repo = DataRightsRequestRepository(org_id)
    req_id = _new_id()
    requested_at = _now_iso()

    try:
        data = _collect_org_data(org_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("data_rights.export.iteration_failed", extra={"org_id": org_id})
        rec = repo.create({
            "id": req_id,
            "kind": "export",
            "status": EXPORT_FAILED,
            "requested_by": requested_by,
            "requested_by_email": requested_by_email,
            "requested_at": requested_at,
            "error": str(exc),
        })
        return rec

    doc_count = sum(len(v) for v in data.values())
    payload = build_export_zip(data)
    gcs_path, signed_url = _upload_export(org_id, payload)

    status_val = EXPORT_READY if signed_url else EXPORT_PENDING
    rec = repo.create({
        "id": req_id,
        "kind": "export",
        "status": status_val,
        "requested_by": requested_by,
        "requested_by_email": requested_by_email,
        "requested_at": requested_at,
        "completed_at": _now_iso(),
        "signed_url": signed_url,
        "gcs_path": gcs_path,
        "bytes": len(payload),
        "document_count": doc_count,
        "collections": {coll: len(rows) for coll, rows in data.items()},
        "error": None if signed_url else "export bucket not configured; archive not persisted",
    })
    logger.info(
        "data_rights.export.complete",
        extra={"org_id": org_id, "request_id": req_id, "docs": doc_count, "status": status_val},
    )
    return rec


def get_export(org_id: str, request_id: str) -> Optional[dict]:
    """Fetch a single export/erasure request scoped to ``org_id`` (or ``None``)."""
    repo = DataRightsRequestRepository(org_id)
    rec = repo.get(request_id)
    # ``BaseRepository.get`` already enforces org scoping (returns None on mismatch).
    return rec


def list_requests(org_id: str, *, kind: Optional[str] = None, limit: int = 50) -> list[dict]:
    """List data-rights requests for ``org_id``, newest first, optionally by kind."""
    repo = DataRightsRequestRepository(org_id)
    filters = [{"field": "kind", "op": "==", "value": kind}] if kind else None
    items, _ = repo.list(
        filters=filters,
        order_by="requested_at",
        order_dir="DESCENDING",
        limit=limit,
    )
    return items


# ── Erasure ─────────────────────────────────────────────────────────────────


def request_erasure(
    org_id: str,
    *,
    requested_by: str,
    requested_by_email: Optional[str] = None,
    reason: Optional[str] = None,
) -> dict:
    """Open an erasure request in the *awaiting confirmation* state.

    Returns the new record including a ``confirm_token`` the admin must echo to
    :func:`confirm_erasure`. Nothing is deleted at this stage.
    """
    repo = DataRightsRequestRepository(org_id)
    rec = repo.create({
        "id": _new_id(),
        "kind": "erasure",
        "status": ERASURE_AWAITING_CONFIRM,
        "requested_by": requested_by,
        "requested_by_email": requested_by_email,
        "reason": reason,
        "requested_at": _now_iso(),
        "confirm_token": secrets.token_urlsafe(24),
        "grace_days": GRACE_DAYS,
    })
    logger.info(
        "data_rights.erasure.requested",
        extra={"org_id": org_id, "request_id": rec["id"]},
    )
    return rec


class ErasureError(Exception):
    """Raised on invalid erasure state transitions (mapped to HTTP 4xx by the API)."""


def confirm_erasure(org_id: str, request_id: str, *, confirm_token: str, actor_id: str) -> dict:
    """Confirm a pending erasure request, scheduling a hard delete after grace.

    Honours the existing 30-day grace period: this sets ``scheduled_purge_at`` to
    ``now + GRACE_DAYS`` and flips status to ``scheduled``. The actual destruction
    is performed by :mod:`app.services.data_rights_purge` once that time arrives.

    Raises :class:`ErasureError` if the request is missing, not an erasure
    request, already finalized, or the token does not match.
    """
    repo = DataRightsRequestRepository(org_id)
    rec = repo.get(request_id)
    if not rec or rec.get("kind") != "erasure":
        raise ErasureError("erasure request not found")
    if rec.get("status") != ERASURE_AWAITING_CONFIRM:
        raise ErasureError(f"request is not awaiting confirmation (status={rec.get('status')})")
    if not confirm_token or not secrets.compare_digest(str(rec.get("confirm_token") or ""), confirm_token):
        raise ErasureError("confirmation token mismatch")

    now = datetime.utcnow()
    scheduled = now + timedelta(days=GRACE_DAYS)
    updated = repo.update(request_id, {
        "status": ERASURE_SCHEDULED,
        "confirmed_at": now.isoformat(),
        "confirmed_by": actor_id,
        "scheduled_purge_at": scheduled.isoformat(),
        # Drop the token once consumed so it cannot be replayed.
        "confirm_token": None,
    })
    logger.info(
        "data_rights.erasure.scheduled",
        extra={"org_id": org_id, "request_id": request_id, "purge_at": scheduled.isoformat()},
    )
    return updated


def cancel_erasure(org_id: str, request_id: str, *, actor_id: str) -> dict:
    """Cancel an erasure request before its grace period elapses.

    Allowed while *awaiting confirmation* or *scheduled*. A request that has
    already been purged cannot be cancelled.
    """
    repo = DataRightsRequestRepository(org_id)
    rec = repo.get(request_id)
    if not rec or rec.get("kind") != "erasure":
        raise ErasureError("erasure request not found")
    if rec.get("status") not in (ERASURE_AWAITING_CONFIRM, ERASURE_SCHEDULED):
        raise ErasureError(f"request can no longer be cancelled (status={rec.get('status')})")

    updated = repo.update(request_id, {
        "status": ERASURE_CANCELLED,
        "cancelled_at": _now_iso(),
        "cancelled_by": actor_id,
        "confirm_token": None,
    })
    logger.info(
        "data_rights.erasure.cancelled",
        extra={"org_id": org_id, "request_id": request_id},
    )
    return updated
