"""WhatsApp Business API endpoints."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.firestore.whatsapp import WhatsAppMessageRepository, WhatsAppTemplateRepository
from app.services.auth import get_current_user
from app.services.report_streams import collect_stream
from app.services.whatsapp_service import (
    handle_status_webhook,
    load_config,
    mask_config,
    queue_message,
    save_config,
)

router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp"])


class ConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    preview_mode: Optional[bool] = None
    api_base: Optional[str] = Field(default=None, max_length=200)
    phone_number_id: Optional[str] = Field(default=None, max_length=64)
    api_token: Optional[str] = None
    business_account_id: Optional[str] = Field(default=None, max_length=64)
    default_country_code: Optional[str] = Field(default=None, max_length=4)
    auto_send_invoice: Optional[bool] = None
    auto_send_payment_receipt: Optional[bool] = None


class TemplateCreate(BaseModel):
    name: str = Field(..., max_length=120)
    body: str
    description: Optional[str] = None
    locale: str = "ku"


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    body: Optional[str] = None
    description: Optional[str] = None
    locale: Optional[str] = None


class SendRequest(BaseModel):
    to: str = Field(..., min_length=4, max_length=32)
    body: Optional[str] = None
    template_id: Optional[str] = None
    variables: Optional[dict] = None
    related_type: Optional[str] = ""
    related_id: Optional[str] = ""


# ──────────────────────────── Config ────────────────────────────

@router.get("/config")
def get_config(user: dict = Depends(get_current_user)):
    _, cfg, _ = load_config(user["org_id"])
    return mask_config(cfg)


@router.put("/config")
def update_config(payload: ConfigUpdate, user: dict = Depends(get_current_user)):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    merged = save_config(user["org_id"], data)
    return mask_config(merged)


# ──────────────────────────── Templates ────────────────────────────

@router.get("/templates")
def list_templates(user: dict = Depends(get_current_user)):
    repo = WhatsAppTemplateRepository(user["org_id"])
    items, total = repo.list(limit=200, order_by="name", order_dir="ASCENDING")
    return {"items": items, "total": total}


@router.post("/templates", status_code=201)
def create_template(payload: TemplateCreate, user: dict = Depends(get_current_user)):
    repo = WhatsAppTemplateRepository(user["org_id"])
    return repo.create(payload.model_dump())


@router.put("/templates/{template_id}")
def update_template(template_id: str, payload: TemplateUpdate, user: dict = Depends(get_current_user)):
    repo = WhatsAppTemplateRepository(user["org_id"])
    if not repo.get(template_id):
        raise HTTPException(404, "template not found")
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    return repo.update(template_id, data)


@router.delete("/templates/{template_id}")
def delete_template(template_id: str, user: dict = Depends(get_current_user)):
    repo = WhatsAppTemplateRepository(user["org_id"])
    if not repo.get(template_id):
        raise HTTPException(404, "template not found")
    repo.delete(template_id)
    return {"success": True}


# ──────────────────────────── Send + log ────────────────────────────

@router.post("/send", status_code=201)
def send_message(payload: SendRequest, user: dict = Depends(get_current_user)):
    body = payload.body or ""
    if payload.template_id:
        tpl_repo = WhatsAppTemplateRepository(user["org_id"])
        tpl = tpl_repo.get(payload.template_id)
        if not tpl:
            raise HTTPException(404, "template not found")
        body = tpl.get("body", "")
    if not body.strip():
        raise HTTPException(400, "message body required")

    return queue_message(
        user["org_id"],
        to=payload.to,
        body=body,
        related_type=payload.related_type or "",
        related_id=payload.related_id or "",
        template_id=payload.template_id or "",
        variables=payload.variables or {},
    )


@router.get("/messages")
def list_messages(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: str = Query("", max_length=32),
    related_type: str = Query("", max_length=32),
    related_id: str = Query("", max_length=64),
    user: dict = Depends(get_current_user),
):
    repo = WhatsAppMessageRepository(user["org_id"])
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    if related_type:
        filters.append({"field": "related_type", "op": "==", "value": related_type})
    if related_id:
        filters.append({"field": "related_id", "op": "==", "value": related_id})

    items, total = repo.list(
        filters=filters,
        order_by="queued_at",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size,
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/messages/stats")
def message_stats(user: dict = Depends(get_current_user)):
    repo = WhatsAppMessageRepository(user["org_id"])
    items = collect_stream(repo, max_docs=10000)
    summary = {"queued": 0, "sending": 0, "sent": 0, "delivered": 0, "read": 0,
               "failed": 0, "skipped": 0, "previewed": 0}
    for item in items:
        s = str(item.get("status") or "queued")
        summary[s] = summary.get(s, 0) + 1
    summary["total"] = sum(summary.values())
    return summary


@router.post("/webhook")
async def webhook(request: Request, user: dict = Depends(get_current_user)):
    """Status callback receiver (Meta WhatsApp Cloud API)."""
    payload = await request.json()
    updated = handle_status_webhook(user["org_id"], payload)
    return {"updated": updated}
