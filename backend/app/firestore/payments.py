# Payment repositories
from .base import BaseRepository

class PaymentReceivedRepository(BaseRepository):
    """Repository for payments received from customers"""
    collection_name = "payments_received"


class PaymentMadeRepository(BaseRepository):
    """Repository for payments made to vendors"""
    collection_name = "payments_made"
