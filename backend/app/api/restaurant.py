"""Sprint 61: Restaurant Mgmt — KDS, table mgmt, self-order, delivery.

FIX-1921..FIX-1955.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/restaurant", tags=["Restaurant"])


class MenuRepo(BaseRepository):
    collection_name = "rest_menus"


class MenuItemRepo(BaseRepository):
    collection_name = "rest_menu_items"


class TableRepo(BaseRepository):
    collection_name = "rest_tables"


class RestOrderRepo(BaseRepository):
    collection_name = "rest_orders"


class KDSTicketRepo(BaseRepository):
    collection_name = "rest_kds_tickets"


class DeliveryOrderRepo(BaseRepository):
    collection_name = "rest_delivery_orders"


class RecipeRepo(BaseRepository):
    collection_name = "rest_recipes"


class MenuCreate(BaseModel):
    name: str
    is_active: bool = True
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None


class MenuItemCreate(BaseModel):
    menu_id: str
    name: str
    price: float = Field(..., ge=0)
    category: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    prep_time_minutes: int = 15
    is_available: bool = True


class TableCreate(BaseModel):
    number: str
    seats: int = 4
    section: Optional[str] = None
    status: str = Field("free", pattern=r"^(free|occupied|reserved|cleaning)$")


class OrderCreate(BaseModel):
    table_id: Optional[str] = None
    order_type: str = Field("dine_in", pattern=r"^(dine_in|takeaway|delivery|self_order)$")
    items: list[dict] = Field(default_factory=list)
    customer_name: Optional[str] = None


class KDSTicketCreate(BaseModel):
    order_id: str
    station: str = Field("kitchen", pattern=r"^(kitchen|bar|grill|salad|dessert)$")
    items: list[dict] = Field(default_factory=list)


class DeliveryOrderCreate(BaseModel):
    order_id: str
    address: str
    phone: str
    courier_id: Optional[str] = None
    delivery_fee: float = 0.0


class RecipeCreate(BaseModel):
    menu_item_id: str
    ingredients: list[dict] = Field(default_factory=list)
    yield_quantity: int = 1


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


_quick("/menus", MenuRepo, MenuCreate)
_quick("/menu-items", MenuItemRepo, MenuItemCreate)
_quick("/tables", TableRepo, TableCreate)
_quick("/orders", RestOrderRepo, OrderCreate)
_quick("/kds", KDSTicketRepo, KDSTicketCreate)
_quick("/delivery-orders", DeliveryOrderRepo, DeliveryOrderCreate)
_quick("/recipes", RecipeRepo, RecipeCreate)


@router.post("/kds/{tid}/start")
def kds_start(tid: str, user: dict = Depends(get_current_user)):
    repo = KDSTicketRepo(user["org_id"])
    _own(repo, tid, user["org_id"])
    return repo.update(tid, {"status": "preparing", "started_at": datetime.utcnow().isoformat()})


@router.post("/kds/{tid}/ready")
def kds_ready(tid: str, user: dict = Depends(get_current_user)):
    repo = KDSTicketRepo(user["org_id"])
    _own(repo, tid, user["org_id"])
    return repo.update(tid, {"status": "ready", "ready_at": datetime.utcnow().isoformat()})


@router.post("/orders/{oid}/serve")
def serve_order(oid: str, user: dict = Depends(get_current_user)):
    repo = RestOrderRepo(user["org_id"])
    _own(repo, oid, user["org_id"])
    return repo.update(oid, {"status": "served", "served_at": datetime.utcnow().isoformat()})


@router.post("/delivery-orders/{did}/dispatch")
def dispatch_delivery(did: str, body: dict, user: dict = Depends(get_current_user)):
    repo = DeliveryOrderRepo(user["org_id"])
    _own(repo, did, user["org_id"])
    return repo.update(did, {
        "status": "dispatched",
        "courier_id": body.get("courier_id"),
        "dispatched_at": datetime.utcnow().isoformat(),
    })


@router.post("/delivery-orders/{did}/delivered")
def delivered(did: str, user: dict = Depends(get_current_user)):
    repo = DeliveryOrderRepo(user["org_id"])
    _own(repo, did, user["org_id"])
    return repo.update(did, {"status": "delivered", "delivered_at": datetime.utcnow().isoformat()})
