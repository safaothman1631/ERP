from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.firestore.contacts import ContactRepository
from app.firestore.einvoice import EInvoiceSubmissionRepository
from app.firestore.invoices import InvoiceRepository
from app.firestore.organizations import OrganizationRepository
from app.firestore.system import SettingsRepository
from app.services.auth import get_current_user
from app.services.einvoice_service import (
    generate_fiscal_id,
    generate_qr_base64,
    generate_qr_payload,
    generate_xml,
    mask_einvoice_config,
    merge_einvoice_config,
    sign_xml,
    submit_to_ita,
    fetch_submission_status,
    cancel_submission,
)


router = APIRouter(prefix="/api/einvoice", tags=["Iraq E-Invoice"])


class EInvoiceConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    preview_mode: Optional[bool] = None
    environment: Optional[str] = Field(default=None, max_length=20)
    portal_url: Optional[str] = Field(default=None, max_length=500)
    status_url_template: Optional[str] = Field(default=None, max_length=500)
    cancel_url: Optional[str] = Field(default=None, max_length=500)
    seller_tax_id: Optional[str] = Field(default=None, max_length=100)
    branch_code: Optional[str] = Field(default=None, max_length=100)
    api_key: Optional[str] = None
    auth_token: Optional[str] = None
    private_key_pem: Optional[str] = None
    private_key_password: Optional[str] = None
    auto_submit_on_send: Optional[bool] = None


class EInvoiceCancelRequest(BaseModel):
    reason: Optional[str] = Field(default="", max_length=500)


class EInvoiceAutoSubmitRequest(BaseModel):
    enabled: bool


def _get_config_setting(repo: SettingsRepository):
    filters = [
        {"field": "key", "op": "==", "value": "einvoice_config"},
        {"field": "category", "op": "==", "value": "integrations"},
    ]
    items, _ = repo.list(filters=filters, limit=1)
    return items[0] if items else None


def _load_config(org_id: str) -> tuple[SettingsRepository, dict, Optional[dict]]:
    repo = SettingsRepository(org_id)
    setting = _get_config_setting(repo)
    config = merge_einvoice_config(setting.get("value") if setting else None)
    return repo, config, setting


def _save_config(org_id: str, data: dict):
    repo = SettingsRepository(org_id)
    setting = _get_config_setting(repo)
    if setting:
        return repo.update(setting["id"], {"value": data})
    return repo.create({"key": "einvoice_config", "category": "integrations", "value": data})


def _load_invoice_context(org_id: str, invoice_id: str):
    invoice_repo = InvoiceRepository(org_id)
    invoice = invoice_repo.get_with_lines(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="وەسڵ نەدۆزرایەوە")

    org = OrganizationRepository(org_id).get(org_id)
    if not org:
        raise HTTPException(status_code=500, detail="زانیاری ڕێکخراو نەدۆزرایەوە")

    contact = None
    if invoice.get("contact_id"):
        contact = ContactRepository(org_id).get(invoice["contact_id"])

    return invoice, org, contact, invoice.get("lines") or []


def _build_or_refresh_submission(org_id: str, invoice_id: str):
    repo = EInvoiceSubmissionRepository(org_id)
    invoice, org, contact, lines = _load_invoice_context(org_id, invoice_id)
    _, config, _ = _load_config(org_id)

    existing = repo.get_by_invoice_id(invoice_id)
    fiscal_id = generate_fiscal_id(invoice, existing.get("fiscal_id") if existing else None)
    seller_tax_id = config.get("seller_tax_id") or org.get("tax_number") or ""
    qr_payload = generate_qr_payload(invoice, seller_tax_id, fiscal_id)
    xml_content = generate_xml(invoice, org, contact, lines, seller_tax_id, fiscal_id)

    payload = {
        "invoice_id": invoice_id,
        "invoice_number": invoice.get("invoice_number"),
        "fiscal_id": fiscal_id,
        "seller_tax_id": seller_tax_id,
        "status": existing.get("status") if existing else "generated",
        "xml_content": xml_content,
        "qr_payload": qr_payload,
        "preview_mode": config.get("preview_mode", True),
        "last_generated_at": datetime.utcnow().isoformat(),
    }
    if existing:
        submission = repo.update(existing["id"], payload)
    else:
        submission = repo.create(payload)
    return submission, invoice, config


