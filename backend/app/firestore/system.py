# System repositories
from .base import BaseRepository
from app.cache import cache

class SettingsRepository(BaseRepository):
    """Repository for system settings"""
    collection_name = "settings"
    
    def get_by_key(self, key, category="general"):
        """Get setting by key with caching"""
        cache_key = f"settings:{self.org_id}:{category}:{key}"
        cached = cache.get_static(cache_key)
        if cached:
            return cached
        
        docs = self.collection.where("org_id", "==", self.org_id) \
            .where("key", "==", key).where("category", "==", category).limit(1).stream()
        
        for doc in docs:
            val = doc.to_dict().get("value")
            cache.set_static(cache_key, val)
            return val
        return None


class CurrencyRepository(BaseRepository):
    """Repository for currencies"""
    collection_name = "currencies"


class ExchangeRateRepository(BaseRepository):
    """Repository for exchange rates"""
    collection_name = "exchange_rates"


class SequenceRepository(BaseRepository):
    """Repository for number sequences"""
    collection_name = "sequences"

    def get_next(self, entity_type):
        """Get next sequential number for entity type.

        Uses a Firestore transaction so that concurrent callers cannot read the
        same value before the increment is applied (gap-less, no duplicates).
        """
        from google.cloud import firestore as fs

        doc_id = f"{self.org_id}_{entity_type}"
        doc_ref = self.db.collection("sequences").document(doc_id)
        org_id = self.org_id

        @fs.transactional
        def _allocate(transaction):
            snapshot = doc_ref.get(transaction=transaction)
            if snapshot.exists:
                data = snapshot.to_dict()
                next_num = int(data.get("next_number", 1))
                prefix = data.get("prefix", entity_type.upper()[:3] + "-")
                padding = int(data.get("padding", 6))
                transaction.update(doc_ref, {"next_number": next_num + 1})
            else:
                next_num = 1
                prefix = entity_type.upper()[:3] + "-"
                padding = 6
                transaction.set(doc_ref, {
                    "org_id": org_id,
                    "entity_type": entity_type,
                    "prefix": prefix,
                    "next_number": 2,
                    "padding": padding,
                })
            return f"{prefix}{str(next_num).zfill(padding)}"

        return _allocate(self.db.transaction())


class ActivityLogRepository(BaseRepository):
    """Repository for activity logs"""
    collection_name = "activity_log"


class AuditLogRepository(BaseRepository):
    """Repository for audit logs"""
    collection_name = "audit_logs"


class AttachmentRepository(BaseRepository):
    """Repository for file attachments"""
    collection_name = "attachments"


class EmailLogRepository(BaseRepository):
    """Repository for email logs"""
    collection_name = "email_logs"


class InvoiceTemplateRepository(BaseRepository):
    """Repository for invoice templates"""
    collection_name = "invoice_templates"


class ReminderSettingsRepository(BaseRepository):
    """Repository for reminder settings"""
    collection_name = "reminder_settings"


class CustomFieldDefinitionRepository(BaseRepository):
    """Repository for custom field definitions"""
    collection_name = "custom_field_definitions"


class WorkflowRepository(BaseRepository):
    """Repository for workflows"""
    collection_name = "workflows"


class ApprovalRequestRepository(BaseRepository):
    """Repository for approval requests"""
    collection_name = "approval_requests"


class PortalTokenRepository(BaseRepository):
    """Repository for customer/vendor portal tokens"""
    collection_name = "portal_tokens"


class BranchRepository(BaseRepository):
    """Repository for organization branches"""
    collection_name = "branches"


class ShipmentRepository(BaseRepository):
    """Repository for shipments"""
    collection_name = "shipments"
    
    def get_with_packages(self, doc_id):
        """Get shipment with package details"""
        s = self.get(doc_id)
        if s:
            s["packages"] = self.get_lines(doc_id, "packages")
        return s


class DeliveryChallanRepository(BaseRepository):
    """Repository for delivery challans"""
    collection_name = "delivery_challans"
    
    def get_with_lines(self, doc_id):
        """Get delivery challan with line items"""
        d = self.get(doc_id)
        if d:
            d["lines"] = self.get_lines(doc_id)
        return d


class SalesReturnRepository(BaseRepository):
    """Repository for sales returns"""
    collection_name = "sales_returns"
    
    def get_with_lines(self, doc_id):
        """Get sales return with line items"""
        r = self.get(doc_id)
        if r:
            r["lines"] = self.get_lines(doc_id)
        return r


class PurchaseReturnRepository(BaseRepository):
    """Repository for purchase returns"""
    collection_name = "purchase_returns"
    
    def get_with_lines(self, doc_id):
        """Get purchase return with line items"""
        r = self.get(doc_id)
        if r:
            r["lines"] = self.get_lines(doc_id)
        return r


class PaymentLinkRepository(BaseRepository):
    """Repository for payment links"""
    collection_name = "payment_links"


class CounterRepository:
    """Counter document for dashboard statistics"""
    
    def __init__(self, org_id):
        self.org_id = org_id
        from app.firebase_client import get_db
        self.db = get_db()
        self.doc_ref = self.db.collection("counters").document(org_id)
    
    def get_all(self):
        """Get all counter values"""
        doc = self.doc_ref.get()
        return doc.to_dict() if doc.exists else {}
    
    def increment(self, field, value=1):
        """Atomically increment a counter"""
        from google.cloud import firestore as fs
        self.doc_ref.update({field: fs.Increment(value)})
    
    def set_value(self, field, value):
        """Set a counter value"""
        self.doc_ref.set({field: value}, merge=True)
