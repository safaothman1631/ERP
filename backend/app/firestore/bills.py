# Bill and purchase document repositories
from .base import BaseRepository
from .write_models import BillWriteModel, PurchaseOrderWriteModel
from .write_models.transactions import PaymentMadeWriteModel

class BillRepository(BaseRepository):
    """Repository for bills"""
    collection_name = "bills"
    WRITE_MODEL = BillWriteModel
    SCHEMA_TARGET_VERSION = 2
    
    def get_with_lines(self, doc_id):
        """Get bill with line items"""
        b = self.get(doc_id)
        if b:
            b["lines"] = self.get_lines(doc_id)
        return b


class PurchaseOrderRepository(BaseRepository):
    """Repository for purchase orders"""
    collection_name = "purchase_orders"
    WRITE_MODEL = PurchaseOrderWriteModel
    
    def get_with_lines(self, doc_id):
        """Get purchase order with line items"""
        po = self.get(doc_id)
        if po:
            po["lines"] = self.get_lines(doc_id)
        return po


class VendorCreditRepository(BaseRepository):
    """Repository for vendor credits"""
    collection_name = "vendor_credits"
    
    def get_with_lines(self, doc_id):
        """Get vendor credit with line items"""
        vc = self.get(doc_id)
        if vc:
            vc["lines"] = self.get_lines(doc_id)
        return vc


class PaymentMadeRepository(BaseRepository):
    WRITE_MODEL = PaymentMadeWriteModel
    """Repository for payment made records"""
    collection_name = "payments_made"


def _record_bill_payment(self, doc_id, amount):
    """Record payment against a bill (atomic read-write)."""
    from app.services.bill_payments import apply_bill_payment_atomic

    return apply_bill_payment_atomic(self.org_id, doc_id, float(amount or 0))


BillRepository.record_payment = _record_bill_payment


class RecurringBillRepository(BaseRepository):
    """Repository for recurring bills"""
    collection_name = "recurring_bills"
