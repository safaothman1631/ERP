# Analytic Accounting Repository
from .base import BaseRepository


class AnalyticAccountRepository(BaseRepository):
    """Repository for analytic accounts (cost centers, projects, departments)"""
    collection_name = "analytic_accounts"
    
    def list_tree(self):
        """Get all analytic accounts in tree order (by code)"""
        items, total = self.list(
            order_by="code",
            order_dir="ASCENDING",
            limit=500
        )
        return items


class AnalyticLineRepository(BaseRepository):
    """Repository for analytic lines (journal entry distribution)"""
    collection_name = "analytic_lines"
    
    def get_by_journal_entry(self, journal_entry_id: str):
        """Get all analytic lines for a journal entry"""
        items, _ = self.list(
            filters=[{"field": "journal_entry_id", "op": "==", "value": journal_entry_id}],
            limit=500
        )
        return items
    
    def get_summary(self, account_id: str, date_from: str | None = None, date_to: str | None = None):
        """Get summary of analytic lines for an account"""
        from datetime import datetime
        
        filters = [{"field": "account_id", "op": "==", "value": account_id}]
        if date_from:
            filters.append({"field": "date", "op": ">=", "value": datetime.fromisoformat(date_from)})
        if date_to:
            filters.append({"field": "date", "op": "<=", "value": datetime.fromisoformat(date_to)})
        
        items, _ = self.list(filters=filters, limit=5000)
        
        total_amount = sum(item.get("amount", 0) for item in items)
        return {
            "account_id": account_id,
            "total_amount": total_amount,
            "line_count": len(items),
            "lines": items
        }
