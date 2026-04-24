# Expense repositories
from .base import BaseRepository

class ExpenseRepository(BaseRepository):
    """Repository for expenses"""
    collection_name = "expenses"


class ExpenseClaimRepository(BaseRepository):
    """Repository for expense claims"""
    collection_name = "expense_claims"
    
    def get_with_items(self, doc_id):
        """Get expense claim with expense items"""
        claim = self.get(doc_id)
        if claim:
            claim["items"] = self.get_lines(doc_id, "items")
        return claim