@router.get("/config")
def get_einvoice_config(user: dict = Depends(get_current_user)):
    _, config, _ = _load_config(user["org_id"])
    return mask_einvoice_config(config)


@router.put("/config")
def update_einvoice_config(data: EInvoiceConfigUpdate, user: dict = Depends(get_current_user)):
    _, current_config, _ = _load_config(user["org_id"])
    updates = data.model_dump(exclude_unset=True)
    merged = {**current_config, **updates}
    record = _save_config(user["org_id"], merged)
    return {
        "success": True,
        "config": mask_einvoice_config(record.get("value", merged)),
    }


@router.post("/xml/{invoice_id}")
def build_invoice_xml(invoice_id: str, user: dict = Depends(get_current_user)):
    submission, _, _ = _build_or_refresh_submission(user["org_id"], invoice_id)
    return {
        "invoice_id": invoice_id,
        "fiscal_id": submission.get("fiscal_id"),
        "status": submission.get("status"),
        "xml": submission.get("xml_content"),
    }


@router.post("/sign/{invoice_id}")
def sign_invoice_xml(invoice_id: str, user: dict = Depends(get_current_user)):
    repo = EInvoiceSubmissionRepository(user["org_id"])
    submission, _, config = _build_or_refresh_submission(user["org_id"], invoice_id)
    signature_result = sign_xml(
        submission.get("xml_content", ""),
        config.get("private_key_pem") or "",
        config.get("private_key_password") or "",
    )
    updated = repo.update(
        submission["id"],
        {
            "signature": signature_result["signature"],
            "signature_algorithm": signature_result["algorithm"],
            "preview_signature": signature_result["preview_signature"],
            "status": "signed",
            "signed_at": datetime.utcnow().isoformat(),
        },
    )
    return {
        "invoice_id": invoice_id,
        "fiscal_id": updated.get("fiscal_id"),
        "status": updated.get("status"),
        "signature_algorithm": updated.get("signature_algorithm"),
        "preview_signature": updated.get("preview_signature", False),
    }


@router.get("/qr/{invoice_id}")
def get_invoice_qr(invoice_id: str, user: dict = Depends(get_current_user)):
    repo = EInvoiceSubmissionRepository(user["org_id"])
    submission, _, _ = _build_or_refresh_submission(user["org_id"], invoice_id)
    qr_code_base64 = generate_qr_base64(submission.get("qr_payload", ""))
    repo.update(submission["id"], {"qr_generated_at": datetime.utcnow().isoformat()})
    return {
        "invoice_id": invoice_id,
        "fiscal_id": submission.get("fiscal_id"),
        "qr_payload": submission.get("qr_payload"),
        "qr_code_base64": qr_code_base64,
        "qr_data_url": f"data:image/png;base64,{qr_code_base64}",
    }


@router.post("/submit/{invoice_id}")
def submit_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    repo = EInvoiceSubmissionRepository(user["org_id"])
    submission, invoice, config = _build_or_refresh_submission(user["org_id"], invoice_id)
    signature = sign_xml(
        submission.get("xml_content", ""),
        config.get("private_key_pem") or "",
        config.get("private_key_password") or "",
    )
    provider_result = submit_to_ita(config, submission.get("xml_content", ""), signature, invoice, submission.get("fiscal_id", ""))

    updated = repo.update(
        submission["id"],
        {
            "signature": signature.get("signature"),
            "signature_algorithm": signature.get("algorithm"),
            "preview_signature": signature.get("preview_signature", False),
            "provider_uuid": provider_result.get("provider_uuid"),
            "provider_payload": provider_result.get("provider_payload"),
            "status": provider_result.get("provider_status", "submitted"),
            "error_message": provider_result.get("error_message"),
            "submitted_at": datetime.utcnow().isoformat(),
        },
    )
    return updated


@router.get("/status/{invoice_id}")
def get_submission_status(invoice_id: str, user: dict = Depends(get_current_user)):
    repo = EInvoiceSubmissionRepository(user["org_id"])
    submission = repo.get_by_invoice_id(invoice_id)
    if not submission:
        raise HTTPException(status_code=404, detail="تۆمارێکی e-invoice بۆ ئەم وەسڵە نییە")

    _, config, _ = _load_config(user["org_id"])
    provider_uuid = submission.get("provider_uuid")
    if provider_uuid:
        provider_result = fetch_submission_status(config, provider_uuid, submission.get("status", "generated"))
        submission = repo.update(
            submission["id"],
            {
                "status": provider_result.get("provider_status", submission.get("status")),
                "provider_payload": provider_result.get("provider_payload"),
                "error_message": provider_result.get("error_message"),
                "last_status_check_at": datetime.utcnow().isoformat(),
            },
        )
    return submission


