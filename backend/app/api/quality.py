"""Sprint 41a: Quality Management — checks, alerts, CAPA, non-conformities.

FIX-1176..FIX-1205.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
from app.services.report_streams import collect_stream

router = APIRouter(prefix="/api/quality", tags=["Quality"])


class QCPointRepo(BaseRepository):
    collection_name = "quality_points"


class QCCheckRepo(BaseRepository):
    collection_name = "quality_checks"


class QCAlertRepo(BaseRepository):
    collection_name = "quality_alerts"


class QCNonConformityRepo(BaseRepository):
    collection_name = "quality_non_conformities"


class QCCAPARepo(BaseRepository):
    collection_name = "quality_capa"


class QCTeamRepo(BaseRepository):
    collection_name = "quality_teams"


class QCReasonRepo(BaseRepository):
    collection_name = "quality_reasons"


class PointCreate(BaseModel):
    name: str
    operation: str = Field("manufacturing", pattern=r"^(manufacturing|receiving|delivery|stock_move)$")
    product_id: Optional[str] = None
    test_type: str = Field("pass_fail", pattern=r"^(pass_fail|measure|instructions)$")
    instructions: Optional[str] = None
    is_active: bool = True


class CheckCreate(BaseModel):
    point_id: Optional[str] = None
    product_id: Optional[str] = None
    reference_id: Optional[str] = None
    reference_type: Optional[str] = None
    measure: Optional[float] = None
    measure_min: Optional[float] = None
    measure_max: Optional[float] = None
    notes: Optional[str] = None


class AlertCreate(BaseModel):
    title: str
    severity: str = Field("medium", pattern=r"^(low|medium|high|critical)$")
    product_id: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None


class NCCreate(BaseModel):
    title: str
    description: str
    severity: str = Field("medium", pattern=r"^(low|medium|high|critical)$")
    product_id: Optional[str] = None
    detected_in: Optional[str] = None
    quantity_affected: float = 0.0


class CAPACreate(BaseModel):
    non_conformity_id: Optional[str] = None
    title: str
    root_cause: Optional[str] = None
    corrective_action: Optional[str] = None
    preventive_action: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None


class TeamCreate(BaseModel):
    name: str
    members: list[str] = Field(default_factory=list)


class ReasonCreate(BaseModel):
    name: str
    category: Optional[str] = None


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


_quick("/points", QCPointRepo, PointCreate)
_quick("/checks", QCCheckRepo, CheckCreate)
_quick("/alerts", QCAlertRepo, AlertCreate)
_quick("/non-conformities", QCNonConformityRepo, NCCreate)
_quick("/capa", QCCAPARepo, CAPACreate)
_quick("/teams", QCTeamRepo, TeamCreate)
_quick("/reasons", QCReasonRepo, ReasonCreate)


@router.post("/checks/{cid}/pass")
def pass_check(cid: str, user: dict = Depends(get_current_user)):
    repo = QCCheckRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    return repo.update(cid, {"status": "pass", "checked_at": datetime.utcnow().isoformat()})


@router.post("/checks/{cid}/fail")
def fail_check(cid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = QCCheckRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    return repo.update(cid, {
        "status": "fail",
        "checked_at": datetime.utcnow().isoformat(),
        "fail_reason": body.get("reason"),
    })


@router.post("/capa/{cid}/close")
def close_capa(cid: str, user: dict = Depends(get_current_user)):
    repo = QCCAPARepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    return repo.update(cid, {"status": "closed", "closed_at": datetime.utcnow().isoformat()})


@router.get("/dashboard")
def quality_dashboard(user: dict = Depends(get_current_user)):
    checks = collect_stream(QCCheckRepo(user["org_id"]), max_docs=10000)
    ncs = collect_stream(QCNonConformityRepo(user["org_id"]), max_docs=10000)
    capas = collect_stream(QCCAPARepo(user["org_id"]), max_docs=10000)
    return {
        "checks_total": len(checks),
        "checks_passed": sum(1 for c in checks if c.get("status") == "pass"),
        "checks_failed": sum(1 for c in checks if c.get("status") == "fail"),
        "non_conformities": len(ncs),
        "capas_open": sum(1 for c in capas if c.get("status") != "closed"),
    }
