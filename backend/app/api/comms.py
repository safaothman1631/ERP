"""Sprint 47: SMS + VoIP omnichannel comms.

FIX-1431..FIX-1490.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/comms", tags=["Comms"])


class SMSTemplateRepo(BaseRepository):
    collection_name = "sms_templates"


class SMSMessageRepo(BaseRepository):
    collection_name = "sms_messages"


class SMSCampaignRepo(BaseRepository):
    collection_name = "sms_campaigns"


class VoipCallRepo(BaseRepository):
    collection_name = "voip_calls"


class VoipRecordingRepo(BaseRepository):
    collection_name = "voip_recordings"


class CallQueueRepo(BaseRepository):
    collection_name = "voip_queues"


class SMSTemplateCreate(BaseModel):
    name: str
    body: str
    variables: list[str] = Field(default_factory=list)


class SMSMessageCreate(BaseModel):
    to: str
    body: str
    template_id: Optional[str] = None
    campaign_id: Optional[str] = None


class SMSCampaignCreate(BaseModel):
    name: str
    template_id: str
    audience_filter: Optional[dict] = None
    scheduled_at: Optional[str] = None


class VoipCallCreate(BaseModel):
    direction: str = Field("outbound", pattern=r"^(inbound|outbound)$")
    from_number: str
    to_number: str
    contact_id: Optional[str] = None
    duration_seconds: int = 0
    notes: Optional[str] = None


class RecordingCreate(BaseModel):
    call_id: str
    storage_url: str
    duration_seconds: int = 0


class QueueCreate(BaseModel):
    name: str
    members: list[str] = Field(default_factory=list)
    strategy: str = Field("round_robin", pattern=r"^(round_robin|least_busy|priority)$")


def _own(repo, doc_id, org_id):
    item = repo.get(doc_id)
    if not item or item.get("org_id") != org_id:
        raise HTTPException(404, "نەدۆزرایەوە")
    return item


def _quick(prefix, repo_cls, model):
    @router.get(prefix)
    def _ls(user: dict = Depends(get_current_user), limit: int = Query(50, ge=1, le=500), offset: int = 0):
        items, total = repo_cls(user["org_id"]).list(limit=limit, offset=offset)
        return {"items": items, "total": total}

    @router.post(prefix, status_code=201)
    def _cr(body: model, user: dict = Depends(get_current_user)):
        return repo_cls(user["org_id"]).create(body.model_dump())

    @router.get(prefix + "/{rid}")
    def _gt(rid: str, user: dict = Depends(get_current_user)):
        return _own(repo_cls(user["org_id"]), rid, user["org_id"])

    @router.patch(prefix + "/{rid}")
    def _up(rid: str, body: model, user: dict = Depends(get_current_user)):
        repo = repo_cls(user["org_id"])
        _own(repo, rid, user["org_id"])
        return repo.update(rid, {k: v for k, v in body.model_dump().items() if v is not None})

    @router.delete(prefix + "/{rid}", status_code=204)
    def _dl(rid: str, user: dict = Depends(get_current_user)):
        repo = repo_cls(user["org_id"])
        _own(repo, rid, user["org_id"])
        repo.delete(rid)


_quick("/sms-templates", SMSTemplateRepo, SMSTemplateCreate)
_quick("/sms", SMSMessageRepo, SMSMessageCreate)
_quick("/sms-campaigns", SMSCampaignRepo, SMSCampaignCreate)
_quick("/calls", VoipCallRepo, VoipCallCreate)
_quick("/recordings", VoipRecordingRepo, RecordingCreate)
_quick("/queues", CallQueueRepo, QueueCreate)


@router.post("/sms/{mid}/mark-sent")
def sms_sent(mid: str, user: dict = Depends(get_current_user)):
    repo = SMSMessageRepo(user["org_id"])
    _own(repo, mid, user["org_id"])
    return repo.update(mid, {"status": "sent", "sent_at": datetime.utcnow().isoformat()})


@router.post("/sms/{mid}/mark-delivered")
def sms_delivered(mid: str, user: dict = Depends(get_current_user)):
    repo = SMSMessageRepo(user["org_id"])
    _own(repo, mid, user["org_id"])
    return repo.update(mid, {"status": "delivered", "delivered_at": datetime.utcnow().isoformat()})


@router.post("/sms-campaigns/{cid}/start")
def start_campaign(cid: str, user: dict = Depends(get_current_user)):
    repo = SMSCampaignRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    return repo.update(cid, {"status": "running", "started_at": datetime.utcnow().isoformat()})


@router.post("/calls/{cid}/end")
def end_call(cid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = VoipCallRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    return repo.update(cid, {
        "status": "completed",
        "ended_at": datetime.utcnow().isoformat(),
        "duration_seconds": body.get("duration_seconds", 0),
    })


@router.get("/dashboard")
def comms_dashboard(user: dict = Depends(get_current_user)):
    sms, _ = SMSMessageRepo(user["org_id"]).list(limit=10000)
    calls, _ = VoipCallRepo(user["org_id"]).list(limit=10000)
    return {
        "sms_total": len(sms),
        "sms_sent": sum(1 for s in sms if s.get("status") in ("sent", "delivered")),
        "calls_total": len(calls),
        "call_minutes": round(sum(int(c.get("duration_seconds", 0)) for c in calls) / 60.0, 1),
    }
