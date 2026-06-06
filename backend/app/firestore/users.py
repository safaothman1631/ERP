# User repository
from .base import BaseRepository
from .encrypted_mixin import EncryptedFieldsMixin
from app.cache import cache


class UserRepository(EncryptedFieldsMixin, BaseRepository):
    """Repository for users"""
    collection_name = "users"
    # NOTE: ``email`` is intentionally NOT encrypted. Login, registration, the
    # forgot/reset flows and ``find_by_email`` all look users up with a plaintext
    # ``where("email", "==", ...)`` query. Field encryption uses Fernet, which is
    # non-deterministic, so an encrypted ``email`` could never be matched by such
    # a query — every newly-registered user was then unable to log in (the seeded
    # users have plaintext emails, which is why only NEW signups broke). Keep the
    # genuinely sensitive fields encrypted; email stays queryable.
    _ENCRYPTED_FIELDS = ("phone", "mobile", "totp_secret", "backup_codes")

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
