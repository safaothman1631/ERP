import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.system import WorkflowRepository, ApprovalRequestRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/approvals", tags=["Approvals"])

@router.get("/workflows")
def list_workflows(user: dict = Depends(get_current_user)):
    repo = WorkflowRepository(user["org_id"])
    items, _ = repo.list(limit=100)
    return items

@router.post("/workflows", status_code=201)
def create_workflow(data: dict, user: dict = Depends(get_current_user)):
    repo = WorkflowRepository(user["org_id"])
    return repo.create({
        "id": str(uuid.uuid4()),
        "name": data["name"],
        "entity_type": data["entity_type"],
        "conditions": data.get("conditions", []),
        "approvers": data["approvers"],
        "is_active": True,
    })

@router.put("/workflows/{wf_id}")
def update_workflow(wf_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = WorkflowRepository(user["org_id"])
    if not repo.get(wf_id): raise HTTPException(404)
    return repo.update(wf_id, data)

@router.delete("/workflows/{wf_id}")
def delete_workflow(wf_id: str, user: dict = Depends(get_current_user)):
    repo = WorkflowRepository(user["org_id"])
    repo.update(wf_id, {"is_active": False})
    return {"success": True}

# === APPROVAL REQUESTS ===
@router.get("/requests")
def list_requests(status: str = None, page: int = Query(1), page_size: int = Query(20, le=500),
                  user: dict = Depends(get_current_user)):
    repo = ApprovalRequestRepository(user["org_id"])
    filters = []
    if status: filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters, order_by="created_at", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.post("/requests", status_code=201)
def create_request(data: dict, user: dict = Depends(get_current_user)):
    repo = ApprovalRequestRepository(user["org_id"])
    return repo.create({
        "id": str(uuid.uuid4()),
        "entity_type": data["entity_type"],
        "entity_id": data["entity_id"],
        "workflow_id": data.get("workflow_id"),
        "requester_id": user["id"],
        "approver_ids": data.get("approver_ids", []),
        "status": "pending",
        "notes": data.get("notes", ""),
    })

@router.post("/requests/{req_id}/approve")
def approve_request(req_id: str, data: dict = {}, user: dict = Depends(get_current_user)):
    repo = ApprovalRequestRepository(user["org_id"])
    req = repo.get(req_id)
    if not req: raise HTTPException(404)
    if user["id"] not in req.get("approver_ids", []):
        raise HTTPException(403, "Not authorized to approve")
    return repo.update(req_id, {
        "status": "approved",
        "approved_by": user["id"],
        "approved_at": datetime.utcnow(),
        "approval_notes": data.get("notes", ""),
    })

@router.post("/requests/{req_id}/reject")
def reject_request(req_id: str, data: dict = {}, user: dict = Depends(get_current_user)):
    repo = ApprovalRequestRepository(user["org_id"])
    req = repo.get(req_id)
    if not req: raise HTTPException(404)
    return repo.update(req_id, {
        "status": "rejected",
        "rejected_by": user["id"],
        "rejected_at": datetime.utcnow(),
        "rejection_reason": data.get("reason", ""),
    })
