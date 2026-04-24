"""Sprint 67b: Government / Public Sector — citizens, services, permits, procurement.

FIX-2171..FIX-2200.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/government", tags=["Government"])


class CitizenRepo(BaseRepository):
    collection_name = "gov_citizens"


class ServiceRepo(BaseRepository):
    collection_name = "gov_services"


class ServiceRequestRepo(BaseRepository):
    collection_name = "gov_service_requests"


class PermitRepo(BaseRepository):
    collection_name = "gov_permits"


class TaxAssessmentRepo(BaseRepository):
    collection_name = "gov_tax_assessments"


class TenderRepo(BaseRepository):
    collection_name = "gov_tenders"


class TenderBidRepo(BaseRepository):
    collection_name = "gov_tender_bids"


class CitizenCreate(BaseModel):
    name: str
    national_id: str
    dob: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None


class ServiceCreate(BaseModel):
    name: str
    department: Optional[str] = None
    fee: float = 0.0
    estimated_days: int = 1
    required_documents: list[str] = Field(default_factory=list)
    is_active: bool = True


class ServiceRequestCreate(BaseModel):
    citizen_id: str
    service_id: str
    documents: list[dict] = Field(default_factory=list)


class PermitCreate(BaseModel):
    citizen_id: str
    permit_type: str = Field("building", pattern=r"^(building|business|driving|trade|import|export|other)$")
    description: Optional[str] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    fee: float = 0.0


class TaxAssessmentCreate(BaseModel):
    citizen_id: str
    tax_year: int
    tax_type: str
    assessed_amount: float
    due_date: Optional[str] = None


class TenderCreate(BaseModel):
    title: str
    department: Optional[str] = None
    estimated_value: float = 0.0
    closing_date: str
    description: Optional[str] = None
    status: str = Field("open", pattern=r"^(draft|open|closed|awarded|cancelled)$")


class TenderBidCreate(BaseModel):
    tender_id: str
    bidder_name: str
    amount: float
    submitted_at: Optional[str] = None
    technical_score: float = 0.0


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


_quick("/citizens", CitizenRepo, CitizenCreate)
_quick("/services", ServiceRepo, ServiceCreate)
_quick("/service-requests", ServiceRequestRepo, ServiceRequestCreate)
_quick("/permits", PermitRepo, PermitCreate)
_quick("/tax-assessments", TaxAssessmentRepo, TaxAssessmentCreate)
_quick("/tenders", TenderRepo, TenderCreate)
_quick("/tender-bids", TenderBidRepo, TenderBidCreate)


@router.post("/service-requests/{rid}/approve")
def approve_request(rid: str, user: dict = Depends(get_current_user)):
    repo = ServiceRequestRepo(user["org_id"])
    _own(repo, rid, user["org_id"])
    return repo.update(rid, {"status": "approved", "approved_at": datetime.utcnow().isoformat()})


@router.post("/service-requests/{rid}/reject")
def reject_request(rid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = ServiceRequestRepo(user["org_id"])
    _own(repo, rid, user["org_id"])
    return repo.update(rid, {
        "status": "rejected",
        "rejected_at": datetime.utcnow().isoformat(),
        "reject_reason": body.get("reason"),
    })


@router.post("/tenders/{tid}/award")
def award_tender(tid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = TenderRepo(user["org_id"])
    _own(repo, tid, user["org_id"])
    return repo.update(tid, {
        "status": "awarded",
        "awarded_to": body.get("bidder_name") or body.get("bid_id"),
        "awarded_amount": body.get("amount"),
        "awarded_at": datetime.utcnow().isoformat(),
    })
