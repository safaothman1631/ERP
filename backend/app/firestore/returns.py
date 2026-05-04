"""Returns and Refund Record repositories"""
from .base import BaseRepository


class RefundRecordRepository(BaseRepository):
    """Repository for refund records"""
    collection_name = "refund_records"

    def list_by_return(self, return_id: str, limit: int = 100):
        """List all refunds for a specific return"""
        items, total = self.list(
            filters=[{"field": "return_id", "op": "==", "value": return_id}],
            order_by="created_at",
            order_dir="DESCENDING",
            limit=limit
        )
        return items, total
