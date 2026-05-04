# Wave P: Approval Workflow Engine API
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel, Field
from app.firestore.approvals import ApprovalRuleRepository, ApprovalRequestRepository
from app.services.auth import get_current_user
from app.services import approval_service


router = APIRouter(prefix="/api/approvals", tags=["Approvals"])


# === SCHEMAS ===
class ApprovalCondition(BaseModel):
    field: str  # total_amount, currency, category, branch_id
    operator: str  # gt, gte, lt, lte, eq, in
    value: float | str | list


class ApprovalStep(BaseModel):
    step: int
    approver_type: str  # user, role, manager_of_creator
    approver_id: Optional[str] = None
    role_id: Optional[str] = None
    required_count: int = 1
    can_delegate: bool = False


class ApprovalRuleCreate(BaseModel):
    name: str
    doc_type: str  # purchase_order, expense_claim, sales_order, bill, credit_note, invoice
    condition: Optional[ApprovalCondition] = None
    steps: list[ApprovalStep]
    active: bool = True
    priority: int = 0


class ApprovalActionBody(BaseModel):
    comments: Optional[str] = None


class ApprovalDelegateBody(BaseModel):
    delegate_to: str
    comments: Optional[str] = None


# === APPROVAL RULES ===
@router.get("/approval-rules")
def list_approval_rules(user: dict = Depends(get_current_user)):
    """List all approval rules"""
    repo = ApprovalRuleRepository(user["org_id"])
    items, total = repo.list(limit=100, order_by="priority", order_dir="DESCENDING")
    return {"items": items, "total": total}


@router.post("/approval-rules", status_code=201)
def create_approval_rule(data: ApprovalRuleCreate, user: dict = Depends(get_current_user)):
    """Create a new approval rule"""
    repo = ApprovalRuleRepository(user["org_id"])
    
    rule = repo.create({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "name": data.name,
        "doc_type": data.doc_type,
        "condition": data.condition.model_dump() if data.condition else None,
        "steps": [s.model_dump() for s in data.steps],
        "active": data.active,
        "priority": data.priority,
        "created_at": datetime.utcnow().isoformat(),
        "created_by": user["id"]
    })
    return rule


@router.get("/approval-rules/{rule_id}")
def get_approval_rule(rule_id: str, user: dict = Depends(get_current_user)):
    """Get a specific approval rule"""
    repo = ApprovalRuleRepository(user["org_id"])
    rule = repo.get(rule_id)
    if not rule:
        raise HTTPException(404, "Approval rule not found")
    return rule


@router.put("/approval-rules/{rule_id}")
def update_approval_rule(rule_id: str, data: ApprovalRuleCreate, user: dict = Depends(get_current_user)):
    """Update an approval rule"""
    repo = ApprovalRuleRepository(user["org_id"])
    rule = repo.get(rule_id)
    if not rule:
        raise HTTPException(404, "Approval rule not found")
    
    updated = repo.update(rule_id, {
        "name": data.name,
        "doc_type": data.doc_type,
        "condition": data.condition.model_dump() if data.condition else None,
        "steps": [s.model_dump() for s in data.steps],
        "active": data.active,
        "priority": data.priority,
        "updated_at": datetime.utcnow().isoformat(),
        "updated_by": user["id"]
    })
    return updated


@router.delete("/approval-rules/{rule_id}")
def delete_approval_rule(rule_id: str, user: dict = Depends(get_current_user)):
    """Delete (deactivate) an approval rule"""
    repo = ApprovalRuleRepository(user["org_id"])
    rule = repo.get(rule_id)
    if not rule:
        raise HTTPException(404, "Approval rule not found")
    
    repo.update(rule_id, {"active": False, "deleted_at": datetime.utcnow().isoformat()})
    return {"success": True}


@router.post("/approval-rules/{rule_id}/toggle")
def toggle_approval_rule(rule_id: str, user: dict = Depends(get_current_user)):
    """Toggle active status of an approval rule"""
    repo = ApprovalRuleRepository(user["org_id"])
    rule = repo.toggle_active(rule_id)
    if not rule:
        raise HTTPException(404, "Approval rule not found")
    return rule


# === APPROVAL REQUESTS ===
@router.get("/approval-requests")
def list_approval_requests(
    status: Optional[str] = Query(None),
    my_pending: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    user: dict = Depends(get_current_user)
):
    """List approval requests with optional filters"""
    repo = ApprovalRequestRepository(user["org_id"])
    
    if my_pending:
        # Get only requests where current user is the approver
        items = repo.get_pending_for_user(user["id"], limit=page_size)
        return {"items": items, "total": len(items), "page": 1, "page_size": page_size}
    
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    
    items, total = repo.list(
        filters=filters,
        order_by="created_at",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/approval-requests/inbox")
def get_approval_inbox(
    count_only: bool = Query(False),
    user: dict = Depends(get_current_user)
):
    """Get current user's approval inbox (pending items where they are approver)"""
    repo = ApprovalRequestRepository(user["org_id"])
    items = repo.get_pending_for_user(user["id"])
    
    if count_only:
        return {"count": len(items)}
    
    return {"items": items, "count": len(items)}


@router.get("/approval-requests/{request_id}")
def get_approval_request(request_id: str, user: dict = Depends(get_current_user)):
    """Get a specific approval request"""
    repo = ApprovalRequestRepository(user["org_id"])
    request = repo.get(request_id)
    if not request:
        raise HTTPException(404, "Approval request not found")
    return request


@router.post("/approval-requests/{request_id}/approve")
def approve_request(
    request_id: str,
    data: ApprovalActionBody,
    user: dict = Depends(get_current_user)
):
    """Approve an approval request"""
    try:
        request = approval_service.act_on_approval(
            org_id=user["org_id"],
            request_id=request_id,
            user_id=user["id"],
            action="approve",
            comments=data.comments
        )
        return request
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/approval-requests/{request_id}/reject")
def reject_request(
    request_id: str,
    data: ApprovalActionBody,
    user: dict = Depends(get_current_user)
):
    """Reject an approval request"""
    try:
        request = approval_service.act_on_approval(
            org_id=user["org_id"],
            request_id=request_id,
            user_id=user["id"],
            action="reject",
            comments=data.comments
        )
        return request
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/approval-requests/{request_id}/delegate")
def delegate_request(
    request_id: str,
    data: ApprovalDelegateBody,
    user: dict = Depends(get_current_user)
):
    """Delegate an approval request to another user"""
    try:
        request = approval_service.act_on_approval(
            org_id=user["org_id"],
            request_id=request_id,
            user_id=user["id"],
            action="delegate",
            comments=data.comments,
            delegate_to_user_id=data.delegate_to
        )
        return request
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/approval-requests/{request_id}/cancel")
def cancel_request(
    request_id: str,
    user: dict = Depends(get_current_user)
):
    """Cancel an approval request (only by requester)"""
    try:
        request = approval_service.cancel_approval_request(
            org_id=user["org_id"],
            request_id=request_id,
            user_id=user["id"]
        )
        return request
    except ValueError as e:
        raise HTTPException(400, str(e))
