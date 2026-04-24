# Recurring bills repository
from .base import BaseRepository

class RecurringBillRepository(BaseRepository):
    """Repository for recurring bills"""
    collection_name = "recurring_bills"
