"""Sprint 40: Knowledge + Wiki — articles, categories, search, comments.

FIX-1146..FIX-1175.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/knowledge", tags=["Knowledge"])


class KBCategoryRepo(BaseRepository):
    collection_name = "kb_categories"


class KBArticleRepo(BaseRepository):
    collection_name = "kb_articles"


class KBArticleVersionRepo(BaseRepository):
    collection_name = "kb_article_versions"


class KBCommentRepo(BaseRepository):
    collection_name = "kb_comments"


class KBVoteRepo(BaseRepository):
    collection_name = "kb_votes"


class CategoryCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None


class ArticleCreate(BaseModel):
    title: str
    body: str
    category_id: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    is_published: bool = False
    is_public: bool = False


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    category_id: Optional[str] = None
    tags: Optional[list[str]] = None
    is_published: Optional[bool] = None
    is_public: Optional[bool] = None


class CommentCreate(BaseModel):
    article_id: str
    body: str


class VoteCreate(BaseModel):
    article_id: str
    helpful: bool


def _own(repo, doc_id, org_id):
    item = repo.get(doc_id)
    if not item or item.get("org_id") != org_id:
        raise HTTPException(404, "نەدۆزرایەوە")
    return item


# Categories
@router.get("/categories")
def list_cats(user: dict = Depends(get_current_user)):
    items, total = KBCategoryRepo(user["org_id"]).list(limit=500)
    return {"items": items, "total": total}


@router.post("/categories", status_code=201)
def create_cat(body: CategoryCreate, user: dict = Depends(get_current_user)):
    return KBCategoryRepo(user["org_id"]).create(body.model_dump())


@router.patch("/categories/{cid}")
def update_cat(cid: str, body: CategoryCreate, user: dict = Depends(get_current_user)):
    repo = KBCategoryRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    return repo.update(cid, body.model_dump())


@router.delete("/categories/{cid}", status_code=204)
def delete_cat(cid: str, user: dict = Depends(get_current_user)):
    repo = KBCategoryRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    repo.delete(cid)


# Articles
@router.get("/articles")
def list_articles(
    user: dict = Depends(get_current_user),
    category_id: Optional[str] = None,
    is_published: Optional[bool] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = 0,
):
    filters = []
    if category_id:
        filters.append({"field": "category_id", "op": "==", "value": category_id})
    if is_published is not None:
        filters.append({"field": "is_published", "op": "==", "value": is_published})
    items, total = KBArticleRepo(user["org_id"]).list(
        filters=filters, limit=limit, offset=offset, order_by="updated_at",
    )
    return {"items": items, "total": total}


@router.post("/articles", status_code=201)
def create_article(body: ArticleCreate, user: dict = Depends(get_current_user)):
    data = body.model_dump()
    data["author_id"] = user.get("id") or user.get("email")
    data["version"] = 1
    data["view_count"] = 0
    data["helpful_count"] = 0
    data["unhelpful_count"] = 0
    return KBArticleRepo(user["org_id"]).create(data)


@router.get("/articles/{aid}")
def get_article(aid: str, user: dict = Depends(get_current_user)):
    repo = KBArticleRepo(user["org_id"])
    art = _own(repo, aid, user["org_id"])
    repo.update(aid, {"view_count": int(art.get("view_count", 0)) + 1})
    return art


@router.patch("/articles/{aid}")
def update_article(aid: str, body: ArticleUpdate, user: dict = Depends(get_current_user)):
    repo = KBArticleRepo(user["org_id"])
    art = _own(repo, aid, user["org_id"])
    new_data = {k: v for k, v in body.model_dump().items() if v is not None}
    # Snapshot version
    if "body" in new_data and new_data["body"] != art.get("body"):
        KBArticleVersionRepo(user["org_id"]).create({
            "article_id": aid,
            "version_number": int(art.get("version", 1)),
            "body": art.get("body", ""),
            "title": art.get("title", ""),
            "edited_by": user.get("id") or user.get("email"),
        })
        new_data["version"] = int(art.get("version", 1)) + 1
    return repo.update(aid, new_data)


@router.delete("/articles/{aid}", status_code=204)
def delete_article(aid: str, user: dict = Depends(get_current_user)):
    repo = KBArticleRepo(user["org_id"])
    _own(repo, aid, user["org_id"])
    repo.delete(aid)


@router.post("/articles/{aid}/publish")
def publish_article(aid: str, user: dict = Depends(get_current_user)):
    repo = KBArticleRepo(user["org_id"])
    _own(repo, aid, user["org_id"])
    return repo.update(aid, {"is_published": True, "published_at": datetime.utcnow().isoformat()})


@router.post("/articles/{aid}/unpublish")
def unpublish_article(aid: str, user: dict = Depends(get_current_user)):
    repo = KBArticleRepo(user["org_id"])
    _own(repo, aid, user["org_id"])
    return repo.update(aid, {"is_published": False})


@router.get("/articles/{aid}/versions")
def list_article_versions(aid: str, user: dict = Depends(get_current_user)):
    items, total = KBArticleVersionRepo(user["org_id"]).list(
        filters=[{"field": "article_id", "op": "==", "value": aid}],
        order_by="version_number", order_dir="DESCENDING", limit=200,
    )
    return {"items": items, "total": total}


# Comments
@router.get("/articles/{aid}/comments")
def list_comments(aid: str, user: dict = Depends(get_current_user)):
    items, total = KBCommentRepo(user["org_id"]).list(
        filters=[{"field": "article_id", "op": "==", "value": aid}],
        order_by="created_at", order_dir="ASCENDING", limit=500,
    )
    return {"items": items, "total": total}


@router.post("/articles/{aid}/comments", status_code=201)
def create_comment(aid: str, body: CommentCreate, user: dict = Depends(get_current_user)):
    return KBCommentRepo(user["org_id"]).create({
        "article_id": aid,
        "body": body.body,
        "author_id": user.get("id") or user.get("email"),
    })


@router.delete("/comments/{cid}", status_code=204)
def delete_comment(cid: str, user: dict = Depends(get_current_user)):
    repo = KBCommentRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    repo.delete(cid)


# Votes
@router.post("/articles/{aid}/vote", status_code=201)
def vote_article(aid: str, body: VoteCreate, user: dict = Depends(get_current_user)):
    art_repo = KBArticleRepo(user["org_id"])
    art = _own(art_repo, aid, user["org_id"])
    KBVoteRepo(user["org_id"]).create({
        "article_id": aid,
        "voter_id": user.get("id") or user.get("email"),
        "helpful": body.helpful,
    })
    if body.helpful:
        art_repo.update(aid, {"helpful_count": int(art.get("helpful_count", 0)) + 1})
    else:
        art_repo.update(aid, {"unhelpful_count": int(art.get("unhelpful_count", 0)) + 1})
    return {"ok": True}


# Search
@router.get("/search")
def search_kb(
    q: str = Query(..., min_length=1),
    user: dict = Depends(get_current_user),
    limit: int = Query(20, ge=1, le=100),
):
    items, _ = KBArticleRepo(user["org_id"]).list(limit=10000)
    qlow = q.lower()
    matches = []
    for a in items:
        score = 0
        if qlow in (a.get("title", "") or "").lower():
            score += 10
        if qlow in (a.get("body", "") or "").lower():
            score += 5
        for tag in (a.get("tags") or []):
            if qlow in tag.lower():
                score += 3
        if score > 0:
            matches.append({**a, "_score": score})
    matches.sort(key=lambda x: x["_score"], reverse=True)
    return {"items": matches[:limit], "total": len(matches)}


@router.get("/popular")
def popular_articles(user: dict = Depends(get_current_user), limit: int = 10):
    items, _ = KBArticleRepo(user["org_id"]).list(limit=10000)
    items.sort(key=lambda a: int(a.get("view_count", 0)), reverse=True)
    return {"items": items[:limit]}
