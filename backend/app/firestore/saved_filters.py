# Firestore repository for saved filters
from app.firestore.base import BaseRepository


class SavedFilterRepository(BaseRepository):
    """Repository for user-saved table filters and column configurations"""
    collection_name = "saved_filters"

    def get_user_filters(self, user_id: str, page_key: str):
        """Get all saved filters for a user on a specific page"""
        filters = {"org_id": self.org_id, "user_id": user_id, "page_key": page_key}
        items, _ = self.list(filters=filters, order_by="created_at", order_dir="DESCENDING", limit=100)
        return items

    def get_default_filter(self, user_id: str, page_key: str):
        """Get the default filter for a user on a specific page"""
        filters = {"org_id": self.org_id, "user_id": user_id, "page_key": page_key, "is_default": True}
        items, _ = self.list(filters=filters, limit=1)
        return items[0] if items else None

    def set_default(self, filter_id: str, user_id: str, page_key: str):
        """Set a filter as default (clears other defaults for same user/page)"""
        # Clear existing defaults
        existing = self.get_user_filters(user_id, page_key)
        for item in existing:
            if item.get("is_default") and item["id"] != filter_id:
                self.update(item["id"], {"is_default": False})
        # Set new default
        self.update(filter_id, {"is_default": True})
