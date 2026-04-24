"""Firestore repository for Reporting Tags"""
from app.firestore.base import BaseRepository


class ReportingTagRepository(BaseRepository):
    """Repository for reporting tags and tag groups"""
    collection_name = "reporting_tags"
