"""Fixed Assets repositories — Asset categories, assets, and depreciation entries."""
from .base import BaseRepository


class AssetCategoryRepository(BaseRepository):
    """Repository for asset categories"""
    collection_name = "asset_categories"

    def get_by_name(self, name: str) -> dict | None:
        """Get category by name"""
        filters = [{"field": "name", "op": "==", "value": name}]
        items, _ = self.list(filters=filters, limit=1)
        return items[0] if items else None


class AssetRepository(BaseRepository):
    """Repository for fixed assets"""
    collection_name = "fixed_assets"

    def get_with_depreciation(self, doc_id: str) -> dict | None:
        """Get asset with depreciation entries subcollection"""
        asset = self.get(doc_id)
        if asset:
            dep_ref = self.collection.document(doc_id).collection("depreciation_entries")
            entries = []
            for d in dep_ref.stream():
                entries.append({"id": d.id, **d.to_dict()})
            asset["depreciation_entries"] = entries
        return asset

    def get_active_for_period(self, period: str) -> list[dict]:
        """Get all active assets that need depreciation for the given period.
        
        period format: 'YYYY-MM' e.g. '2026-05'
        Returns assets where status='active' and (last_depreciated_date is None or < period_start).
        """
        # Firestore filtering: status == 'active'
        # Additional filtering (last_depreciated_date) done in Python
        filters = [{"field": "status", "op": "==", "value": "active"}]
        items, _ = self.list(filters=filters, limit=1000)
        
        # Python filter: last_depreciated_date < period
        period_start = f"{period}-01"
        result = []
        for item in items:
            last = item.get("last_depreciated_date", "")
            if not last or last < period_start:
                result.append(item)
        return result


class DepreciationEntryRepository(BaseRepository):
    """Repository for depreciation entries"""
    collection_name = "depreciation_entries"

    def get_by_asset(self, asset_id: str) -> list[dict]:
        """Get all depreciation entries for an asset"""
        filters = [{"field": "asset_id", "op": "==", "value": asset_id}]
        items, _ = self.list(filters=filters, order_by="period_end_date", order_dir="DESCENDING", limit=500)
        return items

    def get_by_period(self, period: str) -> list[dict]:
        """Get all depreciation entries for a period (YYYY-MM)"""
        filters = [{"field": "period", "op": "==", "value": period}]
        items, _ = self.list(filters=filters, limit=500)
        return items

    def exists_for_asset_period(self, asset_id: str, period: str) -> bool:
        """Check if depreciation entry exists for asset in period"""
        filters = [
            {"field": "asset_id", "op": "==", "value": asset_id},
            {"field": "period", "op": "==", "value": period},
        ]
        items, _ = self.list(filters=filters, limit=1)
        return len(items) > 0
