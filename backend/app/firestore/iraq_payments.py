"""Sprint 28: Iraq payment gateway repositories."""
from app.firestore.base import BaseRepository
from app.firestore.encrypted_mixin import EncryptedFieldsMixin


class IraqPaymentRepository(BaseRepository):
    collection_name = "iraq_payments"


class IraqGatewayConfigRepository(EncryptedFieldsMixin, BaseRepository):
    collection_name = "iraq_gateway_configs"
    _ENCRYPTED_FIELDS = ("api_key",)
