# Approval workflow service
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
from app.firestore.approvals import ApprovalRuleRepository, ApprovalRequestRepository
from app.firestore.users import UserRepository


def _evaluate_condition(doc: dict, condition: dict) -> bool:
    """Evaluate a single condition against a document"""
    field = condition.get("field")
    operator = condition.get("operator")
    value = condition.get("value")
    
    doc_value = doc.get(field)
    
    if operator == "gt":
        return float(doc_value or 0) > float(value)
    elif operator == "gte":
        return float(doc_value or 0) >= float(value)
    elif operator == "lt":
        return float(doc_value or 0) < float(value)
    elif operator == "lte":
        return float(doc_value or 0) <= float(value)
    elif operator == "eq":
        return doc_value == value
    elif operator == "in":
        return doc_value in (value if isinstance(value, list) else [value])
    
    return False


def find_matching_rule(org_id: str, doc_type: str, doc: dict) -> Optional[dict]:
    """Find the first matching approval rule for a document (highest priority wins)
    
    Args:
        org_id: Organization ID
        doc_type: Document type (purchase_order, expense_claim, etc.)
        doc: Document data to evaluate
        
    Returns:
        Matching rule or None if no rule applies
    """
    rule_repo = ApprovalRuleRepository(org_id)
    rules = rule_repo.get_active_rules(doc_type)
    
    for rule in rules:
        condition = rule.get("condition")
        if not condition:
            # No condition = always matches
            return rule
        
        if _evaluate_condition(doc, condition):
            return rule
    
    return None


def _resolve_approver(org_id: str, step_def: dict, requested_by: str) -> Optional[str]:
    """Resolve approver_id based on approver_type
    
    Args:
        org_id: Organization ID
        step_def: Step definition from rule
        requested_by: User ID who requested approval
        
    Returns:
        User ID of the approver, or None if cannot resolve
    """
    approver_type = step_def.get("approver_type")
    
    if approver_type == "user":
        return step_def.get("approver_id")
    
    elif approver_type == "role":
        # For simplicity, return first user with this role
        # In production, you'd want more sophisticated logic
        return step_def.get("approver_id")  # Assume admin pre-fills this
    
    elif approver_type == "manager_of_creator":
        user_repo = UserRepository(org_id)
        user = user_repo.get(requested_by)
        if user:
            return user.get("manager_id")
    
    return None


def create_approval_request(
    org_id: str,
    doc_type: str,
    doc_id: str,
    doc: dict,
    requested_by: str
) -> Optional[dict]:
    """Create an approval request if a matching rule is found
    
    Args:
        org_id: Organization ID
        doc_type: Document type
        doc_id: Document ID
        doc: Document data (for condition evaluation and summary)
        requested_by: User ID requesting approval
        
    Returns:
        Created approval request or None if no rule matches
    """
    rule = find_matching_rule(org_id, doc_type, doc)
    if not rule:
        return None
    
    # Build step instances from rule steps
    step_defs = rule.get("steps", [])
    steps = []
    for step_def in step_defs:
        approver_id = _resolve_approver(org_id, step_def, requested_by)
        if not approver_id:
            # Skip steps that can't be resolved (or fail?)
            continue
        
        steps.append({
            "step": step_def.get("step", len(steps) + 1),
            "approver_id": approver_id,
            "approver_type": step_def.get("approver_type"),
            "role_id": step_def.get("role_id"),
            "required_count": step_def.get("required_count", 1),
            "can_delegate": step_def.get("can_delegate", False),
            "status": "pending",
            "acted_at": None,
            "acted_by": None,
            "comments": None,
            "delegated_to": None
        })
    
    if not steps:
        return None
    
    # Build document summary
    doc_summary = {
        "number": doc.get("order_number") or doc.get("claim_number") or doc.get("bill_number") or doc_id[:8],
        "total": doc.get("total", 0),
        "currency": doc.get("currency_code") or doc.get("currency", "IQD"),
        "contact_name": doc.get("contact_name") or doc.get("vendor_name") or doc.get("customer_name") or ""
    }
    
    request_repo = ApprovalRequestRepository(org_id)
    request = request_repo.create({
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "doc_type": doc_type,
        "doc_id": doc_id,
        "doc_summary": doc_summary,
        "requested_by": requested_by,
        "current_step": 1,
        "total_steps": len(steps),
        "status": "pending",
        "steps": steps,
        "rule_id": rule.get("id"),
        "created_at": datetime.utcnow().isoformat(),
        "completed_at": None
    })
    
    return request