@router.post("/cancel/{invoice_id}")
def cancel_invoice_submission(
    invoice_id: str,
    data: EInvoiceCancelRequest,
    user: dict = Depends(get_current_user),
):
    repo = EInvoiceSubmissionRepository(user["org_id"])
    submission = repo.get_by_invoice_id(invoice_id)
    if not submission:
        raise HTTPException(status_code=404, detail="تۆمارێکی e-invoice بۆ ئەم وەسڵە نییە")

    _, config, _ = _load_config(user["org_id"])
    provider_result = cancel_submission(config, submission.get("provider_uuid") or submission.get("fiscal_id", ""), data.reason or "")
    return repo.update(
        submission["id"],
        {
            "status": provider_result.get("provider_status", "cancelled"),
            "provider_payload": provider_result.get("provider_payload"),
            "error_message": provider_result.get("error_message"),
            "cancel_reason": data.reason or "",
            "cancelled_at": datetime.utcnow().isoformat(),
        },
    )


@router.get("/report/monthly")
def monthly_submission_report(
    period_from: Optional[str] = Query(None),
    period_to: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    if not period_from or not period_to:
        today = datetime.utcnow().date()
        first_day = today.replace(day=1)
        next_month = (first_day + timedelta(days=32)).replace(day=1)
        period_from = first_day.isoformat()
        period_to = (next_month - timedelta(days=1)).isoformat()

    repo = EInvoiceSubmissionRepository(user["org_id"])
    items, _ = repo.list(limit=5000)
    filtered = [
        item for item in items
        if period_from <= str(item.get("submitted_at") or item.get("last_generated_at") or "")[:10] <= period_to
    ]
    summary = {"generated": 0, "signed": 0, "submitted": 0, "accepted": 0, "rejected": 0, "cancelled": 0}
    for item in filtered:
        status = str(item.get("status") or "generated")
        summary[status] = summary.get(status, 0) + 1

    return {
        "period_from": period_from,
        "period_to": period_to,
        "summary": summary,
        "items": filtered,
    }


@router.get("/report/errors")
def submission_errors(limit: int = Query(100, ge=1, le=500), user: dict = Depends(get_current_user)):
    repo = EInvoiceSubmissionRepository(user["org_id"])
    items, _ = repo.list(limit=5000)
    errors = [
        item for item in items
        if item.get("status") in {"rejected", "failed"} or item.get("error_message")
    ]
    return {"items": errors[:limit], "total": len(errors)}


@router.post("/retry/{invoice_id}")
def retry_submission(invoice_id: str, user: dict = Depends(get_current_user)):
    repo = EInvoiceSubmissionRepository(user["org_id"])
    existing = repo.get_by_invoice_id(invoice_id)
    if existing:
        repo.update(
            existing["id"],
            {
                "retry_count": int(existing.get("retry_count") or 0) + 1,
                "last_retry_at": datetime.utcnow().isoformat(),
            },
        )
    return submit_invoice(invoice_id, user)


@router.post("/auto-submit/toggle")
def toggle_auto_submit(data: EInvoiceAutoSubmitRequest, user: dict = Depends(get_current_user)):
    _, current_config, _ = _load_config(user["org_id"])
    merged = {**current_config, "auto_submit_on_send": data.enabled}
    _save_config(user["org_id"], merged)
    return {
        "success": True,
        "auto_submit_on_send": data.enabled,
    }


@router.post("/webhook")
async def einvoice_webhook(request: Request, user: dict = Depends(get_current_user)):
    payload = await request.json()
    provider_uuid = payload.get("uuid") or payload.get("provider_uuid")
    if not provider_uuid:
        raise HTTPException(status_code=400, detail="provider_uuid is required")

    repo = EInvoiceSubmissionRepository(user["org_id"])
    submission = repo.get_by_provider_uuid(provider_uuid)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    updated = repo.update(
        submission["id"],
        {
            "status": payload.get("status") or submission.get("status") or "submitted",
            "provider_payload": payload,
            "error_message": payload.get("error") or payload.get("message"),
            "last_webhook_at": datetime.utcnow().isoformat(),
        },
    )
    return {"success": True, "submission": updated}