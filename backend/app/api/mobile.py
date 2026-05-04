"""Sprint 53: Mobile API — push tokens, sync deltas, mobile sessions.

FIX-1676..FIX-1700.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
from app.services import settings_service

router = APIRouter(prefix="/api/mobile", tags=["Mobile"])


class PushTokenRepo(BaseRepository):
    collection_name = "mobile_push_tokens"


class MobileSessionRepo(BaseRepository):
    collection_name = "mobile_sessions"


class SyncDeltaRepo(BaseRepository):
    collection_name = "mobile_sync_deltas"


class PushNotificationRepo(BaseRepository):
    collection_name = "mobile_push_notifications"


class TokenCreate(BaseModel):
    device_id: str
    platform: str = Field("android", pattern=r"^(android|ios|web)$")
    token: str
    app_version: Optional[str] = None


class SessionCreate(BaseModel):
    device_id: str
    platform: str
    app_version: Optional[str] = None


class DeltaCreate(BaseModel):
    entity: str
    last_sync_at: str
    changes: list[dict] = Field(default_factory=list)


class NotifCreate(BaseModel):
    user_ids: list[str] = Field(default_factory=list)
    title: str
    body: str
    data: dict = Field(default_factory=dict)


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
        # Check mobile push config (tokens endpoint)
        if prefix == "/tokens":
            try:
                cfg = settings_service.get_bag(user["org_id"], "mobile")
            except Exception:
                cfg = {}
            if not cfg.get("push_enabled", True):
                raise HTTPException(403, "Push notifications are disabled")
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


_quick("/tokens", PushTokenRepo, TokenCreate)
_quick("/sessions", MobileSessionRepo, SessionCreate)
_quick("/deltas", SyncDeltaRepo, DeltaCreate)
_quick("/push", PushNotificationRepo, NotifCreate)


@router.get("/sync/{entity}")
def sync_entity(entity: str, since: Optional[str] = None, user: dict = Depends(get_current_user)):
    items, _ = SyncDeltaRepo(user["org_id"]).list(
        filters=[{"field": "entity", "op": "==", "value": entity}],
        order_by="created_at", limit=500,
    )
    return {"items": items, "server_time": datetime.utcnow().isoformat()}
