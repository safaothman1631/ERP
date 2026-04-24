# Contact repository
from .base import BaseRepository

class ContactRepository(BaseRepository):
    """Repository for contacts (customers and vendors)"""
    collection_name = "contacts"
    
    def find_by_email(self, email: str):
        """Find contact by email"""
        docs = self.collection.where("org_id", "==", self.org_id) \
            .where("email", "==", email).limit(1).stream()
        for doc in docs:
            return {"id": doc.id, **doc.to_dict()}
        return None
    
    def list_by_type(self, contact_type: str, limit=25, offset=0):
        """List contacts by type (customer/vendor)"""
        return self.list(
            filters=[{"field": "contact_type", "op": "==", "value": contact_type}],
            order_by="display_name",
            order_dir="ASCENDING",
            limit=limit,
            offset=offset
        )
    
    def get_with_details(self, doc_id: str):
        """Get contact with persons and addresses"""
        contact = self.get(doc_id)
        if contact:
            contact["persons"] = self.get_lines(doc_id, "persons")
            contact["addresses"] = self.get_lines(doc_id, "addresses")
        return contact
    
    def get_credit_balance(self, contact_id: str) -> float:
        """Get total available credit for customer"""
        from .invoices import CreditNoteRepository
        cn_repo = CreditNoteRepository(self.org_id)
        items, _ = cn_repo.list(
            filters=[
                {"field": "contact_id", "op": "==", "value": contact_id},
                {"field": "status", "op": "in", "value": ["open"]}
            ]
        )
        return sum(item.get("balance_remaining", 0) for item in items)
