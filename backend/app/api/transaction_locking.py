"""API endpoints for transaction locking (lock periods to prevent edits)"""
import uuid
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from app.firebase_client import get_db
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/transaction-locking", tags=["Transaction Locking"])


@router.get("")
def get_lock_settings(user: dict = Depends(get_current_user)):
    """Get current transaction lock date settings for the organization"""
    db = get_db()
    doc = db.collection("transaction_locks").document(user["org_id"]).get()
    
    if doc.exists:
        return {"id": doc.id, **doc.to_dict()}
    
    # Return default (no lock)
    return {
        "org_id": user["org_id"],
        "lock_date": None,
        "locked_by": None,
        "locked_at": None,
        "reason": "",
    }


@router.post("")
def set_lock_date(data: dict, user: dict = Depends(get_current_user)):
    """Set or update the transaction lock date"""
    db = get_db()
    
    lock_date_str = data.get("lock_date")
    if not lock_date_str:
        raise HTTPException(status_code=400, detail="بەرواری قوفڵکردن پێویستە")
    
    # Parse lock_date
    try:
        if isinstance(lock_date_str, str):
            lock_date = datetime.fromisoformat(lock_date_str.replace("Z", ""))
        else:
            lock_date = lock_date_str
    except Exception:
        raise HTTPException(status_code=400, detail="فۆرماتی بەروار هەڵەیە")
    
    lock_data = {
        "org_id": user["org_id"],
        "lock_date": lock_date,
        "locked_by": user["id"],
        "locked_by_name": user.get("full_name", user.get("email", "")),
        "locked_at": datetime.utcnow(),
        "reason": data.get("reason", ""),
    }
    
    db.collection("transaction_locks").document(user["org_id"]).set(lock_data)
    
    return {**lock_data, "id": user["org_id"]}


@router.get("/check/{transaction_date}")
def check_if_locked(transaction_date: str, user: dict = Depends(get_current_user)):
    """Check if a specific date is locked"""
    db = get_db()
    doc = db.collection("transaction_locks").document(user["org_id"]).get()
    
    if not doc.exists:
        return {"is_locked": False, "lock_date": None}
    
    lock_data = doc.to_dict()
    lock_date = lock_data.get("lock_date")
    
    if not lock_date:
        return {"is_locked": False, "lock_date": None}
    
    # Parse transaction_date
    try:
        if isinstance(transaction_date, str):
            trans_date = datetime.fromisoformat(transaction_date.replace("Z", ""))
        else:
            trans_date = transaction_date
    except Exception:
        raise HTTPException(status_code=400, detail="فۆرماتی بەروار هەڵەیە")
    
    # Convert lock_date to datetime if needed
    if isinstance(lock_date, str):
        lock_date = datetime.fromisoformat(lock_date.replace("Z", ""))
    
    # Normalize both to naive datetimes for comparison
    if hasattr(lock_date, 'tzinfo') and lock_date.tzinfo is not None:
        lock_date = lock_date.replace(tzinfo=None)
    if hasattr(trans_date, 'tzinfo') and trans_date.tzinfo is not None:
        trans_date = trans_date.replace(tzinfo=None)
    
    is_locked = trans_date <= lock_date
    
    return {
        "is_locked": is_locked,
        "lock_date": str(lock_date)[:10],
        "reason": lock_data.get("reason", ""),
    }


@router.delete("")
def remove_lock(user: dict = Depends(get_current_user)):
    """Remove transaction lock"""
    db = get_db()
    db.collection("transaction_locks").document(user["org_id"]).delete()
    return {"success": True, "message": "قوفڵکردن لابرا"}
