# Fixed asset repositories
from .base import BaseRepository

class FixedAssetRepository(BaseRepository):
    """Repository for fixed assets"""
    collection_name = "fixed_assets"
    
    def get_with_entries(self, doc_id):
        """Get fixed asset with depreciation entries"""
        a = self.get(doc_id)
        if a:
            a["depreciation_entries"] = self.get_lines(doc_id, "depreciation_entries")
        return a
