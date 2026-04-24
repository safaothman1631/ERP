"""Sprint 62: Construction — sites, progress billing, job costing, equipment.

FIX-1956..FIX-1990.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/construction", tags=["Construction"])


class SiteRepo(BaseRepository):
    collection_name = "constr_sites"


class ConstructionProjectRepo(BaseRepository):
    collection_name = "constr_projects"


class WBSItemRepo(BaseRepository):
    collection_name = "constr_wbs"


class ProgressBillingRepo(BaseRepository):
    collection_name = "constr_progress_billings"


class JobCostRepo(BaseRepository):
    collection_name = "constr_job_costs"


class EquipmentRepo(BaseRepository):
    collection_name = "constr_equipment"


class SubcontractorRepo(BaseRepository):
    collection_name = "constr_subcontractors"


class SiteCreate(BaseModel):
    name: str
    address: Optional[str] = None
    project_id: Optional[str] = None
    site_manager: Optional[str] = None


class ProjectCreate(BaseModel):
    name: str
    client: Optional[str] = None
    contract_value: float = 0.0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str = Field("planning", pattern=r"^(planning|in_progress|on_hold|completed|cancelled)$")


class WBSCreate(BaseModel):
    project_id: str
    code: str
    name: str
    parent_id: Optional[str] = None
    budget: float = 0.0
    progress_pct: float = Field(0.0, ge=0, le=100)


class ProgressBillingCreate(BaseModel):
    project_id: str
    period_start: str
    period_end: str
    pct_complete: float = Field(..., ge=0, le=100)
    amount: float = 0.0


class JobCostCreate(BaseModel):
    project_id: str
    wbs_id: Optional[str] = None
    cost_type: str = Field("labor", pattern=r"^(labor|material|equipment|subcontract|overhead)$")
    description: str
    amount: float
    incurred_at: Optional[str] = None


class EquipmentCreate(BaseModel):
    name: str
    serial_no: Optional[str] = None
    daily_rate: float = 0.0
    site_id: Optional[str] = None
    status: str = Field("idle", pattern=r"^(idle|in_use|maintenance|broken)$")


class SubcontractorCreate(BaseModel):
    name: str
    trade: Optional[str] = None
    contact: Optional[str] = None
    contract_value: float = 0.0


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


_quick("/sites", SiteRepo, SiteCreate)
_quick("/projects", ConstructionProjectRepo, ProjectCreate)
_quick("/wbs", WBSItemRepo, WBSCreate)
_quick("/progress-billings", ProgressBillingRepo, ProgressBillingCreate)
_quick("/job-costs", JobCostRepo, JobCostCreate)
_quick("/equipment", EquipmentRepo, EquipmentCreate)
_quick("/subcontractors", SubcontractorRepo, SubcontractorCreate)


@router.get("/projects/{pid}/cost-summary")
def project_costs(pid: str, user: dict = Depends(get_current_user)):
    items, _ = JobCostRepo(user["org_id"]).list(
        filters=[{"field": "project_id", "op": "==", "value": pid}], limit=10000,
    )
    by_type: dict[str, float] = {}
    for c in items:
        t = c.get("cost_type", "other")
        by_type[t] = by_type.get(t, 0.0) + float(c.get("amount", 0))
    return {"by_type": by_type, "total": sum(by_type.values()), "entries": len(items)}
