# User repository
from .base import BaseRepository
from .encrypted_mixin import EncryptedFieldsMixin
from app.cache import cache


class UserRepository(EncryptedFieldsMixin, BaseRepository):
    """Repository for users"""
    collection_name = "users"
    _ENCRYPTED_FIELDS = ("email", "phone", "mobile", "totp_secret", "backup_codes")

    def find_by_email(self, email, *, org_id: str | None = None):
        """Find user by email. When org_id is set, scope to tenant (preferred for in-org lookup)."""
        query = self.collection.where("email", "==", email)
        if org_id is not None:
            query = query.where("org_id", "==", org_id)
        elif self.org_id:
            query = query.where("org_id", "==", self.org_id)
        for doc in query.limit(1).stream():
            return self._decrypt_doc({"id": doc.id, **doc.to_dict()})
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
