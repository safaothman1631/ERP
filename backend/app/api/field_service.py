"""Sprint 37: Field Service — service orders, dispatch, routes, signatures.

FIX-1041..FIX-1080.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/field-service", tags=["Field Service"])


class FSWorkerRepo(BaseRepository):
    collection_name = "fs_workers"


class FSServiceTypeRepo(BaseRepository):
    collection_name = "fs_service_types"


class FSServiceOrderRepo(BaseRepository):
    collection_name = "fs_service_orders"


class FSDispatchRepo(BaseRepository):
    collection_name = "fs_dispatches"


class FSRouteRepo(BaseRepository):
    collection_name = "fs_routes"


class FSSignatureRepo(BaseRepository):
    collection_name = "fs_signatures"


class FSPartUsageRepo(BaseRepository):
    collection_name = "fs_part_usages"


class WorkerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    skills: list[str] = Field(default_factory=list)
    is_active: bool = True


class ServiceTypeCreate(BaseModel):
    name: str
    duration_minutes: int = Field(60, ge=1, le=1440)
    base_cost: float = Field(0.0, ge=0)


class ServiceOrderCreate(BaseModel):
    contact_id: Optional[str] = None
    customer_name: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    service_type_id: Optional[str] = None
    description: Optional[str] = None
    scheduled_at: Optional[str] = None
    priority: str = Field("normal", pattern=r"^(low|normal|high|urgent)$")
    assigned_worker_id: Optional[str] = None


class ServiceOrderUpdate(BaseModel):
    description: Optional[str] = None
    scheduled_at: Optional[str] = None
    priority: Optional[str] = None
    assigned_worker_id: Optional[str] = None
    status: Optional[str] = Field(None, pattern=r"^(draft|scheduled|in_progress|done|cancelled)$")


class DispatchCreate(BaseModel):
    service_order_id: str
    worker_id: str
    estimated_arrival: Optional[str] = None


class RouteCreate(BaseModel):
    name: str
    worker_id: str
    date: str
    stops: list[dict] = Field(default_factory=list)


class SignatureCreate(BaseModel):
    service_order_id: str
    signer_name: str
    signature_data_url: str
    notes: Optional[str] = None


class PartUsageCreate(BaseModel):
    service_order_id: str
    item_id: str
    quantity: float = Field(..., gt=0)
    unit_cost: float = Field(0.0, ge=0)


def _own(repo, doc_id, org_id):
    item = repo.get(doc_id)
    if not item or item.get("org_id") != org_id:
        raise HTTPException(404, "نەدۆزرایەوە")
    return item


def _crud(prefix, repo_cls, create_model, update_model=None):
    """Generates a 5-endpoint CRUD set."""
    @router.get(prefix)
    def _list(user: dict = Depends(get_current_user), limit: int = Query(50, ge=1, le=500), offset: int = 0):
        items, total = repo_cls(user["org_id"]).list(limit=limit, offset=offset)
        return {"items": items, "total": total}

    @router.post(prefix, status_code=201)
    def _create(body: create_model, user: dict = Depends(get_current_user)):
        return repo_cls(user["org_id"]).create(body.model_dump())

    @router.get(prefix + "/{rid}")
    def _get(rid: str, user: dict = Depends(get_current_user)):
        return _own(repo_cls(user["org_id"]), rid, user["org_id"])

    upd = update_model or create_model

    @router.patch(prefix + "/{rid}")
    def _update(rid: str, body: upd, user: dict = Depends(get_current_user)):
        repo = repo_cls(user["org_id"])
        _own(repo, rid, user["org_id"])
        return repo.update(rid, {k: v for k, v in body.model_dump().items() if v is not None})

    @router.delete(prefix + "/{rid}", status_code=204)
    def _del(rid: str, user: dict = Depends(get_current_user)):
        repo = repo_cls(user["org_id"])
        _own(repo, rid, user["org_id"])
        repo.delete(rid)


_crud("/workers", FSWorkerRepo, WorkerCreate)
_crud("/service-types", FSServiceTypeRepo, ServiceTypeCreate)
_crud("/orders", FSServiceOrderRepo, ServiceOrderCreate, ServiceOrderUpdate)
_crud("/dispatches", FSDispatchRepo, DispatchCreate)
_crud("/routes", FSRouteRepo, RouteCreate)
_crud("/signatures", FSSignatureRepo, SignatureCreate)
_crud("/parts", FSPartUsageRepo, PartUsageCreate)


# Workflow endpoints
@router.post("/orders/{oid}/start")
def start_order(oid: str, user: dict = Depends(get_current_user)):
    repo = FSServiceOrderRepo(user["org_id"])
    _own(repo, oid, user["org_id"])
    return repo.update(oid, {"status": "in_progress", "started_at": datetime.utcnow().isoformat()})


@router.post("/orders/{oid}/complete")
def complete_order(oid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = FSServiceOrderRepo(user["org_id"])
    _own(repo, oid, user["org_id"])
    return repo.update(oid, {
        "status": "done",
        "completed_at": datetime.utcnow().isoformat(),
        "completion_notes": body.get("notes"),
    })


@router.post("/orders/{oid}/cancel")
def cancel_order(oid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = FSServiceOrderRepo(user["org_id"])
    _own(repo, oid, user["org_id"])
    return repo.update(oid, {
        "status": "cancelled",
        "cancelled_at": datetime.utcnow().isoformat(),
        "cancel_reason": body.get("reason"),
    })


@router.get("/dashboard")
def fs_dashboard(user: dict = Depends(get_current_user)):
    items, _ = FSServiceOrderRepo(user["org_id"]).list(limit=10000)
    by_status: dict[str, int] = {}
    for o in items:
        by_status[o.get("status", "draft")] = by_status.get(o.get("status", "draft"), 0) + 1
    workers, _ = FSWorkerRepo(user["org_id"]).list(limit=1000)
    return {
        "total_orders": len(items),
        "by_status": by_status,
        "active_workers": sum(1 for w in workers if w.get("is_active")),
    }
