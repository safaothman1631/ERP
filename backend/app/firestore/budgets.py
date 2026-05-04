# Budget Management Repository
from .base import BaseRepository


class BudgetRepository(BaseRepository):
    """Repository for budgets"""
    collection_name = "budgets"


class BudgetLineRepository(BaseRepository):
    """Repository for budget lines"""
    collection_name = "budget_lines"
    
    def get_by_budget(self, budget_id: str):
        """Get all budget lines for a budget"""
        items, _ = self.list(
            filters=[{"field": "budget_id", "op": "==", "value": budget_id}],
            limit=500
        )
        return items
    
    def get_for_period(self, budget_id: str, period_year: int, period_month: int):
        """Get budget lines for a specific period"""
        items, _ = self.list(
            filters=[
                {"field": "budget_id", "op": "==", "value": budget_id},
                {"field": "period_year", "op": "==", "value": period_year},
                {"field": "period_month", "op": "==", "value": period_month},
            ],
            limit=500
        )
        return items
