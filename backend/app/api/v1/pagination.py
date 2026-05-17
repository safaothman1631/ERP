"""
Cursor-based pagination utilities for /api/v1/ endpoints.

داواکاری ٧.٥: cursor-based pagination بۆ هەموو لیستەکان

Usage example:
    from app.api.v1.pagination import CursorPage, PaginationParams, paginate_list

    @router.get("/api/v1/invoices", response_model=CursorPage[InvoiceResponse])
    def list_invoices(params: PaginationParams = Depends()):
        items, total = repo.list(limit=params.limit + 1, start_after=params.cursor)
        return paginate_list(items, params)
"""

from __future__ import annotations

import base64
import json
from typing import Generic, List, Optional, TypeVar

from fastapi import Query
from pydantic import BaseModel, Field

T = TypeVar("T")


# ─────────────────────────────────────────────────────────────────────────────
# Cursor encoding / decoding
# ─────────────────────────────────────────────────────────────────────────────

def encode_cursor(doc_id: str, sort_value: str | None = None) -> str:
    """Encode a document ID (and optional sort value) into an opaque cursor string."""
    payload = {"id": doc_id}
    if sort_value is not None:
        payload["sv"] = sort_value
    raw = json.dumps(payload, separators=(",", ":"))
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> dict:
    """Decode a cursor string back to its payload dict.

    Returns empty dict on any decode error (treats invalid cursor as no cursor).
    """
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        return json.loads(raw)
    except Exception:
        return {}


# ─────────────────────────────────────────────────────────────────────────────
# Pagination query parameters
# ─────────────────────────────────────────────────────────────────────────────

class PaginationParams:
    """Dependency-injectable pagination parameters for cursor-based pagination.

    Usage:
        @router.get("/api/v1/items")
        def list_items(params: PaginationParams = Depends()):
            ...
    """

    def __init__(
        self,
        limit: int = Query(
            default=20,
            ge=1,
            le=500,
            description="تعداد ئایتەمەکان لە هەر پەیجێکدا (1-500)",
        ),
        cursor: Optional[str] = Query(
            default=None,
            description="Cursor بۆ پەیجی دواتر (لە response ی پێشوو وەردەگیرێت)",
        ),
    ):
        self.limit = limit
        self.cursor = cursor
        self.cursor_payload = decode_cursor(cursor) if cursor else {}

    @property
    def doc_id_after(self) -> Optional[str]:
        """Document ID to start after (for Firestore start_after)."""
        return self.cursor_payload.get("id")


# ─────────────────────────────────────────────────────────────────────────────
# Response models
# ─────────────────────────────────────────────────────────────────────────────

class CursorPage(BaseModel, Generic[T]):
    """Standard cursor-based paginated response.

    داواکاری ٧.٥: cursor-based pagination response format
    """

    items: List[T] = Field(description="لیستی ئایتەمەکان")
    next_cursor: Optional[str] = Field(
        default=None,
        description="Cursor بۆ پەیجی دواتر — None بێت ئەگەر پەیجی دواتر نەبێت",
    )
    has_more: bool = Field(description="ئایا ئایتەمی زیاتر هەیە؟")
    total: Optional[int] = Field(
        default=None,
        description="ژمارەی گشتی ئایتەمەکان (ئەگەر بەردەست بوو)",
    )

    model_config = {"arbitrary_types_allowed": True}


class LegacyPage(BaseModel, Generic[T]):
    """Offset-based paginated response (backwards-compatible with existing endpoints)."""

    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = {"arbitrary_types_allowed": True}


# ─────────────────────────────────────────────────────────────────────────────
# Pagination helpers
# ─────────────────────────────────────────────────────────────────────────────

def paginate_list(
    items: list,
    params: PaginationParams,
    total: Optional[int] = None,
    id_field: str = "id",
    sort_field: Optional[str] = None,
) -> dict:
    """Build a CursorPage dict from a list of items.

    The caller should fetch `params.limit + 1` items from the repository.
    This function detects whether there are more items and builds the cursor.

    Args:
        items:       Items fetched from the repository (up to limit+1).
        params:      PaginationParams dependency.
        total:       Optional total count (expensive to compute, pass if available).
        id_field:    Field name for the document ID.
        sort_field:  Field used for sorting (included in cursor for stability).

    Returns:
        dict compatible with CursorPage schema.
    """
    has_more = len(items) > params.limit
    page_items = items[: params.limit]

    next_cursor: Optional[str] = None
    if has_more and page_items:
        last = page_items[-1]
        sort_value = str(last.get(sort_field)) if sort_field and last.get(sort_field) is not None else None
        next_cursor = encode_cursor(last[id_field], sort_value)

    return {
        "items": page_items,
        "next_cursor": next_cursor,
        "has_more": has_more,
        "total": total,
    }


def legacy_paginate(
    items: list,
    total: int,
    page: int,
    page_size: int,
) -> dict:
    """Build a LegacyPage dict (offset-based, for backwards compatibility)."""
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }
