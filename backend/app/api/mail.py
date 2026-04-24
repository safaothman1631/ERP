"""Sprint 22: Mail Templates + Outbound Email Queue (FIX-321..335).

Provides a database-backed mail template system with variable substitution and an
outbound queue for tracking/retrying email sends. Actual SMTP/SES integration
is deferred — this layer captures intent, content, and delivery state.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.firestore.mail import MailTemplateRepository, OutboundEmailRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/mail", tags=["Mail"])


# ──────────────────────────── Schemas ────────────────────────────

class MailTemplateCreate(BaseModel):
    name: str
    code: Optional[str] = None
    entity_type: Optional[str] = None  # invoice | quote | lead | etc.
    subject: str
    body_html: str
    body_text: Optional[str] = None
    language: str = "ku"
    active: bool = True


class MailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    entity_type: Optional[str] = None
    subject: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    language: Optional[str] = None
    active: Optional[bool] = None


class TemplateRenderRequest(BaseModel):
    variables: dict


class EmailQueueRequest(BaseModel):
    to: str
    subject: str
    body_html: str
    body_text: Optional[str] = None
    cc: Optional[list[str]] = None
    bcc: Optional[list[str]] = None
    template_id: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None


# ──────────────────────────── Templates ────────────────────────────

@router.get("/templates", dependencies=[Depends(require_perm("settings.read"))])
def list_templates(entity_type: Optional[str] = None,
                   active: Optional[bool] = None,
                   user: dict = Depends(get_current_user)):
    repo = MailTemplateRepository(user["org_id"])
    filters = []
    if entity_type:
        filters.append({"field": "entity_type", "op": "==", "value": entity_type})
    if active is not None:
        filters.append({"field": "active", "op": "==", "value": active})
    items, total = repo.list(filters=filters or None, limit=500, order_by="name")
    return {"items": items, "total": total}


@router.post("/templates", status_code=201,
             dependencies=[Depends(require_perm("settings.update"))])
def create_template(data: MailTemplateCreate, user: dict = Depends(get_current_user)):
    repo = MailTemplateRepository(user["org_id"])
    return repo.create(data.model_dump())


@router.get("/templates/{template_id}")
def get_template(template_id: str, user: dict = Depends(get_current_user)):
    repo = MailTemplateRepository(user["org_id"])
    item = repo.get(template_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "template not found")
    return item


@router.put("/templates/{template_id}",
            dependencies=[Depends(require_perm("settings.update"))])
def update_template(template_id: str, data: MailTemplateUpdate,
                    user: dict = Depends(get_current_user)):
    repo = MailTemplateRepository(user["org_id"])
    if not repo.get(template_id):
        raise HTTPException(404, "template not found")
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    return repo.update(template_id, payload)


@router.delete("/templates/{template_id}",
               dependencies=[Depends(require_perm("settings.update"))])
def delete_template(template_id: str, user: dict = Depends(get_current_user)):
    repo = MailTemplateRepository(user["org_id"])
    if not repo.get(template_id):
        raise HTTPException(404, "template not found")
    repo.delete(template_id)
    return {"deleted": True}


@router.post("/templates/{template_id}/render")
def render_template(template_id: str, data: TemplateRenderRequest,
                    user: dict = Depends(get_current_user)):
    """Render a template with the provided variables. Variables substituted via {{var_name}}."""
    repo = MailTemplateRepository(user["org_id"])
    tpl = repo.get(template_id)
    if not tpl or tpl.get("org_id") != user["org_id"]:
        raise HTTPException(404, "template not found")
    subject = tpl.get("subject") or ""
    body_html = tpl.get("body_html") or ""
    body_text = tpl.get("body_text") or ""
    for k, v in (data.variables or {}).items():
        token = "{{" + str(k) + "}}"
        subject = subject.replace(token, str(v))
        body_html = body_html.replace(token, str(v))
        body_text = body_text.replace(token, str(v))
    return {
        "template_id": template_id,
        "subject": subject,
        "body_html": body_html,
        "body_text": body_text,
    }


# ──────────────────────────── Outbound Queue ────────────────────────────

@router.post("/queue", status_code=201)
def queue_email(data: EmailQueueRequest, user: dict = Depends(get_current_user)):
    """Queue an email for later delivery (status=pending). Cron worker picks up + sends."""
    repo = OutboundEmailRepository(user["org_id"])
    return repo.create({
        **data.model_dump(),
        "status": "pending",
        "queued_at": datetime.utcnow().isoformat(),
        "queued_by_id": user["id"],
        "send_attempts": 0,
    })


@router.get("/queue")
def list_queue(status: Optional[str] = None, limit: int = 200,
               user: dict = Depends(get_current_user)):
    repo = OutboundEmailRepository(user["org_id"])
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters or None, limit=limit,
                              order_by="queued_at", order_dir="DESCENDING")
    return {"items": items, "total": total}


@router.post("/queue/{email_id}/mark-sent")
def mark_sent(email_id: str, user: dict = Depends(get_current_user)):
    repo = OutboundEmailRepository(user["org_id"])
    item = repo.get(email_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "email not found")
    return repo.update(email_id, {
        "status": "sent",
        "sent_at": datetime.utcnow().isoformat(),
        "send_attempts": int(item.get("send_attempts") or 0) + 1,
    })


@router.post("/queue/{email_id}/mark-failed")
def mark_failed(email_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = OutboundEmailRepository(user["org_id"])
    item = repo.get(email_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "email not found")
    return repo.update(email_id, {
        "status": "failed",
        "failed_at": datetime.utcnow().isoformat(),
        "error": data.get("error", ""),
        "send_attempts": int(item.get("send_attempts") or 0) + 1,
    })


@router.delete("/queue/{email_id}")
def delete_queued_email(email_id: str, user: dict = Depends(get_current_user)):
    repo = OutboundEmailRepository(user["org_id"])
    item = repo.get(email_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "email not found")
    repo.delete(email_id)
    return {"deleted": True}
