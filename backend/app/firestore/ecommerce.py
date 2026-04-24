"""Sprint 24: E-commerce repositories."""
from app.firestore.base import BaseRepository


class EcomItemRepository(BaseRepository):
    collection_name = "ecom_products"


class EcomCartRepository(BaseRepository):
    collection_name = "ecom_carts"


class EcomOrderRepository(BaseRepository):
    collection_name = "ecom_orders"
