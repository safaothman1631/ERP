# Inventory repositories
from .base import BaseRepository
from .write_models import StockMovementWriteModel, StockTransferWriteModel

class ItemRepository(BaseRepository):
    """Repository for inventory items"""
    collection_name = "items"
    
    def list_low_stock(self):
        """List items with low stock"""
        return self.list(
            filters=[
                {"field": "is_trackable", "op": "==", "value": True}
            ],
            order_by="stock_on_hand",
            order_dir="ASCENDING",
            limit=100
        )


class ItemGroupRepository(BaseRepository):
    """Repository for item groups"""
    collection_name = "item_groups"


class WarehouseRepository(BaseRepository):
    """Repository for warehouses"""
    collection_name = "warehouses"


class WarehouseStockRepository(BaseRepository):
    """Repository for warehouse stock levels"""
    collection_name = "warehouse_stock"


class StockTransferRepository(BaseRepository):
    """Repository for stock transfers"""
    collection_name = "stock_transfers"
    WRITE_MODEL = StockTransferWriteModel
    
    def get_with_lines(self, doc_id):
        """Get stock transfer with line items"""
        t = self.get(doc_id)
        if t:
            t["lines"] = self.get_lines(doc_id)
        return t


class InventoryAdjustmentRepository(BaseRepository):
    """Repository for inventory adjustments"""
    collection_name = "inventory_adjustments"
    
    def get_with_lines(self, doc_id):
        """Get inventory adjustment with line items"""
        a = self.get(doc_id)
        if a:
            a["lines"] = self.get_lines(doc_id)
        return a


class PriceListRepository(BaseRepository):
    """Repository for price lists"""
    collection_name = "price_lists"
    
    def get_with_items(self, doc_id):
        """Get price list with item prices"""
        pl = self.get(doc_id)
        if pl:
            pl["items"] = self.get_lines(doc_id, "items")
        return pl


class SerialNumberRepository(BaseRepository):
    """Repository for serial numbers"""
    collection_name = "serial_numbers"


class CompositeComponentRepository(BaseRepository):
    """Repository for composite item components"""
    collection_name = "composite_components"


class StockMovementRepository(BaseRepository):
    """Repository for stock movements"""
    collection_name = "stock_movements"
    WRITE_MODEL = StockMovementWriteModel


class BatchRepository(BaseRepository):
    """Repository for batch/lot tracking"""
    collection_name = "batches"


class LandedCostRepository(BaseRepository):
    """Repository for landed costs"""
    collection_name = "landed_costs"

