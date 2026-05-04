"""Firestore repository for user dashboards"""
from .base import BaseRepository
from typing import Optional


class DashboardRepository(BaseRepository):
    def __init__(self, org_id: str):
        super().__init__(collection_name="user_dashboards", org_id=org_id)
    
    def get_by_owner(self, owner_user_id: str, limit: int = 50, offset: int = 0):
        """Get dashboards owned by a user"""
        docs = []
        query = self.collection.where("owner_user_id", "==", owner_user_id)
        query = query.order_by("created_at", direction="DESCENDING")
        query = query.limit(limit).offset(offset)
        
        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            docs.append(data)
        
        return docs
    
    def get_shared_with_user(self, user_id: str, limit: int = 50, offset: int = 0):
        """Get dashboards shared with a user"""
        docs = []
        query = self.collection.where("shared_with", "array_contains", user_id)
        query = query.order_by("created_at", direction="DESCENDING")
        query = query.limit(limit).offset(offset)
        
        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            docs.append(data)
        
        return docs
    
    def check_access(self, dashboard_id: str, user_id: str) -> bool:
        """Check if user has access to dashboard (owner or shared)"""
        doc = self.get_by_id(dashboard_id)
        if not doc:
            return False
        
        if doc.get("owner_user_id") == user_id:
            return True
        
        shared_with = doc.get("shared_with", [])
        if user_id in shared_with:
            return True
        
        return False
