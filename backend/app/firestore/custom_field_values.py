"""Firestore repository for Custom Field Values"""
from app.firestore.base import BaseRepository


class CustomFieldValueRepository(BaseRepository):
    """Repository for custom field values on transactions"""
    collection_name = "custom_field_values"
