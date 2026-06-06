"""Transportation Management API (Pool 3.5 buildout).

Thin CRUD + stateless calculators on top of the validated pure engine
``app.services.tms_rating`` (``rate_freight``, ``optimize_route``). Additive and
isolated — no existing behavior is touched.

Endpoints:
    GET    /api/tms/carriers                 list carriers
    POST   /api/tms/carriers                 create carrier
    GET    /api/tms/carriers/{id}            carrier detail
    PUT    /api/tms/carriers/{id}            update carrier
    DELETE /api/tms/carriers/{id}            delete carrier
    GET    /api/tms/shipments                list shipments
    POST   /api/tms/shipments                create shipment
    GET    /api/tms/shipments/{id}           shipment detail
    PUT    /api/tms/shipments/{id}           update shipment
    DELETE /api/tms/shipments/{id}           delete shipment
    POST   /api/tms/freight-quote            rate a freight leg (stateless)
    POST   /api/tms/optimize-route           order stops nearest-neighbour (stateless)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from app.firestore.tms import CarrierRepository, ShipmentRepository
from app.services.auth import get_current_user
from app.services.tms_rating import optimize_route, rate_freight

router = APIRouter(prefix="/api/tms", tags=["TMS"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─────────────────────────── Carriers CRUD ────────────────────────────

@router.get("/carriers")
def list_carriers(
    limit: int = Query(200, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    items, _ = CarrierRepository(user["org_id"]).list(
        order_by="name", order_dir="ASCENDING", limit=limit
    )
    return items


@router.post("/carriers", status_code=201)
def create_carrier(data: dict, user: dict = Depends(get_current_user)):
    if not data.get("name"):
        raise HTTPException(400, "name required")
    repo = CarrierRepository(user["org_id"])
    payload = {
        "id": str(uuid.uuid4()),
        "name": data["name"],
        "code": data.get("code", ""),
        "contact_name": data.get("contact_name", ""),
        "phone": data.get("phone", ""),
        "email": data.get("email", ""),
        "service_modes": data.get("service_modes", []),
        "rate_card": data.get("rate_card") or {},
        "is_active": True,
        "created_at": _now_iso(),
        "created_by": user.get("id") or user.get("email"),
    }
    return repo.create(payload)


@router.get("/carriers/{carrier_id}")
def get_carrier(carrier_id: str, user: dict = Depends(get_current_user)):
    item = CarrierRepository(user["org_id"]).get(carrier_id)
    if not item:
        raise HTTPException(404, "Carrier not found")
    return item


@router.put("/carriers/{carrier_id}")
def update_carrier(carrier_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = CarrierRepository(user["org_id"])
    if not repo.get(carrier_id):
        raise HTTPException(404, "Carrier not found")
    data.pop("id", None)
    data.pop("org_id", None)
    data["updated_at"] = _now_iso()
    return repo.update(carrier_id, data)


@router.delete("/carriers/{carrier_id}")
def delete_carrier(carrier_id: str, user: dict = Depends(get_current_user)):
    repo = CarrierRepository(user["org_id"])
    if not repo.get(carrier_id):
        raise HTTPException(404, "Carrier not found")
    repo.delete(carrier_id)
    return {"success": True}


# ─────────────────────────── Shipments CRUD ────────────────────────────

@router.get("/shipments")
def list_shipments(
    limit: int = Query(200, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    items, _ = ShipmentRepository(user["org_id"]).list(
        order_by="created_at", order_dir="DESCENDING", limit=limit
    )
    return items


@router.post("/shipments", status_code=201)
def create_shipment(data: dict, user: dict = Depends(get_current_user)):
    repo = ShipmentRepository(user["org_id"])
    payload = {
        "id": str(uuid.uuid4()),
        "reference": data.get("reference", ""),
        "carrier_id": data.get("carrier_id", ""),
        "origin": data.get("origin", ""),
        "destination": data.get("destination", ""),
        "weight_kg": float(data.get("weight_kg") or 0),
        "distance_km": float(data.get("distance_km") or 0),
        "zone": data.get("zone", "domestic"),
        "service": data.get("service", "standard"),
        "freight_cost": data.get("freight_cost"),
        "status": data.get("status", "draft"),
        "stops": data.get("stops", []),
        "created_at": _now_iso(),
        "created_by": user.get("id") or user.get("email"),
    }
    return repo.create(payload)


@router.get("/shipments/{shipment_id}")
def get_shipment(shipment_id: str, user: dict = Depends(get_current_user)):
    item = ShipmentRepository(user["org_id"]).get(shipment_id)
    if not item:
        raise HTTPException(404, "Shipment not found")
    return item


@router.put("/shipments/{shipment_id}")
def update_shipment(shipment_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = ShipmentRepository(user["org_id"])
    if not repo.get(shipment_id):
        raise HTTPException(404, "Shipment not found")
    data.pop("id", None)
    data.pop("org_id", None)
    data["updated_at"] = _now_iso()
    return repo.update(shipment_id, data)


@router.delete("/shipments/{shipment_id}")
def delete_shipment(shipment_id: str, user: dict = Depends(get_current_user)):
    repo = ShipmentRepository(user["org_id"])
    if not repo.get(shipment_id):
        raise HTTPException(404, "Shipment not found")
    repo.delete(shipment_id)
    return {"success": True}


# ─────────────────── Stateless calculators (pure engine) ───────────────────

@router.post("/freight-quote")
def freight_quote(data: dict, user: dict = Depends(get_current_user)):
    """Rate a single freight leg via ``tms_rating.rate_freight``.

    Body: {weight_kg, distance_km, zone?, service?, rate_card?}.
    Returns {cost, breakdown}.
    """
    if data.get("weight_kg") is None or data.get("distance_km") is None:
        raise HTTPException(400, "weight_kg and distance_km required")
    try:
        weight_kg = float(data["weight_kg"])
        distance_km = float(data["distance_km"])
    except (TypeError, ValueError):
        raise HTTPException(400, "weight_kg and distance_km must be numeric")
    rate_card = data.get("rate_card")
    if rate_card is not None and not isinstance(rate_card, dict):
        raise HTTPException(400, "rate_card must be an object")
    return rate_freight(
        weight_kg=weight_kg,
        distance_km=distance_km,
        zone=data.get("zone", "domestic"),
        service=data.get("service", "standard"),
        rate_card=rate_card,
    )


@router.post("/optimize-route")
def optimize_route_endpoint(data: dict, user: dict = Depends(get_current_user)):
    """Order stops with a nearest-neighbour heuristic via ``tms_rating.optimize_route``.

    Body: {start, stops: [str], distances: {"a|b": km, ...}}. ``distances`` is a
    flat map keyed by ``"<a>|<b>"`` (undirected — either order is accepted).
    Returns {order, total}.
    """
    start = data.get("start")
    stops = data.get("stops")
    distances = data.get("distances") or {}
    if not start:
        raise HTTPException(400, "start required")
    if not isinstance(stops, list) or not stops:
        raise HTTPException(400, "stops must be a non-empty list")
    if not isinstance(distances, dict):
        raise HTTPException(400, "distances must be an object")

    def dist(a: str, b: str) -> float:
        v = distances.get(f"{a}|{b}")
        if v is None:
            v = distances.get(f"{b}|{a}")
        try:
            return float(v) if v is not None else 0.0
        except (TypeError, ValueError):
            return 0.0

    order, total = optimize_route(start, [str(s) for s in stops], dist)
    return {"order": order, "total": total}
