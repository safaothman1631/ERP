"""Firestore repository for universal activities (Phase 4 G-02)."""
from app.firestore.base import BaseRepository


class ActivityRepository(BaseRepository):
    """Org-scoped activities linked to any entity_type + entity_id."""
    collection_name = "activities"
