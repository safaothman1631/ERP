# Organization repository
from .base import BaseRepository
from app.cache import cache

class OrganizationRepository(BaseRepository):
    """Repository for organizations"""
    collection_name = "organizations"
    
    def __init__(self, org_id=None):
        super().__init__(org_id or "system")
    
    def get(self, doc_id):
        """Get organization with caching"""
        cache_key = f"org:{doc_id}"
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        try:
            doc = self.collection.document(doc_id).get()
        except Exception as exc:
            from app.services.firestore_resilience import is_firestore_quota_error
            if is_firestore_quota_error(exc):
                return cache.get(cache_key)
            raise
        if doc.exists:
            data = {"id": doc.id, **doc.to_dict()}
            cache.set(cache_key, data)
            return data
        return None
