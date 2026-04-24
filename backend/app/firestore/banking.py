# Banking repositories
from .base import BaseRepository

class BankAccountRepository(BaseRepository):
    """Repository for bank accounts"""
    collection_name = "bank_accounts"


class BankTransactionRepository(BaseRepository):
    """Repository for bank transactions"""
    collection_name = "bank_transactions"


class BankRuleRepository(BaseRepository):
    """Repository for banking rules"""
    collection_name = "bank_rules"


class BankReconciliationRepository(BaseRepository):
    """Repository for bank reconciliations"""
    collection_name = "bank_reconciliations"
