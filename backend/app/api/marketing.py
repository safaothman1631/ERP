"""Sprint 23: Marketing Module (FIX-341..360).

Email marketing campaigns + audience segments + campaign sends. Built on top of
Sprint 22 mail templates and Sprint 20 automation.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.firestore.marketing import (
    MarketingCampaignRepository,
    MarketingAudienceRepository,
    MarketingCampaignSendRepository,
)
from app.firestore.crm import CRMLeadRepository
from app.firestore.contacts import ContactRepository
from app.firestore.mail import MailTemplateRepository, OutboundEmailRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/marketing", tags=["Marketing"])


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
    payload = data.model_dump()
    payload["status"] = "draft"
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
