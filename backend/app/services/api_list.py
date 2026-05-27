"""Shared list helper for legacy page APIs + Firestore cursor mode."""
from __future__ import annotations

from typing import Any


def api_list(
    repo: Any,
    *,
    page: int = 1,
    page_size: int = 20,
    cursor: str | None = None,
    filters: list[dict] | None = None,
    order_by: str = "created_at",
    order_dir: str = "DESCENDING",
) -> tuple[list[dict], int, str | None]:
    """Return (items, total, next_cursor). Uses server-side query when enabled."""
    from app.config import get_settings

    filters = filters or []
    settings = get_settings()

    if settings.USE_FIRESTORE_QUERY:
        cursor_id = cursor
        if not cursor_id and page > 1:
            items, total = repo.list(
                filters=filters,
                order_by=order_by,
                order_dir=order_dir,
                limit=page_size,
                offset=(page - 1) * page_size,
            )
            return items, total, None
        page_result = repo.list_page(
            filters=filters,
            order_by=order_by,
            order_dir=order_dir,
            limit=page_size,
            cursor_id=cursor_id,
        )
        total = len(page_result.items) + (1 if page_result.has_more else 0)
        return page_result.items, total, page_result.next_cursor

    items, total = repo.list(
        filters=filters,
        order_by=order_by,
        order_dir=order_dir,
        limit=page_size,
        offset=(page - 1) * page_size,
    )
    return items, total, None
