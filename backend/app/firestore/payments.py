# Payment repositories
from .base import BaseRepository
from .write_models import PaymentMadeWriteModel, PaymentReceivedWriteModel


class PaymentReceivedRepository(BaseRepository):
    """Repository for payments received from customers"""
    collection_name = "payments_received"
    WRITE_MODEL = PaymentReceivedWriteModel


class PaymentMadeRepository(BaseRepository):
    """Repository for payments made to vendors"""
    collection_name = "payments_made"
    WRITE_MODEL = PaymentMadeWriteModel
