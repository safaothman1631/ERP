# Location, Putaway Rule, and Cycle Count repositories
from .base import BaseRepository


class LocationRepository(BaseRepository):
    """Repository for stock locations within warehouses"""
    collection_name = "stock_locations"
    
    def get_by_warehouse(self, warehouse_id: str) -> list:
        """Get all locations for a warehouse, return tree structure"""
        items, _ = self.list(
            filters=[{"field": "warehouse_id", "op": "==", "value": warehouse_id}],
            limit=1000
        )
        return items
    
    def get_by_barcode(self, barcode: str) -> dict | None:
        """Find location by barcode"""
        items, _ = self.list(
            filters=[{"field": "barcode", "op": "==", "value": barcode}],
            limit=1
        )
        return items[0] if items else None


class PutawayRuleRepository(BaseRepository):
    """Repository for putaway rules (suggest target location for incoming stock)"""
    collection_name = "putaway_rules"
    
    def find_best_location(self, item_id: str, warehouse_id: str, category_id: str | None = None) -> dict | None:
        """Find best matching rule by priority for an item or its category"""
        # Get all rules for this warehouse
        rules, _ = self.list(
            filters=[
                {"field": "warehouse_id", "op": "==", "value": warehouse_id},
                {"field": "active", "op": "==", "value": True},
            ],
            limit=500
        )
        
        # Filter by item_id or category_id, then sort by priority (lower = higher)
        matches = []
        for rule in rules:
            if rule.get("item_id") == item_id:
                matches.append((1, rule))  # exact item match = highest priority type
            elif category_id and rule.get("category_id") == category_id:
                matches.append((2, rule))  # category match
            elif not rule.get("item_id") and not rule.get("category_id"):
                matches.append((3, rule))  # fallback rule
        
        if not matches:
            return None
        
        # Sort by (match_type, priority)
        matches.sort(key=lambda x: (x[0], x[1].get("priority", 999)))
        return matches[0][1]


class CycleCountRepository(BaseRepository):
    """Repository for cycle counts"""
    collection_name = "cycle_counts"
    
    def get_with_lines(self, doc_id: str) -> dict | None:
        """Get cycle count with lines"""
        cc = self.get(doc_id)
        if cc:
            lines_repo = CycleCountLineRepository(self.org_id)
            lines, _ = lines_repo.list(
                filters=[{"field": "count_id", "op": "==", "value": doc_id}],
                limit=1000
            )
            cc["lines"] = lines
        return cc


class CycleCountLineRepository(BaseRepository):
    """Repository for cycle count lines"""
    collection_name = "cycle_count_lines"
