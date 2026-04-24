import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.recurring_bills import RecurringBillRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/recurring-bills", tags=["RecurringBills"])

@router.get("")
def list_recurring_bills(page: int = Query(1), page_size: int = Query(20, le=500), user: dict = Depends(get_current_user)):
    """List all recurring bills"""
    repo = RecurringBillRepository(user["org_id"])
    items, total = repo.list(order_by="created_at", order_dir="DESCENDING", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.post("", status_code=201)
def create_recurring_bill(data: dict, user: dict = Depends(get_current_user)):
    """Create new recurring bill"""
    repo = RecurringBillRepository(user["org_id"])
    data["id"] = str(uuid.uuid4())
    data["status"] = data.get("status", "active")
    bill = repo.create(data)
    return bill

@router.get("/{bill_id}")
def get_recurring_bill(bill_id: str, user: dict = Depends(get_current_user)):
    """Get single recurring bill"""
    repo = RecurringBillRepository(user["org_id"])
    bill = repo.get(bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Recurring bill not found")
    return bill

@router.put("/{bill_id}")
def update_recurring_bill(bill_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Update recurring bill"""
    repo = RecurringBillRepository(user["org_id"])
    if not repo.get(bill_id):
        raise HTTPException(status_code=404, detail="Recurring bill not found")
    updated = repo.update(bill_id, data)
    return updated

@router.delete("/{bill_id}")
def delete_recurring_bill(bill_id: str, user: dict = Depends(get_current_user)):
    """Delete recurring bill"""
    repo = RecurringBillRepository(user["org_id"])
    if not repo.get(bill_id):
        raise HTTPException(status_code=404, detail="Recurring bill not found")
    repo.delete(bill_id)
    return {"message": "Recurring bill deleted"}

@router.post("/{bill_id}/activate")
def activate_recurring_bill(bill_id: str, user: dict = Depends(get_current_user)):
    """Activate recurring bill"""
    repo = RecurringBillRepository(user["org_id"])
    bill = repo.get(bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Recurring bill not found")
    repo.update(bill_id, {"status": "active"})
    return {"message": "Recurring bill activated"}

@router.post("/{bill_id}/deactivate")
def deactivate_recurring_bill(bill_id: str, user: dict = Depends(get_current_user)):
    """Deactivate recurring bill"""
    repo = RecurringBillRepository(user["org_id"])
    bill = repo.get(bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Recurring bill not found")
    repo.update(bill_id, {"status": "inactive"})
    return {"message": "Recurring bill deactivated"}
