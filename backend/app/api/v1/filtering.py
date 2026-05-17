"""
Filtering and sorting utilities for /api/v1/ endpoints.

داواکاری ٧.٦: filtering و sorting بۆ هەموو لیستەکان

Usage example:
    from app.api.v1.filtering import FilterParams, SortParams, build_filters

    @router.get("/api/v1/invoices")
    def list_invoices(
        filters: FilterParams = Depends(),
        sort: SortParams = Depends(),
    ):
        repo_filters = build_filters(filters.to_list())
        items, total = repo.list(
            filters=repo_filters,
            order_by=sort.order_by,
            order_dir=sort.order_dir,
        )
"""

from __future__ import annotations

from typing import Any, List, Optional

from fastapi import Query


# ─────────────────────────────────────────────────────────────────────────────
# Sort parameters
# ─────────────────────────────────────────────────────────────────────────────

class SortParams:
    """Dependency-injectable sort parameters.

    Usage:
        @router.get("/api/v1/items")
        def list_items(sort: SortParams = Depends()):
            items, total = repo.list(
                order_by=sort.order_by,
                order_dir=sort.order_dir,
            )
    """

    ALLOWED_DIRECTIONS = {"asc", "desc", "ascending", "descending"}

    def __init__(
        self,
        sort_by: Optional[str] = Query(
            default=None,
            max_length=100,
            description="خانەی ڕیزکردن (نموونە: created_at، name، status)",
        ),
        sort_dir: str = Query(
            default="desc",
            max_length=20,
            description="ئاراستەی ڕیزکردن: asc یان desc",
        ),
    ):
        self.sort_by = sort_by
        # Normalise to Firestore convention
        _dir = sort_dir.lower().strip()
        if _dir in ("asc", "ascending"):
            self.order_dir = "ASCENDING"
        else:
            self.order_dir = "DESCENDING"

    @property
    def order_by(self) -> Optional[str]:
        return self.sort_by


# ─────────────────────────────────────────────────────────────────────────────
# Generic filter parameters
# ─────────────────────────────────────────────────────────────────────────────

class FilterParams:
    """Generic filter dependency.

    Supports simple equality filters via `filter_{field}={value}` query params.
    For more complex filtering, use resource-specific filter classes.
    """

    def __init__(
        self,
        search: Optional[str] = Query(
            default=None,
            max_length=200,
            description="گەڕانی تێکست (full-text search)",
        ),
        status: Optional[str] = Query(
            default=None,
            max_length=50,
            description="فلتەر بەپێی دۆخ (نموونە: draft، posted، paid)",
        ),
        contact_id: Optional[str] = Query(
            default=None,
            max_length=36,
            description="فلتەر بەپێی ID ی پەیوەندی",
        ),
        date_from: Optional[str] = Query(
            default=None,
            max_length=30,
            description="بەروار لە (ISO 8601: YYYY-MM-DD)",
        ),
        date_to: Optional[str] = Query(
            default=None,
            max_length=30,
            description="بەروار تا (ISO 8601: YYYY-MM-DD)",
        ),
    ):
        self.search = search
        self.status = status
        self.contact_id = contact_id
        self.date_from = date_from
        self.date_to = date_to

    def to_repo_filters(self, date_field: str = "date") -> List[dict]:
        """Convert to repository filter list format."""
        filters: List[dict] = []

        if self.status:
            filters.append({"field": "status", "op": "==", "value": self.status})

        if self.contact_id:
            filters.append({"field": "contact_id", "op": "==", "value": self.contact_id})

        if self.date_from:
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(self.date_from)
                filters.append({"field": date_field, "op": ">=", "value": dt})
            except ValueError:
                pass  # Invalid date — ignore filter

        if self.date_to:
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(self.date_to + "T23:59:59")
                filters.append({"field": date_field, "op": "<=", "value": dt})
            except ValueError:
                pass

        return filters

    def apply_search(self, items: list, fields: List[str]) -> list:
        """Apply in-memory text search across specified fields."""
        if not self.search:
            return items
        term = self.search.lower()
        return [
            item for item in items
            if any(term in str(item.get(f) or "").lower() for f in fields)
        ]


# ─────────────────────────────────────────────────────────────────────────────
# Helper: build filter list from keyword arguments
# ─────────────────────────────────────────────────────────────────────────────

def build_filters(**kwargs: Any) -> List[dict]:
    """Build a repository filter list from keyword arguments.

    Only non-None, non-empty values are included.

    Example:
        filters = build_filters(status="paid", contact_id=contact_id)
    """
    filters: List[dict] = []
    for field, value in kwargs.items():
        if value is not None and value != "":
            filters.append({"field": field, "op": "==", "value": value})
    return filters
