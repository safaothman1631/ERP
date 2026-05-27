# Invoice and sales document repositories
from .base import BaseRepository
from .write_models import (
    InvoiceWriteModel,
    PaymentReceivedWriteModel,
    QuoteWriteModel,
    SalesOrderWriteModel,
)
from datetime import datetime

class InvoiceRepository(BaseRepository):
    """Repository for invoices"""
    collection_name = "invoices"
    WRITE_MODEL = InvoiceWriteModel
    SCHEMA_TARGET_VERSION = 2
    
    def list_by_status(self, status, limit=25, offset=0):
        """List invoices by status"""
        filters = [{"field": "status", "op": "==", "value": status}] if status else []
        return self.list(filters=filters, order_by="date", limit=limit, offset=offset)
    
    def list_by_contact(self, contact_id, limit=25, offset=0):
        """List invoices for a specific contact"""
        return self.list(
            filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
            order_by="date",
            limit=limit,
            offset=offset
        )
    
    def list_overdue(self):
        """List overdue invoices"""
        return self.list(
            filters=[
                {"field": "status", "op": "in", "value": ["sent", "partially_paid"]},
                {"field": "due_date", "op": "<", "value": datetime.utcnow()}
            ],
            order_by="due_date",
            order_dir="ASCENDING"
        )
    
    def get_with_lines(self, doc_id):
        """Get invoice with line items"""
        inv = self.get(doc_id)
        if inv:
            inv["lines"] = self.get_lines(doc_id)
        return inv
    
    def update_status(self, doc_id, status):
        """Update invoice status"""
        return self.update(doc_id, {"status": status})
    
    def record_payment(self, doc_id, amount):
        """Record payment against invoice (atomic read-write)."""
        from app.services.invoice_payments import apply_invoice_payment_atomic

        return apply_invoice_payment_atomic(self.org_id, doc_id, float(amount or 0))


class QuoteRepository(BaseRepository):
    """Repository for quotes"""
    collection_name = "quotes"
    WRITE_MODEL = QuoteWriteModel
    
    def get_with_lines(self, doc_id):
        """Get quote with line items"""
        q = self.get(doc_id)
        if q:
            q["lines"] = self.get_lines(doc_id)
        return q


class SalesOrderRepository(BaseRepository):
    """Repository for sales orders"""
    collection_name = "sales_orders"
    WRITE_MODEL = SalesOrderWriteModel
    
    def get_with_lines(self, doc_id):
        """Get sales order with line items"""
        so = self.get(doc_id)
        if so:
            so["lines"] = self.get_lines(doc_id)
        return so


class CreditNoteRepository(BaseRepository):
    """Repository for credit notes"""
    collection_name = "credit_notes"
    
    def get_with_lines(self, doc_id):
        """Get credit note with line items and applications"""
        cn = self.get(doc_id)
        if cn:
            cn["lines"] = self.get_lines(doc_id)
            cn["applications"] = self.get_lines(doc_id, "applications")
        return cn
    
    def apply_to_invoice(self, cn_id, invoice_id, amount):
        """Apply credit note to invoice"""
        from google.cloud import firestore as fs
        batch = self.db.batch()
        
        # Add application record
        app_ref = self.collection.document(cn_id).collection("applications").document()
        batch.set(app_ref, {
            "invoice_id": invoice_id,
            "amount_applied": amount,
            "date": datetime.utcnow(),
            "sort_order": 0
        })
        
        # Update credit note balance
        cn_ref = self.collection.document(cn_id)
        batch.update(cn_ref, {
            "amount_applied": fs.Increment(amount),
            "balance_remaining": fs.Increment(-amount)
        })
        
        # Update invoice balance
        inv_ref = self.db.collection("invoices").document(invoice_id)
        batch.update(inv_ref, {
            "balance_due": fs.Increment(-amount)
        })
        
        batch.commit()
        
        # Clear cache
        from app.cache import cache
        cache.delete(f"credit_notes:{cn_id}")
        cache.delete(f"invoices:{invoice_id}")


class RecurringInvoiceRepository(BaseRepository):
    """Repository for recurring invoices"""
    collection_name = "recurring_invoices"


class PaymentReceivedRepository(BaseRepository):
    """Repository for payment received records"""
    collection_name = "payments_received"
    WRITE_MODEL = PaymentReceivedWriteModel


class RetainerApplicationRepository(BaseRepository):
    """Repository for retainer applications"""
    collection_name = "retainer_applications"
