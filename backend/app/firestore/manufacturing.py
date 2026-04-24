"""Manufacturing repositories: BOM, work orders, manufacturing orders."""
from app.firestore.base import BaseRepository


class BOMRepository(BaseRepository):
    collection_name = "bom"


class ManufacturingOrderRepository(BaseRepository):
    collection_name = "manufacturing_orders"


class WorkOrderRepository(BaseRepository):
    collection_name = "work_orders"


class WorkCenterRepository(BaseRepository):
    collection_name = "work_centers"
