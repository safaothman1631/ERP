"""Sprint 15: Universal Followers + Activities (FIX-186..195).

Allows attaching followers (notification subscribers) and activities (todos)
to ANY entity in the system (invoice, lead, opportunity, employee, etc.).
"""
from app.firestore.base import BaseRepository


class FollowerRepository(BaseRepository):
    """Universal followers attached to any entity_type+entity_id."""
    collection_name = "followers"


class UniversalActivityRepository(BaseRepository):
    """Universal activities (call, meeting, email, todo) on any entity."""
    collection_name = "universal_activities"


class ChatterMessageRepository(BaseRepository):
    """Thread messages / log notes on any entity."""
    collection_name = "chatter_messages"
