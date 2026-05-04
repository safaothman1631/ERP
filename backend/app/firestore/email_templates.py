# Email Templates Repository
from .base import BaseRepository


class EmailTemplateRepository(BaseRepository):
    """Repository for email templates"""
    collection_name = "email_templates"
    
    def get_by_doc_type(self, doc_type: str):
        """Get all templates for a document type"""
        items, _ = self.list(
            filters=[{"field": "doc_type", "op": "==", "value": doc_type}],
            order_by="created_at",
            order_dir="DESCENDING",
            limit=100
        )
        return items
    
    def get_default_for_doc_type(self, doc_type: str):
        """Get the default template for a document type"""
        items, _ = self.list(
            filters=[
                {"field": "doc_type", "op": "==", "value": doc_type},
                {"field": "is_default", "op": "==", "value": True}
            ],
            limit=1
        )
        return items[0] if items else None
