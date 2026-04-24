# Tax repositories
from .base import BaseRepository

class TaxRateRepository(BaseRepository):
    """Repository for tax rates"""
    collection_name = "tax_rates"


class TaxGroupRepository(BaseRepository):
    """Repository for tax groups"""
    collection_name = "tax_groups"


class TaxReturnRepository(BaseRepository):
    """Repository for tax returns"""
    collection_name = "tax_returns"
