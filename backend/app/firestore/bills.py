# Bill and purchase document repositories
from .base import BaseRepository

class BillRepository(BaseRepository):
    """Repository for bills"""
    collection_name = "bills"
    
    def get_with_lines(self, doc_id):
        """Get bill with line items"""
        b = self.get(doc_id)
        if b:
            b["lines"] = self.get_lines(doc_id)
        return b


class PurchaseOrderRepository(BaseRepository):
    """Repository for purchase orders"""
    collection_name = "purchase_orders"
    
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
    """Repository for payment made records"""
    collection_name = "payments_made"


# Add record_payment helper to BillRepository for AP closure
def _record_bill_payment(self, doc_id, amount):
    """Record payment against a bill: reduce balance_due + flip status."""
    bill = self.get(doc_id)
    if not bill:
        return None
    current_balance = float(bill.get("balance_due", bill.get("total", 0)) or 0)
    new_balance = current_balance - float(amount or 0)
    if new_balance <= 0.01:
        new_status = "paid"
        new_balance = 0
    else:
        new_status = "partially_paid"
    return self.update(doc_id, {
        "balance_due": max(0, round(new_balance, 2)),
        "status": new_status,
    })


BillRepository.record_payment = _record_bill_payment


class RecurringBillRepository(BaseRepository):
    """Repository for recurring bills"""
    collection_name = "recurring_bills"
