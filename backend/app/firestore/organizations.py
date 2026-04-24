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
        
        doc = self.collection.document(doc_id).get()
        if doc.exists:
            data = {"id": doc.id, **doc.to_dict()}
            cache.set(cache_key, data)
            return data
        return None
