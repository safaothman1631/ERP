"""Sprint 59-60: Hotel Mgmt — rooms, reservations, guests, housekeeping, channel mgr.

FIX-1861..FIX-1920.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/hotel", tags=["Hotel"])


class RoomTypeRepo(BaseRepository):
    collection_name = "hotel_room_types"


class RoomRepo(BaseRepository):
    collection_name = "hotel_rooms"


class GuestRepo(BaseRepository):
    collection_name = "hotel_guests"


class ReservationRepo(BaseRepository):
    collection_name = "hotel_reservations"


class CheckinRepo(BaseRepository):
    collection_name = "hotel_checkins"


class CheckoutRepo(BaseRepository):
    collection_name = "hotel_checkouts"


class HousekeepingRepo(BaseRepository):
    collection_name = "hotel_housekeeping"


class FolioRepo(BaseRepository):
    collection_name = "hotel_folios"


class ChannelMappingRepo(BaseRepository):
    collection_name = "hotel_channel_mappings"


class RoomTypeCreate(BaseModel):
    name: str
    base_price: float = 0.0
    max_occupancy: int = 2
    amenities: list[str] = Field(default_factory=list)


class RoomCreate(BaseModel):
    room_type_id: str
    number: str
    floor: Optional[str] = None
    status: str = Field("available", pattern=r"^(available|occupied|cleaning|maintenance|out_of_order)$")


class GuestCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    nationality: Optional[str] = None
    id_document: Optional[str] = None


class ReservationCreate(BaseModel):
    guest_id: str
    room_id: Optional[str] = None
    room_type_id: Optional[str] = None
    check_in_date: str
    check_out_date: str
    adults: int = 1
    children: int = 0
    rate: float = 0.0
    source: str = Field("direct", pattern=r"^(direct|booking_com|expedia|airbnb|agoda|other)$")


class CheckinCreate(BaseModel):
    reservation_id: str
    room_id: str
    checked_in_at: Optional[str] = None


class CheckoutCreate(BaseModel):
    reservation_id: str
    checked_out_at: Optional[str] = None
    final_amount: float = 0.0


class HousekeepingCreate(BaseModel):
    room_id: str
    task_type: str = Field("cleaning", pattern=r"^(cleaning|deep_clean|maintenance|inspection)$")
    assigned_to: Optional[str] = None


class FolioCreate(BaseModel):
    reservation_id: str
    description: str
    amount: float
    charge_type: str = Field("room", pattern=r"^(room|food|minibar|laundry|spa|other)$")


class ChannelMappingCreate(BaseModel):
    channel: str
    room_type_id: str
    external_id: str
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


_quick("/room-types", RoomTypeRepo, RoomTypeCreate)
_quick("/rooms", RoomRepo, RoomCreate)
_quick("/guests", GuestRepo, GuestCreate)
_quick("/reservations", ReservationRepo, ReservationCreate)
_quick("/checkins", CheckinRepo, CheckinCreate)
_quick("/checkouts", CheckoutRepo, CheckoutCreate)
_quick("/housekeeping", HousekeepingRepo, HousekeepingCreate)
_quick("/folios", FolioRepo, FolioCreate)
_quick("/channels", ChannelMappingRepo, ChannelMappingCreate)


@router.post("/reservations/{rid}/checkin")
def checkin(rid: str, body: dict, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    res = _own(ReservationRepo(org), rid, org)
    room_id = body.get("room_id") or res.get("room_id")
    if not room_id:
        raise HTTPException(400, "room_id پێویستە")
    ReservationRepo(org).update(rid, {"status": "checked_in", "room_id": room_id})
    RoomRepo(org).update(room_id, {"status": "occupied"})
    return CheckinRepo(org).create({"reservation_id": rid, "room_id": room_id, "checked_in_at": datetime.utcnow().isoformat()})


@router.post("/reservations/{rid}/checkout")
def checkout(rid: str, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    res = _own(ReservationRepo(org), rid, org)
    folios, _ = FolioRepo(org).list(filters=[{"field": "reservation_id", "op": "==", "value": rid}], limit=1000)
    total = sum(float(f.get("amount", 0)) for f in folios)
    ReservationRepo(org).update(rid, {"status": "checked_out", "final_amount": total})
    if res.get("room_id"):
        RoomRepo(org).update(res["room_id"], {"status": "cleaning"})
    return CheckoutRepo(org).create({"reservation_id": rid, "checked_out_at": datetime.utcnow().isoformat(), "final_amount": total})


@router.get("/availability")
def availability(start: str, end: str, user: dict = Depends(get_current_user)):
    org = user["org_id"]
    rooms, _ = RoomRepo(org).list(limit=10000)
    res, _ = ReservationRepo(org).list(limit=10000)
    busy_room_ids = {r.get("room_id") for r in res if r.get("room_id") and r.get("status") not in ("cancelled", "checked_out")
                     and (r.get("check_in_date") or "") <= end and (r.get("check_out_date") or "") >= start}
    free = [r for r in rooms if r.get("id") not in busy_room_ids and r.get("status") == "available"]
    return {"available": free, "total": len(free)}
