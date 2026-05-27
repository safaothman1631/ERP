"""Sprint 46: Social Media Marketing — multi-platform posts + analytics.

FIX-1401..FIX-1430.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
from app.services.report_streams import collect_stream

router = APIRouter(prefix="/api/social", tags=["Social"])


class SocialAccountRepo(BaseRepository):
    collection_name = "social_accounts"


class SocialPostRepo(BaseRepository):
    collection_name = "social_posts"


class SocialEngagementRepo(BaseRepository):
    collection_name = "social_engagements"


class SocialMentionRepo(BaseRepository):
    collection_name = "social_mentions"


class AccountCreate(BaseModel):
    platform: str = Field(..., pattern=r"^(facebook|instagram|x|linkedin|tiktok|youtube|snapchat|pinterest)$")
    handle: str
    access_token: Optional[str] = None
    is_active: bool = True


class PostCreate(BaseModel):
    account_ids: list[str] = Field(default_factory=list)
    content: str
    media_urls: list[str] = Field(default_factory=list)
    scheduled_at: Optional[str] = None
    hashtags: list[str] = Field(default_factory=list)


class EngagementCreate(BaseModel):
    post_id: str
    metric: str
    value: int = 0


class MentionCreate(BaseModel):
    account_id: str
    platform: str
    author: str
    content: str
    sentiment: Optional[str] = Field(None, pattern=r"^(positive|neutral|negative)$")


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


_quick("/accounts", SocialAccountRepo, AccountCreate)
_quick("/posts", SocialPostRepo, PostCreate)
_quick("/engagements", SocialEngagementRepo, EngagementCreate)
_quick("/mentions", SocialMentionRepo, MentionCreate)


@router.post("/posts/{pid}/publish")
def publish_post(pid: str, user: dict = Depends(get_current_user)):
    repo = SocialPostRepo(user["org_id"])
    _own(repo, pid, user["org_id"])
    return repo.update(pid, {"status": "published", "published_at": datetime.utcnow().isoformat()})


@router.post("/posts/{pid}/schedule")
def schedule_post(pid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = SocialPostRepo(user["org_id"])
    _own(repo, pid, user["org_id"])
    return repo.update(pid, {"status": "scheduled", "scheduled_at": body.get("scheduled_at")})


@router.get("/posts/{pid}/analytics")
def post_analytics(pid: str, user: dict = Depends(get_current_user)):
    items, _ = SocialEngagementRepo(user["org_id"]).list(
        filters=[{"field": "post_id", "op": "==", "value": pid}], limit=10000,
    )
    by_metric: dict[str, int] = {}
    for e in items:
        by_metric[e.get("metric", "unknown")] = by_metric.get(e.get("metric", "unknown"), 0) + int(e.get("value", 0))
    return {"by_metric": by_metric, "total_events": len(items)}


@router.get("/dashboard")
def social_dashboard(user: dict = Depends(get_current_user)):
    posts = collect_stream(SocialPostRepo(user["org_id"]), max_docs=10000)
    accs, _ = SocialAccountRepo(user["org_id"]).list(limit=1000)
    by_status: dict[str, int] = {}
    for p in posts:
        by_status[p.get("status", "draft")] = by_status.get(p.get("status", "draft"), 0) + 1
    return {
        "accounts": len(accs),
        "posts": len(posts),
        "by_status": by_status,
    }