def act_on_approval(
    org_id: str,
    request_id: str,
    user_id: str,
    action: str,  # 'approve', 'reject', 'delegate'
    comments: Optional[str] = None,
    delegate_to_user_id: Optional[str] = None
) -> dict:
    """Process an approval action
    
    Args:
        org_id: Organization ID
        request_id: Approval request ID
        user_id: User performing the action
        action: 'approve', 'reject', or 'delegate'
        comments: Optional comments
        delegate_to_user_id: Required if action is 'delegate'
        
    Returns:
        Updated approval request
        
    Raises:
        ValueError: If user not authorized or invalid action
    """
    request_repo = ApprovalRequestRepository(org_id)
    request = request_repo.get(request_id)
    
    if not request:
        raise ValueError("Approval request not found")
    
    if request.get("status") != "pending":
        raise ValueError(f"Cannot act on request with status {request.get('status')}")
    
    current_step_num = request.get("current_step", 1)
    steps = request.get("steps", [])
    
    # Find current step
    current_step = None
    step_index = None
    for i, step in enumerate(steps):
        if step.get("step") == current_step_num:
            current_step = step
            step_index = i
            break
    
    if not current_step:
        raise ValueError("Current step not found")
    
    # Validate user is authorized for this step
    approver_id = current_step.get("approver_id")
    delegated_to = current_step.get("delegated_to")
    
    if user_id != approver_id and user_id != delegated_to:
        raise ValueError("User not authorized to act on this step")
    
    # Process action
    now = datetime.utcnow().isoformat()
    
    if action == "approve":
        steps[step_index]["status"] = "approved"
        steps[step_index]["acted_at"] = now
        steps[step_index]["acted_by"] = user_id
        steps[step_index]["comments"] = comments
        
        # Check if this was the last step
        if current_step_num >= request.get("total_steps", 1):
            # All steps complete
            return request_repo.update(request_id, {
                "steps": steps,
                "status": "approved",
                "completed_at": now
            })
        else:
            # Advance to next step
            return request_repo.update(request_id, {
                "steps": steps,
                "current_step": current_step_num + 1
            })
    
    elif action == "reject":
        steps[step_index]["status"] = "rejected"
        steps[step_index]["acted_at"] = now
        steps[step_index]["acted_by"] = user_id
        steps[step_index]["comments"] = comments
        
        return request_repo.update(request_id, {
            "steps": steps,
            "status": "rejected",
            "completed_at": now
        })
    
    elif action == "delegate":
        if not current_step.get("can_delegate"):
            raise ValueError("This step cannot be delegated")
        if not delegate_to_user_id:
            raise ValueError("delegate_to_user_id is required")
        
        steps[step_index]["delegated_to"] = delegate_to_user_id
        steps[step_index]["comments"] = comments
        
        return request_repo.update(request_id, {
            "steps": steps
        })
    
    else:
        raise ValueError(f"Invalid action: {action}")


def is_doc_approved(org_id: str, doc_type: str, doc_id: str) -> bool:
    """Check if a document is approved or does not require approval
    
    Args:
        org_id: Organization ID
        doc_type: Document type
        doc_id: Document ID
        
    Returns:
        True if no approval rule exists OR approval request is approved
    """
    request_repo = ApprovalRequestRepository(org_id)
    request = request_repo.get_by_doc(doc_type, doc_id)
    
    if not request:
        # No approval request = no rule matched = approved by default
        return True
    
    return request.get("status") == "approved"


def cancel_approval_request(org_id: str, request_id: str, user_id: str) -> dict:
    """Cancel an approval request (only by requester)
    
    Args:
        org_id: Organization ID
        request_id: Approval request ID
        user_id: User attempting to cancel
        
    Returns:
        Updated approval request
        
    Raises:
        ValueError: If not authorized or invalid state
    """
    request_repo = ApprovalRequestRepository(org_id)
    request = request_repo.get(request_id)
    
    if not request:
        raise ValueError("Approval request not found")
    
    if request.get("requested_by") != user_id:
        raise ValueError("Only the requester can cancel")
    
    if request.get("status") != "pending":
        raise ValueError(f"Cannot cancel request with status {request.get('status')}")
    
    return request_repo.update(request_id, {
        "status": "cancelled",
        "completed_at": datetime.utcnow().isoformat()
    })
