import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.firestore.mileage import MileageLogRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/mileage", tags=["Mileage"])


# ==================== SCHEMAS ====================

class MileageLogCreate(BaseModel):
    date: str
    distance_km: float
    from_location: str
    to_location: str
    purpose: str
    rate_per_km: float = 0.0
    vehicle: Optional[str] = None
    notes: Optional[str] = None
    status: str = "draft"  # draft, submitted, approved


class MileageLogUpdate(BaseModel):
    date: Optional[str] = None
    distance_km: Optional[float] = None
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    purpose: Optional[str] = None
    rate_per_km: Optional[float] = None
    vehicle: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


# ==================== ENDPOINTS ====================

@router.get("")
def list_mileage_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """List all mileage logs"""
    repo = MileageLogRepository(user["org_id"])
    
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    
    items, total = repo.list(
        filters=filters,
        order_by="date",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("", status_code=201)
def create_mileage_log(
    data: MileageLogCreate,
    user: dict = Depends(get_current_user),
):
    """Create a new mileage log"""
    repo = MileageLogRepository(user["org_id"])
    
    # Calculate total amount
    total_amount = data.distance_km * data.rate_per_km
    
    log_id = str(uuid.uuid4())
    log_data = {
        "id": log_id,
        "org_id": user["org_id"],
        "date": data.date,
        "distance_km": data.distance_km,
        "from_location": data.from_location,
        "to_location": data.to_location,
        "purpose": data.purpose,
        "rate_per_km": data.rate_per_km,
        "total_amount": total_amount,
        "vehicle": data.vehicle or "",
        "notes": data.notes or "",
        "status": data.status,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "created_by_id": user["id"]
    }
    
    log = repo.create(log_data)
    return log


@router.get("/{log_id}")
def get_mileage_log(log_id: str, user: dict = Depends(get_current_user)):
    """Get a single mileage log"""
    repo = MileageLogRepository(user["org_id"])
    log = repo.get(log_id)
    if not log or log.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تۆمارەکە نەدۆزرایەوە")
    return log


@router.put("/{log_id}")
def update_mileage_log(
    log_id: str,
    data: MileageLogUpdate,
    user: dict = Depends(get_current_user)
):
    """Update a mileage log"""
    repo = MileageLogRepository(user["org_id"])
    log = repo.get(log_id)
    if not log or log.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تۆمارەکە نەدۆزرایەوە")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Recalculate total if distance or rate changed
    if "distance_km" in update_data or "rate_per_km" in update_data:
        distance = update_data.get("distance_km", log.get("distance_km", 0))
        rate = update_data.get("rate_per_km", log.get("rate_per_km", 0))
        update_data["total_amount"] = distance * rate
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    updated = repo.update(log_id, update_data)
    return updated


@router.delete("/{log_id}")
def delete_mileage_log(log_id: str, user: dict = Depends(get_current_user)):
    """Delete a mileage log"""
    repo = MileageLogRepository(user["org_id"])
    log = repo.get(log_id)
    if not log or log.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تۆمارەکە نەدۆزرایەوە")
    
    repo.delete(log_id)
    return {"message": "تۆماری سەفەر سڕایەوە", "success": True}


@router.post("/{log_id}/submit")
def submit_mileage_log(log_id: str, user: dict = Depends(get_current_user)):
    """Submit mileage log for approval"""
    repo = MileageLogRepository(user["org_id"])
    log = repo.get(log_id)
    if not log or log.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تۆمارەکە نەدۆزرایەوە")
    
    if log.get("status") != "draft":
        raise HTTPException(status_code=400, detail="تەنها تۆماری ڕەشنووس دەتوانرێت بنێردرێت")
    
    updated = repo.update(log_id, {
        "status": "submitted",
        "submitted_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    })
    
    return {"message": "تۆماری سەفەر بۆ پەسەندکردن نێردرا", "log": updated}
