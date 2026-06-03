"""WMS warehouse repositories (Pool 3.5 buildout).

Persistence layer on top of the pure ``app.services.wms_allocation`` engine.

Collections (both org-scoped via :class:`BaseRepository`):
    ``wms_bins``       — storage locations: ``{bin_id, zone, capacity, load, item_id?}``
    ``wms_bin_stock``  — per-bin stock lots: ``{bin_id, item_id, qty, received_at, seq?}``
"""
from app.firestore.base import BaseRepository


class BinRepository(BaseRepository):
    """Repository for warehouse storage bins/locations."""
    collection_name = "wms_bins"


class BinStockRepository(BaseRepository):
    """Repository for per-bin stock lots (one doc per item lot in a bin)."""
    collection_name = "wms_bin_stock"
