"""Sprint 51: Rental Business — rental products, contracts, pickup/return.

FIX-1616..FIX-1640.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/rental", tags=["Rental"])


class RentalProductRepo(BaseRepository):
    collection_name = "rental_products"


class RentalContractRepo(BaseRepository):
    collection_name = "rental_contracts"


class RentalPickupRepo(BaseRepository):
    collection_name = "rental_pickups"


class RentalReturnRepo(BaseRepository):
    collection_name = "rental_returns"


class RentalDamageRepo(BaseRepository):
    collection_name = "rental_damages"


class ProductCreate(BaseModel):
    name: str
    daily_rate: float = Field(..., ge=0)
    weekly_rate: float = 0.0
    monthly_rate: float = 0.0
    deposit: float = 0.0
    quantity_total: int = 1
    is_available: bool = True


class ContractCreate(BaseModel):
    contact_id: Optional[str] = None
    customer_name: str
    product_id: str
    quantity: int = Field(1, ge=1)
    start_date: str
    end_date: str
    daily_rate: Optional[float] = None
    deposit_amount: float = 0.0


class PickupCreate(BaseModel):
    contract_id: str
    picked_up_at: Optional[str] = None
    notes: Optional[str] = None


class ReturnCreate(BaseModel):
    contract_id: str
    returned_at: Optional[str] = None
    condition: str = Field("ok", pattern=r"^(ok|damaged|missing)$")
    notes: Optional[str] = None


class DamageCreate(BaseModel):
    contract_id: str
    description: str
    charge_amount: float = 0.0


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


_quick("/products", RentalProductRepo, ProductCreate)
_quick("/contracts", RentalContractRepo, ContractCreate)
_quick("/pickups", RentalPickupRepo, PickupCreate)
_quick("/returns", RentalReturnRepo, ReturnCreate)
_quick("/damages", RentalDamageRepo, DamageCreate)


@router.post("/contracts/{cid}/start")
def start_contract(cid: str, user: dict = Depends(get_current_user)):
    repo = RentalContractRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    return repo.update(cid, {"status": "active", "activated_at": datetime.utcnow().isoformat()})


@router.post("/contracts/{cid}/close")
def close_contract(cid: str, user: dict = Depends(get_current_user)):
    repo = RentalContractRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    return repo.update(cid, {"status": "closed", "closed_at": datetime.utcnow().isoformat()})
