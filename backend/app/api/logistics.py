"""Sprint 65: Logistics — shipments, routes, drivers, GPS tracking, freight.

FIX-2071..FIX-2110.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/logistics", tags=["Logistics"])


class ShipmentRepo(BaseRepository):
    collection_name = "log_shipments"


class ShipmentEventRepo(BaseRepository):
    collection_name = "log_shipment_events"


class RouteRepo(BaseRepository):
    collection_name = "log_routes"


class DriverRepo(BaseRepository):
    collection_name = "log_drivers"


class VehicleRepo(BaseRepository):
    collection_name = "log_vehicles"


class GPSPositionRepo(BaseRepository):
    collection_name = "log_gps_positions"


class FreightRateRepo(BaseRepository):
    collection_name = "log_freight_rates"


class WaybillRepo(BaseRepository):
    collection_name = "log_waybills"


class ShipmentCreate(BaseModel):
    tracking_number: Optional[str] = None
    origin: str
    destination: str
    weight_kg: float = 0.0
    sender: Optional[str] = None
    receiver: Optional[str] = None
    receiver_phone: Optional[str] = None
    declared_value: float = 0.0


class ShipmentEventCreate(BaseModel):
    shipment_id: str
    event_type: str
    location: Optional[str] = None
    notes: Optional[str] = None


class RouteCreate(BaseModel):
    name: str
    driver_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    stops: list[dict] = Field(default_factory=list)
    planned_date: Optional[str] = None


class DriverCreate(BaseModel):
    name: str
    license_no: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True


class VehicleCreate(BaseModel):
    plate_number: str
    type: str = Field("van", pattern=r"^(motorcycle|van|truck|trailer|car)$")
    capacity_kg: float = 0.0
    is_active: bool = True


class GPSCreate(BaseModel):
    vehicle_id: str
    latitude: float
    longitude: float
    speed_kmh: Optional[float] = None
    timestamp: Optional[str] = None


class FreightRateCreate(BaseModel):
    origin_zone: str
    destination_zone: str
    weight_min: float = 0.0
    weight_max: float = 99999.0
    price: float = 0.0


class WaybillCreate(BaseModel):
    shipment_id: str
    waybill_number: str
    issued_at: Optional[str] = None


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


_quick("/shipments", ShipmentRepo, ShipmentCreate)
_quick("/shipment-events", ShipmentEventRepo, ShipmentEventCreate)
_quick("/routes", RouteRepo, RouteCreate)
_quick("/drivers", DriverRepo, DriverCreate)
_quick("/vehicles", VehicleRepo, VehicleCreate)
_quick("/gps", GPSPositionRepo, GPSCreate)
_quick("/freight-rates", FreightRateRepo, FreightRateCreate)
_quick("/waybills", WaybillRepo, WaybillCreate)


@router.get("/track/{tracking_number}")
def track_shipment(tracking_number: str, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    shipments, _ = ShipmentRepo(org).list(
        filters=[{"field": "tracking_number", "op": "==", "value": tracking_number}], limit=10,
    )
    if not shipments:
        raise HTTPException(404, "نەدۆزرایەوە")
    sh = shipments[0]
    events, _ = ShipmentEventRepo(org).list(
        filters=[{"field": "shipment_id", "op": "==", "value": sh.get("id")}],
        order_by="created_at", limit=500,
    )
    return {"shipment": sh, "events": events}


@router.post("/shipments/{sid}/deliver")
def deliver_shipment(sid: str, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    repo = ShipmentRepo(org)
    _own(repo, sid, org)
    repo.update(sid, {"status": "delivered", "delivered_at": datetime.utcnow().isoformat()})
    ShipmentEventRepo(org).create({
        "shipment_id": sid,
        "event_type": "delivered",
        "notes": "گەیشتەوە",
    })
    return {"ok": True}
