"""Sprint 67a: NGO / Non-Profit — donations, donors, grants, fund accounting.

FIX-2141..FIX-2170.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/ngo", tags=["NGO"])


class DonorRepo(BaseRepository):
    collection_name = "ngo_donors"


class DonationRepo(BaseRepository):
    collection_name = "ngo_donations"


class CampaignRepo(BaseRepository):
    collection_name = "ngo_campaigns"


class GrantRepo(BaseRepository):
    collection_name = "ngo_grants"


class FundRepo(BaseRepository):
    collection_name = "ngo_funds"


class BeneficiaryRepo(BaseRepository):
    collection_name = "ngo_beneficiaries"


class VolunteerRepo(BaseRepository):
    collection_name = "ngo_volunteers"


class DonorCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    type: str = Field("individual", pattern=r"^(individual|corporate|government|foundation)$")
    is_recurring: bool = False


class DonationCreate(BaseModel):
    donor_id: str
    amount: float = Field(..., ge=0)
    currency: str = "IQD"
    campaign_id: Optional[str] = None
    fund_id: Optional[str] = None
    is_tax_deductible: bool = True
    received_at: Optional[str] = None


class CampaignCreate(BaseModel):
    name: str
    target_amount: float = 0.0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: bool = True


class GrantCreate(BaseModel):
    funder: str
    title: str
    amount: float
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str = Field("applied", pattern=r"^(applied|approved|active|closed|rejected)$")


class FundCreate(BaseModel):
    name: str
    restricted: bool = False
    purpose: Optional[str] = None


class BeneficiaryCreate(BaseModel):
    name: str
    category: Optional[str] = None
    location: Optional[str] = None
    needs: Optional[str] = None


class VolunteerCreate(BaseModel):
    name: str
    skills: list[str] = Field(default_factory=list)
    availability: Optional[str] = None
    is_active: bool = True


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


_quick("/donors", DonorRepo, DonorCreate)
_quick("/donations", DonationRepo, DonationCreate)
_quick("/campaigns", CampaignRepo, CampaignCreate)
_quick("/grants", GrantRepo, GrantCreate)
_quick("/funds", FundRepo, FundCreate)
_quick("/beneficiaries", BeneficiaryRepo, BeneficiaryCreate)
_quick("/volunteers", VolunteerRepo, VolunteerCreate)


@router.get("/campaigns/{cid}/progress")
def campaign_progress(cid: str, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    camp = _own(CampaignRepo(org), cid, org)
    dons, _ = DonationRepo(org).list(filters=[{"field": "campaign_id", "op": "==", "value": cid}], limit=10000)
    raised = sum(float(d.get("amount", 0)) for d in dons)
    target = float(camp.get("target_amount", 0))
    return {
        "raised": raised,
        "target": target,
        "pct": round((raised / target * 100) if target else 0, 2),
        "donations": len(dons),
    }


@router.get("/funds/{fid}/balance")
def fund_balance(fid: str, user: dict = Depends(get_current_user)):
    dons, _ = DonationRepo(user["org_id"]).list(filters=[{"field": "fund_id", "op": "==", "value": fid}], limit=10000)
    return {"balance": sum(float(d.get("amount", 0)) for d in dons), "donations": len(dons)}
