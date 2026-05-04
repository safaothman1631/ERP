# Approval Workflow repositories
from .base import BaseRepository
from typing import Optional, List
from datetime import datetime


class ApprovalRuleRepository(BaseRepository):
    """Repository for configurable approval rules"""
    collection_name = "approval_rules"
    
    def get_active_rules(self, doc_type: str) -> List[dict]:
        """Get all active rules for a document type, sorted by priority descending"""
        all_rules, _ = self.list(filters=[
            {"field": "active", "op": "==", "value": True},
            {"field": "doc_type", "op": "==", "value": doc_type}
        ], limit=100)
        # Sort by priority (highest first)
        return sorted(all_rules, key=lambda r: r.get("priority", 0), reverse=True)
    
    def toggle_active(self, rule_id: str) -> Optional[dict]:
        """Toggle active status of a rule"""
        rule = self.get(rule_id)
        if not rule:
            return None
        return self.update(rule_id, {"active": not rule.get("active", False)})


class ApprovalRequestRepository(BaseRepository):
    """Repository for approval requests"""
    collection_name = "approval_requests"
    
    def get_pending_for_user(self, user_id: str, limit: int = 50) -> List[dict]:
        """Get all approval requests where user is the current step approver"""
        all_requests, _ = self.list(filters=[
            {"field": "status", "op": "==", "value": "pending"}
        ], limit=limit)
        
        # Filter in Python: check if user_id matches current step approver or delegated_to
        result = []
        for req in all_requests:
            current_step = req.get("current_step", 1)
            steps = req.get("steps", [])
            for step in steps:
                if step.get("step") == current_step:
                    approver_id = step.get("approver_id")
                    delegated_to = step.get("delegated_to")
                    if approver_id == user_id or delegated_to == user_id:
                        result.append(req)
                    break
        return result
    
    def get_by_doc(self, doc_type: str, doc_id: str) -> Optional[dict]:
        """Get approval request for a specific document"""
        items, _ = self.list(filters=[
            {"field": "doc_type", "op": "==", "value": doc_type},
            {"field": "doc_id", "op": "==", "value": doc_id}
        ], limit=1)
        return items[0] if items else None
    
    def get_submitted_by_user(self, user_id: str, limit: int = 50) -> List[dict]:
        """Get all requests submitted by a specific user"""
        items, _ = self.list(filters=[
            {"field": "requested_by", "op": "==", "value": user_id}
        ], limit=limit, order_by="created_at")
        return items
