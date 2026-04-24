"""Sprint 28: Iraq payment gateway repositories."""
from app.firestore.base import BaseRepository


class IraqPaymentRepository(BaseRepository):
    collection_name = "iraq_payments"


class IraqGatewayConfigRepository(BaseRepository):
    collection_name = "iraq_gateway_configs"
