"""Sprint 23: Marketing Module (FIX-341..360).

Email marketing campaigns + audience segments + campaign sends. Built on top of
Sprint 22 mail templates and Sprint 20 automation.
"""
from datetime import datetime
from typing import Optional

import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from app.firestore.marketing import (
    MarketingCampaignRepository,
    MarketingAudienceRepository,
    MarketingCampaignSendRepository,
    SmsCampaignRepository,
    AutomationFlowRepository,
)
from app.firestore.crm import CRMLeadRepository
from app.firestore.contacts import ContactRepository
from app.firestore.mail import MailTemplateRepository, OutboundEmailRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services import settings_service

router = APIRouter(prefix="/api/marketing", tags=["Marketing"])
logger = logging.getLogger(__name__)

# Canonical app limiter (same instance registered as app.state.limiter).
from app.middleware.rate_limit import limiter


# ─────────────────────────────────────────────────────────────────────────────
# growth-to-100 § R1 / T-G.1.11 — public marketing lead capture
# Posted by the Astro marketing site (contact + email-capture forms). This is a
# PUBLIC, unauthenticated endpoint: module_gate passes through tokenless
# requests, and leads land in the top-level ``marketing_leads`` collection for
# the founder's sales review — they are NOT attached to any tenant CRM.
# ─────────────────────────────────────────────────────────────────────────────


