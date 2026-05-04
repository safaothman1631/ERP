# Firestore repository for custom reports
from app.firestore.base import BaseRepository


class CustomReportRepository(BaseRepository):
    """Repository for user-defined custom reports"""
    collection_name = "custom_reports"

    def get_user_reports(self, user_id: str):
        """Get all custom reports created by a user"""
        filters = {"org_id": self.org_id, "created_by": user_id}
        items, _ = self.list(filters=filters, order_by="created_at", order_dir="DESCENDING", limit=200)
        return items

    def get_by_source(self, source: str):
        """Get all custom reports for a specific data source"""
        filters = {"org_id": self.org_id, "source": source}
        items, _ = self.list(filters=filters, order_by="created_at", limit=100)
        return items
