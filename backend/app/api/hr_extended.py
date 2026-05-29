"""Sprint 43: HR Phase 3 — Recruitment, Appraisals, Skills, eLearning enrollments.

FIX-1276..FIX-1320.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
from app.services.report_streams import collect_stream

router = APIRouter(prefix="/api/hr-extended", tags=["HR Extended"])


# ── Recruitment ──
class JobPositionRepo(BaseRepository):
    collection_name = "hr_job_positions"


class CandidateRepo(BaseRepository):
    collection_name = "hr_candidates"


class ApplicationRepo(BaseRepository):
    collection_name = "hr_applications"


class InterviewRepo(BaseRepository):
    collection_name = "hr_interviews"


class OfferRepo(BaseRepository):
    collection_name = "hr_offers"


# ── Appraisals ──
class AppraisalCycleRepo(BaseRepository):
    collection_name = "hr_appraisal_cycles"


class AppraisalRepo(BaseRepository):
    collection_name = "hr_appraisals"


class GoalRepo(BaseRepository):
    collection_name = "hr_goals"


class FeedbackRepo(BaseRepository):
    collection_name = "hr_feedbacks"


# ── Skills ──
class SkillRepo(BaseRepository):
    collection_name = "hr_skills"


class EmployeeSkillRepo(BaseRepository):
    collection_name = "hr_employee_skills"


# ── Schemas ──
class JobPositionCreate(BaseModel):
    title: str
    department: Optional[str] = None
    description: Optional[str] = None
    headcount_open: int = Field(1, ge=0, le=100)
    location: Optional[str] = None
    is_active: bool = True


class CandidateCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    cv_url: Optional[str] = None
    source: Optional[str] = None


class ApplicationCreate(BaseModel):
    candidate_id: str
    position_id: str
    notes: Optional[str] = None
    expected_salary: Optional[float] = None


class InterviewCreate(BaseModel):
    application_id: str
    scheduled_at: str
    interviewer_ids: list[str] = Field(default_factory=list)
    type: str = Field("phone", pattern=r"^(phone|video|in_person|technical)$")


class OfferCreate(BaseModel):
    application_id: str
    salary: float
    currency: str = "IQD"
    start_date: Optional[str] = None
    notes: Optional[str] = None


class CycleCreate(BaseModel):
    name: str
    start_date: str
    end_date: str
    template: str = Field("annual", pattern=r"^(annual|semi_annual|quarterly|monthly)$")


class AppraisalCreate(BaseModel):
    cycle_id: str
    employee_id: str
    manager_id: Optional[str] = None
    self_review: Optional[str] = None
    rating: Optional[float] = Field(None, ge=1, le=5)


class GoalCreate(BaseModel):
    employee_id: str
    title: str
    description: Optional[str] = None
    target_date: Optional[str] = None
    progress_pct: float = Field(0.0, ge=0, le=100)


class FeedbackCreate(BaseModel):
    appraisal_id: str
    from_user_id: str
    body: str
    rating: Optional[float] = Field(None, ge=1, le=5)


class SkillCreate(BaseModel):
    name: str
    category: Optional[str] = None


class EmployeeSkillCreate(BaseModel):
    employee_id: str
    skill_id: str
    level: int = Field(1, ge=1, le=5)


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


_quick("/positions", JobPositionRepo, JobPositionCreate)
_quick("/candidates", CandidateRepo, CandidateCreate)
_quick("/applications", ApplicationRepo, ApplicationCreate)
_quick("/interviews", InterviewRepo, InterviewCreate)
_quick("/offers", OfferRepo, OfferCreate)
_quick("/cycles", AppraisalCycleRepo, CycleCreate)
_quick("/appraisals", AppraisalRepo, AppraisalCreate)
_quick("/goals", GoalRepo, GoalCreate)
_quick("/feedbacks", FeedbackRepo, FeedbackCreate)
_quick("/skills", SkillRepo, SkillCreate)
_quick("/employee-skills", EmployeeSkillRepo, EmployeeSkillCreate)


# Recruitment workflow
@router.post("/applications/{aid}/advance")
def advance_application(aid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = ApplicationRepo(user["org_id"])
    _own(repo, aid, user["org_id"])
    return repo.update(aid, {"stage": body.get("stage", "screening")})


@router.post("/applications/{aid}/reject")
def reject_application(aid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = ApplicationRepo(user["org_id"])
    _own(repo, aid, user["org_id"])
    return repo.update(aid, {
        "stage": "rejected",
        "rejected_at": datetime.utcnow().isoformat(),
        "reject_reason": body.get("reason"),
    })


@router.post("/applications/{aid}/hire")
def hire_application(aid: str, user: dict = Depends(get_current_user)):
    repo = ApplicationRepo(user["org_id"])
    _own(repo, aid, user["org_id"])
    return repo.update(aid, {"stage": "hired", "hired_at": datetime.utcnow().isoformat()})


@router.post("/offers/{oid}/accept")
def accept_offer(oid: str, user: dict = Depends(get_current_user)):
    repo = OfferRepo(user["org_id"])
    _own(repo, oid, user["org_id"])
    return repo.update(oid, {"status": "accepted", "accepted_at": datetime.utcnow().isoformat()})


@router.post("/offers/{oid}/decline")
def decline_offer(oid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = OfferRepo(user["org_id"])
    _own(repo, oid, user["org_id"])
    return repo.update(oid, {
        "status": "declined",
        "declined_at": datetime.utcnow().isoformat(),
        "decline_reason": body.get("reason"),
    })


# Recruitment dashboard
@router.get("/recruitment/dashboard")
def recruit_dashboard(user: dict = Depends(get_current_user)):
    apps = collect_stream(ApplicationRepo(user["org_id"]), max_docs=10000)
    by_stage: dict[str, int] = {}
    for a in apps:
        by_stage[a.get("stage", "applied")] = by_stage.get(a.get("stage", "applied"), 0) + 1
    pos = collect_stream(JobPositionRepo(user["org_id"]), max_docs=10000)
    open_positions = sum(1 for p in pos if p.get("is_active"))
    return {
        "applications_total": len(apps),
        "by_stage": by_stage,
        "open_positions": open_positions,
    }