class MarketingLeadIn(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    message: Optional[str] = None
    plan: Optional[str] = None
    source: Optional[str] = "marketing_site"
    locale: Optional[str] = "ku"
    # Honeypot: real visitors never see this field; bots fill it.
    website: Optional[str] = None


@router.post("/leads", status_code=202)
@limiter.limit("10/minute")
async def capture_marketing_lead(payload: MarketingLeadIn, request: Request):
    """Capture a lead from the public marketing site (returns 202 Accepted)."""
    # Honeypot tripped → pretend success and silently drop.
    if payload.website:
        return {"status": "accepted"}
    if not (payload.email or payload.phone):
        raise HTTPException(status_code=422, detail="email or phone is required")

    from datetime import timezone

    record = {
        "name": (payload.name or "").strip()[:200],
        "email": (str(payload.email) if payload.email else "").strip()[:200],
        "phone": (payload.phone or "").strip()[:40],
        "company": (payload.company or "").strip()[:200],
        "message": (payload.message or "").strip()[:4000],
        "plan": (payload.plan or "").strip()[:80],
        "source": (payload.source or "marketing_site").strip()[:80],
        "locale": (payload.locale or "ku").strip()[:8],
        "status": "new",
        "ip": (request.client.host if request.client else "")[:64],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        from app.firebase_client import get_db

        get_db().collection("marketing_leads").add(record)
    except Exception as exc:  # pragma: no cover - persistence is best-effort
        # Never surface a 5xx to a marketing visitor; log so the lead isn't lost.
        logger.warning("marketing lead persist failed: %s", exc)
        logger.info(
            "marketing_lead_fallback %s",
            {k: record[k] for k in ("email", "phone", "source")},
        )
    # TODO(T-G.1.11): notify sales@ + WhatsApp channel once those are configured.
    return {"status": "accepted"}


class CampaignCreate(BaseModel):
    name: str
    subject: str
    body_html: Optional[str] = None
    template_id: Optional[str] = None
    audience_id: Optional[str] = None
    scheduled_at: Optional[str] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body_html: Optional[str] = None
    template_id: Optional[str] = None
    audience_id: Optional[str] = None
    scheduled_at: Optional[str] = None
    status: Optional[str] = None


class AudienceCreate(BaseModel):
    name: str
    source: str = "contacts"  # contacts | leads | manual
    filter: Optional[dict] = None
    member_ids: Optional[list[str]] = None  # used when source=manual


# ──────────────────────────── Audiences ────────────────────────────

@router.get("/audiences")
def list_audiences(user: dict = Depends(get_current_user)):
    items, total = MarketingAudienceRepository(user["org_id"]).list(limit=500, order_by="name")
    return {"items": items, "total": total}


@router.post("/audiences", status_code=201,
             dependencies=[Depends(require_perm("settings.update"))])
def create_audience(data: AudienceCreate, user: dict = Depends(get_current_user)):
    return MarketingAudienceRepository(user["org_id"]).create(data.model_dump())


@router.get("/audiences/{audience_id}/preview")
def preview_audience(audience_id: str, user: dict = Depends(get_current_user)):
    """Return list of (contact_id, name, email) the audience resolves to."""
    org = user["org_id"]
    aud = MarketingAudienceRepository(org).get(audience_id)
    if not aud or aud.get("org_id") != org:
        raise HTTPException(404, "audience not found")
    members: list[dict] = []
    src = aud.get("source", "contacts")
    if src == "contacts":
        items, _ = ContactRepository(org).list(limit=2000)
        for it in items:
            if it.get("email"):
                members.append({"id": it["id"], "name": it.get("name"), "email": it["email"]})
    elif src == "leads":
        items, _ = CRMLeadRepository(org).list(limit=2000)
        for it in items:
            if it.get("email"):
                members.append({"id": it["id"], "name": it.get("name"), "email": it["email"]})
    elif src == "manual":
        ids = aud.get("member_ids") or []
        repo = ContactRepository(org)
        for cid in ids:
            it = repo.get(cid)
            if it and it.get("email"):
                members.append({"id": cid, "name": it.get("name"), "email": it["email"]})
    return {"audience_id": audience_id, "members": members, "total": len(members)}


@router.delete("/audiences/{audience_id}",
               dependencies=[Depends(require_perm("settings.update"))])
def delete_audience(audience_id: str, user: dict = Depends(get_current_user)):
    repo = MarketingAudienceRepository(user["org_id"])
    if not repo.get(audience_id):
        raise HTTPException(404, "audience not found")
    repo.delete(audience_id)
    return {"deleted": True}


# ──────────────────────────── Campaigns ────────────────────────────

@router.get("/campaigns")
def list_campaigns(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    repo = MarketingCampaignRepository(user["org_id"])
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters or None, limit=500,
                              order_by="created_at", order_dir="DESCENDING")
    return {"items": items, "total": total}


@router.post("/campaigns", status_code=201,
             dependencies=[Depends(require_perm("settings.update"))])
def create_campaign(data: CampaignCreate, user: dict = Depends(get_current_user)):
    # Apply marketing config defaults
    try:
        cfg = settings_service.get_bag(user["org_id"], "marketing")
    except Exception:
        cfg = {}
    
    payload = data.model_dump()
    payload["status"] = "draft"
    payload.setdefault("max_emails_per_day", cfg.get("max_emails_per_day", 1000))
    if not payload.get("default_sender"):
        payload["default_sender"] = cfg.get("default_sender_email", "")
    
    return MarketingCampaignRepository(user["org_id"]).create(payload)


@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    item = MarketingCampaignRepository(user["org_id"]).get(campaign_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "campaign not found")
    return item


@router.put("/campaigns/{campaign_id}",
            dependencies=[Depends(require_perm("settings.update"))])
def update_campaign(campaign_id: str, data: CampaignUpdate,
                    user: dict = Depends(get_current_user)):
    repo = MarketingCampaignRepository(user["org_id"])
    if not repo.get(campaign_id):
        raise HTTPException(404, "campaign not found")
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    return repo.update(campaign_id, payload)


@router.delete("/campaigns/{campaign_id}",
               dependencies=[Depends(require_perm("settings.update"))])
def delete_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    repo = MarketingCampaignRepository(user["org_id"])
    if not repo.get(campaign_id):
        raise HTTPException(404, "campaign not found")
    repo.delete(campaign_id)
    return {"deleted": True}


@router.post("/campaigns/{campaign_id}/send",
             dependencies=[Depends(require_perm("settings.update"))])
def send_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    """Resolve audience, queue per-recipient emails, mark campaign sent."""
    org = user["org_id"]
    camp_repo = MarketingCampaignRepository(org)
    camp = camp_repo.get(campaign_id)
    if not camp or camp.get("org_id") != org:
        raise HTTPException(404, "campaign not found")
    if camp.get("status") == "sent":
        raise HTTPException(400, "campaign already sent")
    aud_id = camp.get("audience_id")
    if not aud_id:
        raise HTTPException(400, "campaign has no audience_id")

    # Resolve members (reuse preview)
    aud = MarketingAudienceRepository(org).get(aud_id)
    if not aud:
        raise HTTPException(404, "audience not found")
    members: list[dict] = []
    src = aud.get("source", "contacts")
    if src == "contacts":
        items, _ = ContactRepository(org).list(limit=2000)
        members = [{"id": it["id"], "name": it.get("name"), "email": it["email"]}
                   for it in items if it.get("email")]
    elif src == "leads":
        items, _ = CRMLeadRepository(org).list(limit=2000)
        members = [{"id": it["id"], "name": it.get("name"), "email": it["email"]}
                   for it in items if it.get("email")]
    elif src == "manual":
        ids = aud.get("member_ids") or []
        repo = ContactRepository(org)
        for cid in ids:
            it = repo.get(cid)
            if it and it.get("email"):
                members.append({"id": cid, "name": it.get("name"), "email": it["email"]})

    # Resolve template content
    subject_tpl = camp.get("subject") or ""
    body_tpl = camp.get("body_html") or ""
    if camp.get("template_id"):
        tpl = MailTemplateRepository(org).get(camp["template_id"])
        if tpl:
            subject_tpl = tpl.get("subject") or subject_tpl
            body_tpl = tpl.get("body_html") or body_tpl

    out_repo = OutboundEmailRepository(org)
    send_repo = MarketingCampaignSendRepository(org)
    queued = 0
    for m in members:
        subject = subject_tpl.replace("{{name}}", m.get("name") or "")
        body_html = body_tpl.replace("{{name}}", m.get("name") or "")
        eml = out_repo.create({
            "to": m["email"], "subject": subject, "body_html": body_html,
            "status": "pending", "queued_at": datetime.utcnow().isoformat(),
            "queued_by_id": user["id"], "send_attempts": 0,
            "campaign_id": campaign_id,
        })
        send_repo.create({
            "campaign_id": campaign_id,
            "contact_id": m["id"],
            "email": m["email"],
            "outbound_email_id": eml["id"],
            "status": "queued",
        })
        queued += 1

    camp_repo.update(campaign_id, {
        "status": "sent",
        "sent_at": datetime.utcnow().isoformat(),
        "recipient_count": queued,
    })
    return {"campaign_id": campaign_id, "queued": queued, "audience_id": aud_id}


@router.get("/campaigns/{campaign_id}/sends")
def list_campaign_sends(campaign_id: str, user: dict = Depends(get_current_user)):
    repo = MarketingCampaignSendRepository(user["org_id"])
    items, total = repo.list(filters=[
        {"field": "campaign_id", "op": "==", "value": campaign_id},
    ], limit=2000)
    return {"items": items, "total": total}


@router.get("/campaigns/{campaign_id}/stats")
def get_campaign_stats(campaign_id: str, user: dict = Depends(get_current_user)):
    """Return campaign analytics: sent, delivered, opened, clicked, bounced, unsubscribed.
    
    For Wave F, we stub zeros if no tracking events exist yet. Future: query outbound_emails
    collection for actual delivery/bounce data.
    """
    org = user["org_id"]
    camp = MarketingCampaignRepository(org).get(campaign_id)
    if not camp or camp.get("org_id") != org:
        raise HTTPException(404, "campaign not found")
    
    sent = camp.get("recipient_count", 0)
    # Stub analytics (future: query outbound_emails + tracking_events)
    return {
        "campaign_id": campaign_id,
        "sent": sent,
        "delivered": sent,  # Assume delivered for now
        "opened": 0,
        "clicked": 0,
        "bounced": 0,
        "unsubscribed": 0,
    }


# ──────────────────────────── SMS Campaigns ────────────────────────────

class SmsCampaignCreate(BaseModel):
    name: str
    body: str  # max 160 chars
    audience_id: Optional[str] = None
    scheduled_at: Optional[str] = None


class SmsCampaignUpdate(BaseModel):
    name: Optional[str] = None
    body: Optional[str] = None
    audience_id: Optional[str] = None
    scheduled_at: Optional[str] = None
    status: Optional[str] = None


@router.get("/sms-campaigns")
def list_sms_campaigns(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    repo = SmsCampaignRepository(user["org_id"])
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters or None, limit=500,
                              order_by="created_at", order_dir="DESCENDING")
    return {"items": items, "total": total}


@router.post("/sms-campaigns", status_code=201,
             dependencies=[Depends(require_perm("settings.update"))])
def create_sms_campaign(data: SmsCampaignCreate, user: dict = Depends(get_current_user)):
    payload = data.model_dump()
    payload["status"] = "draft"
    return SmsCampaignRepository(user["org_id"]).create(payload)


@router.get("/sms-campaigns/{campaign_id}")
def get_sms_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    item = SmsCampaignRepository(user["org_id"]).get(campaign_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "sms campaign not found")
    return item


@router.put("/sms-campaigns/{campaign_id}",
            dependencies=[Depends(require_perm("settings.update"))])
def update_sms_campaign(campaign_id: str, data: SmsCampaignUpdate,
                        user: dict = Depends(get_current_user)):
    repo = SmsCampaignRepository(user["org_id"])
    if not repo.get(campaign_id):
        raise HTTPException(404, "sms campaign not found")
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    return repo.update(campaign_id, payload)


@router.delete("/sms-campaigns/{campaign_id}",
               dependencies=[Depends(require_perm("settings.update"))])
def delete_sms_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    repo = SmsCampaignRepository(user["org_id"])
    if not repo.get(campaign_id):
        raise HTTPException(404, "sms campaign not found")
    repo.delete(campaign_id)
    return {"deleted": True}


@router.post("/sms-campaigns/{campaign_id}/send",
             dependencies=[Depends(require_perm("settings.update"))])
def send_sms_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    """Stub: mark campaign as sent. Actual SMS sending to Iraqi providers deferred."""
    org = user["org_id"]
    repo = SmsCampaignRepository(org)
    camp = repo.get(campaign_id)
    if not camp or camp.get("org_id") != org:
        raise HTTPException(404, "sms campaign not found")
    if camp.get("status") == "sent":
        raise HTTPException(400, "campaign already sent")
    
    # Resolve audience count (simple)
    aud_id = camp.get("audience_id")
    recipient_count = 0
    if aud_id:
        preview = preview_audience(aud_id, user)
        recipient_count = preview["total"]
    
    repo.update(campaign_id, {
        "status": "sent",
        "sent_at": datetime.utcnow().isoformat(),
        "recipient_count": recipient_count,
    })
    return {"campaign_id": campaign_id, "queued": recipient_count}


# ──────────────────────────── Automation Flows ────────────────────────────

class AutomationFlowCreate(BaseModel):
    name: str
    trigger: dict  # {event: 'contact_created' | 'invoice_paid' | ...}
    steps: list[dict]  # [{type:'wait'|'email'|'sms'|'tag', config:{}}]


class AutomationFlowUpdate(BaseModel):
    name: Optional[str] = None
    trigger: Optional[dict] = None
    steps: Optional[list[dict]] = None
    active: Optional[bool] = None


@router.get("/automations")
def list_automations(user: dict = Depends(get_current_user)):
    items, total = AutomationFlowRepository(user["org_id"]).list(
        limit=500, order_by="created_at", order_dir="DESCENDING"
    )
    return {"items": items, "total": total}


@router.post("/automations", status_code=201,
             dependencies=[Depends(require_perm("settings.update"))])
def create_automation(data: AutomationFlowCreate, user: dict = Depends(get_current_user)):
    payload = data.model_dump()
    payload["active"] = False
    payload["stats"] = {"enrolled": 0, "completed": 0}
    return AutomationFlowRepository(user["org_id"]).create(payload)


@router.get("/automations/{flow_id}")
def get_automation(flow_id: str, user: dict = Depends(get_current_user)):
    item = AutomationFlowRepository(user["org_id"]).get(flow_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "automation not found")
    return item


@router.put("/automations/{flow_id}",
            dependencies=[Depends(require_perm("settings.update"))])
def update_automation(flow_id: str, data: AutomationFlowUpdate,
                      user: dict = Depends(get_current_user)):
    repo = AutomationFlowRepository(user["org_id"])
    if not repo.get(flow_id):
        raise HTTPException(404, "automation not found")
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    return repo.update(flow_id, payload)


@router.delete("/automations/{flow_id}",
               dependencies=[Depends(require_perm("settings.update"))])
def delete_automation(flow_id: str, user: dict = Depends(get_current_user)):
    repo = AutomationFlowRepository(user["org_id"])
    if not repo.get(flow_id):
        raise HTTPException(404, "automation not found")
    repo.delete(flow_id)
    return {"deleted": True}


@router.post("/automations/{flow_id}/activate",
             dependencies=[Depends(require_perm("settings.update"))])
def activate_automation(flow_id: str, user: dict = Depends(get_current_user)):
    """Toggle automation active state. Actual execution is stub (no cron yet)."""
    org = user["org_id"]
    repo = AutomationFlowRepository(org)
    flow = repo.get(flow_id)
    if not flow or flow.get("org_id") != org:
        raise HTTPException(404, "automation not found")
    
    new_state = not flow.get("active", False)
    repo.update(flow_id, {"active": new_state})
    return {"flow_id": flow_id, "active": new_state}

