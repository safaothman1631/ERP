# Mileage tracking repository
from .base import BaseRepository


class MileageLogRepository(BaseRepository):
    """Repository for mileage tracking logs"""
    collection_name = "mileage_logs"
