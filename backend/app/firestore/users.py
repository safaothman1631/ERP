# User repository
from .base import BaseRepository
from app.cache import cache

class UserRepository(BaseRepository):
    """Repository for users"""
    collection_name = "users"
    
    def find_by_email(self, email):
        """Find user by email address"""
        docs = self.collection.where("email", "==", email).limit(1).stream()
        for doc in docs:
            return {"id": doc.id, **doc.to_dict()}
        return None
    
    def get_cached(self, user_id):
        """Get user with caching"""
        cache_key = f"user:{user_id}"
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        user = self.get(user_id)
        if user:
            cache.set(cache_key, user)
        return user
