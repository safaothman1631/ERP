# Chart of accounts repository
from .base import BaseRepository
from .write_models import AccountWriteModel

class AccountRepository(BaseRepository):
    """Repository for chart of accounts"""
    collection_name = "accounts"
    WRITE_MODEL = AccountWriteModel
    
    def list_tree(self):
        """Get all accounts in tree order (by code)"""
        items, total = self.list(
            order_by="code",
            order_dir="ASCENDING",
            limit=500
        )
        return items
    
    def get_balance(self, doc_id):
        """Get account balance"""
        acc = self.get(doc_id)
        return acc.get("balance", 0) if acc else 0
