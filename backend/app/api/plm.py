"""Sprint 42a: PLM — Product Lifecycle Management (ECO, versions).

FIX-1231..FIX-1255.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/plm", tags=["PLM"])


class ProductVersionRepo(BaseRepository):
    collection_name = "plm_product_versions"


class ECORepo(BaseRepository):
    collection_name = "plm_ecos"


class ECOStageRepo(BaseRepository):
    collection_name = "plm_eco_stages"


class ECOAttachmentRepo(BaseRepository):
    collection_name = "plm_eco_attachments"


class BOMVersionRepo(BaseRepository):
    collection_name = "plm_bom_versions"


class VersionCreate(BaseModel):
    product_id: str
    version_label: str
    description: Optional[str] = None
    is_active: bool = False


class ECOCreate(BaseModel):
    title: str
    product_id: str
    type: str = Field("change", pattern=r"^(change|new_part|obsolete|deviation)$")
    reason: Optional[str] = None
    proposed_changes: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: str = Field("medium", pattern=r"^(low|medium|high|urgent)$")


class ECOStageCreate(BaseModel):
    name: str
    sequence: int = 0
    is_final_approval: bool = False


class AttachmentCreate(BaseModel):
    eco_id: str
    name: str
    storage_url: str


class BOMVersionCreate(BaseModel):
    product_id: str
    version_label: str
    components: list[dict] = Field(default_factory=list)
    is_active: bool = False


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


_quick("/versions", ProductVersionRepo, VersionCreate)
_quick("/ecos", ECORepo, ECOCreate)
_quick("/stages", ECOStageRepo, ECOStageCreate)
_quick("/attachments", ECOAttachmentRepo, AttachmentCreate)
_quick("/boms", BOMVersionRepo, BOMVersionCreate)


@router.post("/ecos/{eid}/submit")
def submit_eco(eid: str, user: dict = Depends(get_current_user)):
    repo = ECORepo(user["org_id"])
    _own(repo, eid, user["org_id"])
    return repo.update(eid, {"status": "in_review", "submitted_at": datetime.utcnow().isoformat()})


@router.post("/ecos/{eid}/approve")
def approve_eco(eid: str, user: dict = Depends(get_current_user)):
    repo = ECORepo(user["org_id"])
    _own(repo, eid, user["org_id"])
    return repo.update(eid, {
        "status": "approved",
        "approved_at": datetime.utcnow().isoformat(),
        "approved_by": user.get("id") or user.get("email"),
    })


@router.post("/ecos/{eid}/reject")
def reject_eco(eid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = ECORepo(user["org_id"])
    _own(repo, eid, user["org_id"])
    return repo.update(eid, {
        "status": "rejected",
        "rejected_at": datetime.utcnow().isoformat(),
        "reject_reason": body.get("reason"),
    })


@router.post("/versions/{vid}/activate")
def activate_version(vid: str, user: dict = Depends(get_current_user)):
    repo = ProductVersionRepo(user["org_id"])
    v = _own(repo, vid, user["org_id"])
    # Deactivate other versions for same product
    others, _ = repo.list(
        filters=[{"field": "product_id", "op": "==", "value": v["product_id"]}], limit=500,
    )
    for o in others:
        if o["id"] != vid and o.get("is_active"):
            repo.update(o["id"], {"is_active": False})
    return repo.update(vid, {"is_active": True, "activated_at": datetime.utcnow().isoformat()})
