"""REST API endpoints for Iraq e-Fakhata.

Routes mounted under ``/api`` (no shared prefix; the routes themselves
hard-code the full paths so they match what the frontend expects).

    POST /api/invoices/{id}/efakhata/submit
    GET  /api/efakhata/submissions
    GET  /api/efakhata/submissions/{sid}
    POST /api/efakhata/submissions/{sid}/cancel
    POST /api/tenants/{tid}/efakhata/cert        (multipart, admin only)
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field

from app.efakhata import submission_queue as q
from app.efakhata.builder import EFakhataBuildError, EFakhataBuilder
from app.efakhata.cert_storage import (
    CertNotFound,
    CertStoreUnavailable,
    list_tenant_certs,
    revoke_tenant_cert,
    upload_tenant_cert,
)
from app.efakhata.schema import EFakhataInvoice
from app.efakhata.signing import SigningUnavailable, sign as sign_xml
from app.efakhata.submission_queue import SubmissionQueueRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm

logger = logging.getLogger(__name__)

router = APIRouter(tags=["efakhata"])

ALL_ROUTERS = [router]


# ─────────────────────────────────────────────────────────────────────────────
# Request/response models
# ─────────────────────────────────────────────────────────────────────────────


class SubmissionResponse(BaseModel):
    id: str
    invoice_id: str
    status: str
    attempts: int = 0
    mof_ack_number: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    next_attempt_at: Optional[str] = None
    history: list[dict] = Field(default_factory=list)


class CertUploadResponse(BaseModel):
    tenant_id: str
    fingerprint: str
    uploaded_at: datetime


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _load_invoice(org_id: str, invoice_id: str) -> tuple[dict, dict, Optional[dict]]:
    """Return (invoice, supplier_profile, customer_profile)."""
    from app.firestore.base import BaseRepository

    class _InvRepo(BaseRepository):
        collection_name = "invoices"

    inv = _InvRepo(org_id).get(invoice_id)
    if not inv:
        raise HTTPException(404, "invoice_not_found")
    # Lines stored as subcollection.
    inv["lines"] = _InvRepo(org_id).get_lines(invoice_id)

    # Supplier = the org's primary company doc.
    supplier: Optional[dict] = None
    try:
        from app.firestore.companies import CompanyRepository

        comps, _ = CompanyRepository(org_id).list(limit=1)
        supplier = comps[0] if comps else None
    except Exception:
        supplier = None
    if not supplier:
        # Fallback to a minimal shape so the builder error is clearer.
        supplier = {"name": org_id, "tax_id": None, "address": {}}

    # Customer
    customer = None
    contact_id = inv.get("contact_id")
    if contact_id:
        class _Contacts(BaseRepository):
            collection_name = "contacts"

        customer = _Contacts(org_id).get(contact_id)

    return inv, supplier, customer


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────


@router.post(
    "/api/invoices/{invoice_id}/efakhata/submit",
    status_code=201,
    response_model=SubmissionResponse,
    dependencies=[Depends(require_perm("invoices.update"))],
)
def submit_invoice_to_efakhata(
    invoice_id: str,
    response: Response,
    user: dict = Depends(get_current_user),
):
    """Build → sign → enqueue (dedup on invoice_id)."""
    org_id = user["org_id"]
    invoice, supplier, customer = _load_invoice(org_id, invoice_id)

    try:
        model = EFakhataBuilder.from_invoice(
            invoice,
            supplier_profile=supplier,
            customer_profile=customer,
        )
    except EFakhataBuildError as exc:
        raise HTTPException(422, {"code": "build_failed", "message": str(exc)})

    xml = model.to_xml(include_signature_placeholder=True)
    try:
        signed = sign_xml(xml, tenant_id=org_id)
    except CertNotFound:
        raise HTTPException(412, {"code": "cert_missing",
                                   "message": "tenant signing cert not uploaded"})
    except SigningUnavailable as exc:
        raise HTTPException(503, {"code": "signing_unavailable", "message": str(exc)})

    repo = SubmissionQueueRepository(org_id)
    record = repo.enqueue(
        invoice_id=invoice_id,
        xml_signed=signed.decode("utf-8"),
        created_by=user.get("id", "system"),
    )
    response.headers["Location"] = f"/api/efakhata/submissions/{record['id']}"
    return SubmissionResponse(**_to_response(record))


@router.get(
    "/api/efakhata/submissions/{submission_id}",
    response_model=SubmissionResponse,
    dependencies=[Depends(require_perm("invoices.read"))],
)
def get_submission(submission_id: str, user: dict = Depends(get_current_user)):
    repo = SubmissionQueueRepository(user["org_id"])
    record = repo.get(submission_id)
    if not record:
        raise HTTPException(404, "submission_not_found")
    return SubmissionResponse(**_to_response(record))


@router.get(
    "/api/efakhata/submissions",
    dependencies=[Depends(require_perm("invoices.read"))],
)
def list_submissions(
    status_filter: Optional[str] = Query(None, alias="status"),
    invoice_id: Optional[str] = None,
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    repo = SubmissionQueueRepository(user["org_id"])
    filters: list[dict] = []
    if status_filter:
        filters.append({"field": "status", "op": "==", "value": status_filter})
    if invoice_id:
        filters.append({"field": "invoice_id", "op": "==", "value": invoice_id})
    if from_date:
        filters.append({"field": "created_at", "op": ">=",
                        "value": datetime.fromisoformat(from_date)})
    if to_date:
        filters.append({"field": "created_at", "op": "<=",
                        "value": datetime.fromisoformat(to_date)})
    items, total = repo.list(filters=filters, limit=limit, order_by="created_at")
    return {"items": [_to_response(it) for it in items], "total": total}


@router.post(
    "/api/efakhata/submissions/{submission_id}/cancel",
    dependencies=[Depends(require_perm("invoices.update"))],
)
def cancel_submission(
    submission_id: str,
    user: dict = Depends(get_current_user),
):
    # Admin-only at the role level — re-check is_admin in case.
    if user.get("role") not in {"admin", "owner"}:
        raise HTTPException(403, "admin_required")
    repo = SubmissionQueueRepository(user["org_id"])
    record = repo.get(submission_id)
    if not record:
        raise HTTPException(404, "submission_not_found")
    if record["status"] in q.TERMINAL_STATUSES:
        raise HTTPException(409, f"already_in_terminal_state:{record['status']}")
    updated = repo.cancel(submission_id, reason="cancelled_by_admin")
    return _to_response(updated)


@router.post(
    "/api/tenants/{tenant_id}/efakhata/cert",
    status_code=201,
    response_model=CertUploadResponse,
)
async def upload_tenant_efakhata_cert(
    tenant_id: str,
    cert_file: UploadFile = File(...),
    password: str = Form(...),
    user: dict = Depends(require_perm("settings.billing")),
):
    """Multipart upload of the tenant's signing PKCS#12 + password.

    The password is never logged or echoed in the response.
    """
    if user["org_id"] != tenant_id and user.get("role") not in {"super_admin"}:
        raise HTTPException(403, "tenant_mismatch")

    p12_bytes = await cert_file.read()
    if not p12_bytes:
        raise HTTPException(400, "cert_file_empty")

    try:
        metadata = upload_tenant_cert(tenant_id, p12_bytes, password)
    except CertStoreUnavailable as exc:
        raise HTTPException(503, {"code": "cert_store_unavailable", "message": str(exc)})
    finally:
        # Scrub the password from this frame as soon as the call returns.
        password = ""  # noqa: F841

    return CertUploadResponse(
        tenant_id=tenant_id,
        fingerprint=metadata.fingerprint,
        uploaded_at=metadata.uploaded_at,
    )


@router.get(
    "/api/tenants/{tenant_id}/efakhata/cert",
    dependencies=[Depends(require_perm("settings.billing"))],
)
def list_tenant_efakhata_certs(tenant_id: str,
                                user: dict = Depends(get_current_user)):
    if user["org_id"] != tenant_id and user.get("role") not in {"super_admin"}:
        raise HTTPException(403, "tenant_mismatch")
    items = list_tenant_certs(tenant_id)
    return {
        "items": [
            {
                "version": m.version,
                "uploaded_at": m.uploaded_at,
                "fingerprint": m.fingerprint,
                "revoked": m.revoked,
                "revoked_reason": m.revoked_reason,
            }
            for m in items
        ],
        "total": len(items),
    }


@router.delete(
    "/api/tenants/{tenant_id}/efakhata/cert",
    dependencies=[Depends(require_perm("settings.billing"))],
)
def revoke_tenant_efakhata_cert(
    tenant_id: str,
    reason: str = Query("manual_revocation"),
    user: dict = Depends(get_current_user),
):
    if user["org_id"] != tenant_id and user.get("role") not in {"super_admin"}:
        raise HTTPException(403, "tenant_mismatch")
    try:
        revoke_tenant_cert(tenant_id, reason)
    except CertNotFound:
        raise HTTPException(404, "cert_not_found")
    except CertStoreUnavailable as exc:
        raise HTTPException(503, {"code": "cert_store_unavailable", "message": str(exc)})
    return {"status": "revoked", "tenant_id": tenant_id, "reason": reason}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _to_response(record: dict) -> dict:
    """Shape a queue record into the SubmissionResponse model dict."""
    return {
        "id": record.get("id"),
        "invoice_id": record.get("invoice_id"),
        "status": record.get("status"),
        "attempts": int(record.get("attempts") or 0),
        "mof_ack_number": record.get("mof_ack_number"),
        "error_code": record.get("error_code"),
        "error_message": record.get("error_message"),
        "created_at": record.get("created_at"),
        "next_attempt_at": record.get("next_attempt_at"),
        "history": record.get("history") or [],
    }
