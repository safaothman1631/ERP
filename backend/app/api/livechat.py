"""Sprint 45: Live Chat + Chatbot Builder.

FIX-1371..FIX-1400.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/livechat", tags=["Live Chat"])


class LCChannelRepo(BaseRepository):
    collection_name = "lc_channels"


class LCConversationRepo(BaseRepository):
    collection_name = "lc_conversations"


class LCMessageRepo(BaseRepository):
    collection_name = "lc_messages"


class LCBotRepo(BaseRepository):
    collection_name = "lc_bots"


class LCBotFlowRepo(BaseRepository):
    collection_name = "lc_bot_flows"


class LCCannedRepo(BaseRepository):
    collection_name = "lc_canned"


class ChannelCreate(BaseModel):
    name: str
    type: str = Field("website", pattern=r"^(website|whatsapp|messenger|telegram)$")
    welcome_message: Optional[str] = None
    is_active: bool = True


class ConversationCreate(BaseModel):
    channel_id: str
    visitor_name: Optional[str] = None
    visitor_email: Optional[str] = None
    initial_message: Optional[str] = None


class MessageCreate(BaseModel):
    conversation_id: str
    body: str
    sender: str = Field("agent", pattern=r"^(agent|visitor|bot)$")


class BotCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True


class BotFlowCreate(BaseModel):
    bot_id: str
    name: str
    trigger_keywords: list[str] = Field(default_factory=list)
    nodes: list[dict] = Field(default_factory=list)


class CannedCreate(BaseModel):
    title: str
    body: str
    shortcut: Optional[str] = None


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


_quick("/channels", LCChannelRepo, ChannelCreate)
_quick("/conversations", LCConversationRepo, ConversationCreate)
_quick("/bots", LCBotRepo, BotCreate)
_quick("/flows", LCBotFlowRepo, BotFlowCreate)
_quick("/canned", LCCannedRepo, CannedCreate)


@router.get("/conversations/{cid}/messages")
def list_msgs(cid: str, user: dict = Depends(get_current_user)):
    items, total = LCMessageRepo(user["org_id"]).list(
        filters=[{"field": "conversation_id", "op": "==", "value": cid}],
        order_by="created_at", order_dir="ASCENDING", limit=1000,
    )
    return {"items": items, "total": total}


@router.post("/conversations/{cid}/messages", status_code=201)
def send_msg(cid: str, body: MessageCreate, user: dict = Depends(get_current_user)):
    return LCMessageRepo(user["org_id"]).create({
        "conversation_id": cid,
        "body": body.body,
        "sender": body.sender,
        "sender_id": user.get("id") or user.get("email"),
    })


@router.post("/conversations/{cid}/close")
def close_conv(cid: str, user: dict = Depends(get_current_user)):
    repo = LCConversationRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    return repo.update(cid, {"status": "closed", "closed_at": datetime.utcnow().isoformat()})


@router.post("/conversations/{cid}/assign")
def assign_conv(cid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = LCConversationRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    return repo.update(cid, {"assigned_to": body.get("user_id"), "status": "active"})


@router.get("/dashboard")
def lc_dashboard(user: dict = Depends(get_current_user)):
    convs, _ = LCConversationRepo(user["org_id"]).list(limit=10000)
    msgs, _ = LCMessageRepo(user["org_id"]).list(limit=10000)
    return {
        "conversations": len(convs),
        "open": sum(1 for c in convs if c.get("status") not in ("closed",)),
        "messages": len(msgs),
    }
