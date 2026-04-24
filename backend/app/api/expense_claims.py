import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.expenses import ExpenseClaimRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/expense-claims", tags=["Expense Claims"])

@router.get("")
def list_claims(page: int = Query(1), page_size: int = Query(20, le=500),
                status: str = None, user: dict = Depends(get_current_user)):
    repo = ExpenseClaimRepository(user["org_id"])
    filters = []
    if status: filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters, order_by="date", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.post("", status_code=201)
def create_claim(data: dict, user: dict = Depends(get_current_user)):
    repo = ExpenseClaimRepository(user["org_id"])
    claim = repo.create({
        "id": str(uuid.uuid4()),
        "employee_id": user["id"],
        "employee_name": user.get("name", ""),
        "claim_number": data.get("claim_number", ""),
        "date": data.get("date", datetime.utcnow().isoformat()),
        "total": data.get("total", 0),
        "status": "draft",
        "notes": data.get("notes", ""),
    })
    if data.get("items"):
        repo.set_lines(claim["id"], data["items"], "items")
    return claim

@router.get("/{claim_id}")
def get_claim(claim_id: str, user: dict = Depends(get_current_user)):
    repo = ExpenseClaimRepository(user["org_id"])
    claim = repo.get_with_items(claim_id)
    if not claim: raise HTTPException(404)
    return claim

@router.put("/{claim_id}")
def update_claim(claim_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = ExpenseClaimRepository(user["org_id"])
    if not repo.get(claim_id): raise HTTPException(404)
    if data.get("items"):
        repo.set_lines(claim_id, data.pop("items"), "items")
    return repo.update(claim_id, data)

@router.post("/{claim_id}/submit")
def submit_claim(claim_id: str, user: dict = Depends(get_current_user)):
    repo = ExpenseClaimRepository(user["org_id"])
    claim = repo.get(claim_id)
    if not claim or claim.get("status") != "draft": raise HTTPException(400, "Cannot submit")
    return repo.update(claim_id, {"status": "submitted", "submitted_at": datetime.utcnow()})

@router.post("/{claim_id}/approve")
def approve_claim(claim_id: str, user: dict = Depends(get_current_user)):
    repo = ExpenseClaimRepository(user["org_id"])
    claim = repo.get(claim_id)
    if not claim or claim.get("status") != "submitted": raise HTTPException(400, "Cannot approve")
    return repo.update(claim_id, {
        "status": "approved",
        "approved_by": user["id"],
        "approved_at": datetime.utcnow(),
    })

@router.post("/{claim_id}/reject")
def reject_claim(claim_id: str, data: dict = {}, user: dict = Depends(get_current_user)):
    repo = ExpenseClaimRepository(user["org_id"])
    claim = repo.get(claim_id)
    if not claim or claim.get("status") != "submitted": raise HTTPException(400, "Cannot reject")
    return repo.update(claim_id, {
        "status": "rejected",
        "rejected_by": user["id"],
        "rejected_at": datetime.utcnow(),
        "rejection_reason": data.get("reason", ""),
    })

@router.delete("/{claim_id}")
def delete_claim(claim_id: str, user: dict = Depends(get_current_user)):
    repo = ExpenseClaimRepository(user["org_id"])
    claim = repo.get(claim_id)
    if claim and claim.get("status") == "draft":
        repo.delete(claim_id)
    return {"success": True}
