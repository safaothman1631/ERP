"""Sprint 58: Pharmacy — drugs, dispensing, drug interactions, expiry tracking.

FIX-1831..FIX-1860.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/pharmacy", tags=["Pharmacy"])


class DrugRepo(BaseRepository):
    collection_name = "pharm_drugs"


class DrugBatchRepo(BaseRepository):
    collection_name = "pharm_batches"


class DispenseRepo(BaseRepository):
    collection_name = "pharm_dispenses"


class InteractionRepo(BaseRepository):
    collection_name = "pharm_interactions"


class ControlledLogRepo(BaseRepository):
    collection_name = "pharm_controlled_logs"


class DrugCreate(BaseModel):
    name: str
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    form: str = Field("tablet", pattern=r"^(tablet|capsule|syrup|injection|cream|drops|inhaler)$")
    is_controlled: bool = False
    requires_prescription: bool = True


class BatchCreate(BaseModel):
    drug_id: str
    batch_no: str
    expiry_date: str
    quantity: int = Field(0, ge=0)
    cost_price: float = 0.0
    sale_price: float = 0.0


class DispenseCreate(BaseModel):
    prescription_id: Optional[str] = None
    patient_id: Optional[str] = None
    drug_id: str
    batch_id: Optional[str] = None
    quantity: int = Field(1, ge=1)
    instructions: Optional[str] = None


class InteractionCreate(BaseModel):
    drug_a_id: str
    drug_b_id: str
    severity: str = Field("moderate", pattern=r"^(minor|moderate|major|contraindicated)$")
    description: Optional[str] = None


class ControlledLogCreate(BaseModel):
    drug_id: str
    quantity: int
    movement_type: str = Field("dispense", pattern=r"^(receive|dispense|destroy|transfer)$")
    notes: Optional[str] = None


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


_quick("/drugs", DrugRepo, DrugCreate)
_quick("/batches", DrugBatchRepo, BatchCreate)
_quick("/dispenses", DispenseRepo, DispenseCreate)
_quick("/interactions", InteractionRepo, InteractionCreate)
_quick("/controlled-logs", ControlledLogRepo, ControlledLogCreate)


@router.get("/expiring")
def expiring_batches(days: int = Query(90, ge=1, le=365), user: dict = Depends(get_current_user)):
    items, _ = DrugBatchRepo(user["org_id"]).list(limit=10000)
    from datetime import timedelta
    cutoff = (datetime.utcnow() + timedelta(days=days)).date().isoformat()
    expiring = [b for b in items if (b.get("expiry_date") or "9999") <= cutoff]
    return {"items": expiring, "total": len(expiring)}


@router.get("/check-interactions")
def check_interactions(drug_ids: str, user: dict = Depends(get_current_user)):
    ids = [d.strip() for d in drug_ids.split(",") if d.strip()]
    items, _ = InteractionRepo(user["org_id"]).list(limit=10000)
    matches = [i for i in items if i.get("drug_a_id") in ids and i.get("drug_b_id") in ids]
    return {"items": matches, "total": len(matches)}
