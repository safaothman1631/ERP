"""Sprint 42b: Repairs — repair orders, parts, warranty.

FIX-1256..FIX-1275.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/repairs", tags=["Repairs"])


class RepairOrderRepo(BaseRepository):
    collection_name = "repair_orders"


class RepairPartRepo(BaseRepository):
    collection_name = "repair_parts"


class WarrantyRepo(BaseRepository):
    collection_name = "repair_warranties"


class RepairOrderCreate(BaseModel):
    contact_id: Optional[str] = None
    customer_name: str
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    serial_no: Optional[str] = None
    issue_description: str
    received_at: Optional[str] = None
    estimated_cost: float = 0.0
    is_under_warranty: bool = False
    assigned_to: Optional[str] = None


class PartCreate(BaseModel):
    repair_order_id: str
    item_id: Optional[str] = None
    description: str
    quantity: float = Field(1.0, gt=0)
    unit_cost: float = Field(0.0, ge=0)


class WarrantyCreate(BaseModel):
    product_id: Optional[str] = None
    serial_no: str
    customer_id: Optional[str] = None
    start_date: str
    end_date: str
    coverage_notes: Optional[str] = None


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


_quick("/orders", RepairOrderRepo, RepairOrderCreate)
_quick("/parts", RepairPartRepo, PartCreate)
_quick("/warranties", WarrantyRepo, WarrantyCreate)


@router.post("/orders/{rid}/diagnose")
def diagnose(rid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = RepairOrderRepo(user["org_id"])
    _own(repo, rid, user["org_id"])
    return repo.update(rid, {
        "status": "diagnosed",
        "diagnosis_notes": body.get("notes"),
        "diagnosed_at": datetime.utcnow().isoformat(),
    })


@router.post("/orders/{rid}/repair")
def start_repair(rid: str, user: dict = Depends(get_current_user)):
    repo = RepairOrderRepo(user["org_id"])
    _own(repo, rid, user["org_id"])
    return repo.update(rid, {"status": "in_repair", "repair_started_at": datetime.utcnow().isoformat()})


@router.post("/orders/{rid}/complete")
def complete_repair(rid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = RepairOrderRepo(user["org_id"])
    _own(repo, rid, user["org_id"])
    return repo.update(rid, {
        "status": "done",
        "completed_at": datetime.utcnow().isoformat(),
        "final_cost": body.get("final_cost"),
        "completion_notes": body.get("notes"),
    })


@router.post("/orders/{rid}/deliver")
def deliver_repair(rid: str, user: dict = Depends(get_current_user)):
    repo = RepairOrderRepo(user["org_id"])
    _own(repo, rid, user["org_id"])
    return repo.update(rid, {"status": "delivered", "delivered_at": datetime.utcnow().isoformat()})


@router.get("/warranties/check/{serial_no}")
def check_warranty(serial_no: str, user: dict = Depends(get_current_user)):
    items, _ = WarrantyRepo(user["org_id"]).list(
        filters=[{"field": "serial_no", "op": "==", "value": serial_no}], limit=10,
    )
    if not items:
        return {"under_warranty": False, "warranty": None}
    w = items[0]
    try:
        end = datetime.fromisoformat(w.get("end_date", ""))
        return {"under_warranty": end >= datetime.utcnow(), "warranty": w}
    except Exception:
        return {"under_warranty": False, "warranty": w}
