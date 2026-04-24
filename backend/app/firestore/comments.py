"""Firestore repository for Comments"""
from app.firestore.base import BaseRepository


class CommentRepository(BaseRepository):
    """Repository for transaction comments"""
    collection_name = "comments"
