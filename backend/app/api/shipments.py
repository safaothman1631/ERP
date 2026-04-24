import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.system import ShipmentRepository, DeliveryChallanRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/shipments", tags=["Shipments"])

@router.get("")
def list_shipments(page: int = Query(1), page_size: int = Query(20, le=500), 
                   status: str = None, user: dict = Depends(get_current_user)):
    repo = ShipmentRepository(user["org_id"])
    filters = []
    if status: filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters, order_by="ship_date", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.post("", status_code=201)
def create_shipment(data: dict, user: dict = Depends(get_current_user)):
    repo = ShipmentRepository(user["org_id"])
    shipment = repo.create({
        "id": str(uuid.uuid4()),
        "invoice_id": data.get("invoice_id"),
        "sales_order_id": data.get("sales_order_id"),
        "contact_id": data.get("contact_id"),
        "shipment_number": data.get("shipment_number", ""),
        "ship_date": data.get("ship_date"),
        "carrier": data.get("carrier", ""),
        "tracking_number": data.get("tracking_number", ""),
        "shipping_charge": data.get("shipping_charge", 0),
        "status": "pending",
        "notes": data.get("notes", ""),
    })
    if data.get("packages"):
        repo.set_lines(shipment["id"], data["packages"], "packages")
    return shipment

@router.get("/{shipment_id}")
def get_shipment(shipment_id: str, user: dict = Depends(get_current_user)):
    repo = ShipmentRepository(user["org_id"])
    s = repo.get_with_packages(shipment_id)
    if not s: raise HTTPException(404, "Shipment not found")
    return s

@router.put("/{shipment_id}")
def update_shipment(shipment_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = ShipmentRepository(user["org_id"])
    if not repo.get(shipment_id): raise HTTPException(404)
    return repo.update(shipment_id, data)

@router.post("/{shipment_id}/deliver")
def mark_delivered(shipment_id: str, user: dict = Depends(get_current_user)):
    repo = ShipmentRepository(user["org_id"])
    s = repo.get(shipment_id)
    if not s: raise HTTPException(404)
    return repo.update(shipment_id, {"status": "delivered", "delivery_date": datetime.utcnow()})

@router.delete("/{shipment_id}")
def delete_shipment(shipment_id: str, user: dict = Depends(get_current_user)):
    repo = ShipmentRepository(user["org_id"])
    if not repo.get(shipment_id): raise HTTPException(404)
    repo.delete(shipment_id)
    return {"message": "Deleted", "success": True}

# ===== DELIVERY CHALLANS =====
challans_router = APIRouter(prefix="/api/challans", tags=["Delivery Challans"])

@challans_router.get("")
def list_challans(page: int = Query(1), page_size: int = Query(20, le=500),
                  user: dict = Depends(get_current_user)):
    repo = DeliveryChallanRepository(user["org_id"])
    items, total = repo.list(order_by="date", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@challans_router.post("", status_code=201)
def create_challan(data: dict, user: dict = Depends(get_current_user)):
    repo = DeliveryChallanRepository(user["org_id"])
    challan = repo.create({
        "id": str(uuid.uuid4()),
        "contact_id": data.get("contact_id"),
        "challan_number": data.get("challan_number", ""),
        "date": data.get("date"),
        "status": "draft",
        "notes": data.get("notes", ""),
    })
    if data.get("lines"):
        repo.set_lines(challan["id"], data["lines"])
    return challan

@challans_router.get("/{challan_id}")
def get_challan(challan_id: str, user: dict = Depends(get_current_user)):
    repo = DeliveryChallanRepository(user["org_id"])
    c = repo.get_with_lines(challan_id)
    if not c: raise HTTPException(404)
    return c

@challans_router.put("/{challan_id}")
def update_challan(challan_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = DeliveryChallanRepository(user["org_id"])
    if not repo.get(challan_id): raise HTTPException(404)
    return repo.update(challan_id, data)

@challans_router.delete("/{challan_id}")
def delete_challan(challan_id: str, user: dict = Depends(get_current_user)):
    repo = DeliveryChallanRepository(user["org_id"])
    if not repo.get(challan_id): raise HTTPException(404)
    repo.delete(challan_id)
    return {"success": True}
