# Expense repositories
from .base import BaseRepository
from .write_models import ExpenseWriteModel


class ExpenseRepository(BaseRepository):
    """Repository for expenses"""
    collection_name = "expenses"
    WRITE_MODEL = ExpenseWriteModel


class ExpenseClaimRepository(BaseRepository):
    """Repository for expense claims"""
    collection_name = "expense_claims"
    
    def get_with_items(self, doc_id):
        """Get expense claim with expense items"""
        claim = self.get(doc_id)
        if claim:
            claim["items"] = self.get_lines(doc_id, "items")
        return claim
