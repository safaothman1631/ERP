# Items repository
from .base import BaseRepository

class ItemRepository(BaseRepository):
    """Repository for items (products/services)"""
    collection_name = "items"
    
    def list_by_type(self, item_type: str, limit=25, offset=0):
        """List items by type (product/service)"""
        return self.list(
            filters=[
                {"field": "item_type", "op": "==", "value": item_type},
                {"field": "is_active", "op": "==", "value": True}
            ],
            order_by="name",
            order_dir="ASCENDING",
            limit=limit,
            offset=offset
        )
