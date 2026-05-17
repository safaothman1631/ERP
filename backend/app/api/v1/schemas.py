"""
Pydantic v2 schemas for /api/v1/ common request/response models.

داواکاری ٧.١٢: Pydantic v2 validation بۆ هەموو request/response schemas
"""

from __future__ import annotations

from typing import Any, Dict, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field, model_validator

T = TypeVar("T")


# ─────────────────────────────────────────────────────────────────────────────
# Cursor-based pagination response (داواکاری ٧.٥)
# ─────────────────────────────────────────────────────────────────────────────

class CursorPageResponse(BaseModel, Generic[T]):
    """Standard cursor-based paginated list response for /api/v1/ endpoints.

    Design spec format:
    {
        "items": [...],
        "next_cursor": "abc123",
        "has_more": true,
        "total": 450
    }
    """

    items: List[T] = Field(description="لیستی ئایتەمەکان لە ئەم پەیجەدا")
    next_cursor: Optional[str] = Field(
        default=None,
        description="Cursor بۆ پەیجی دواتر. None بێت ئەگەر پەیجی دواتر نەبێت.",
    )
    has_more: bool = Field(description="ئایا ئایتەمی زیاتر هەیە؟")
    total: Optional[int] = Field(
        default=None,
        description="ژمارەی گشتی ئایتەمەکان (ئەگەر بەردەست بوو)",
    )

    model_config = {"arbitrary_types_allowed": True}


# ─────────────────────────────────────────────────────────────────────────────
# Legacy offset-based pagination (backwards compatibility)
# ─────────────────────────────────────────────────────────────────────────────

class PageResponse(BaseModel, Generic[T]):
    """Offset-based paginated list response (backwards compatible)."""

    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = {"arbitrary_types_allowed": True}


# ─────────────────────────────────────────────────────────────────────────────
# RFC 7807 Problem Details (داواکاری ٧.٩)
# ─────────────────────────────────────────────────────────────────────────────

class ProblemDetail(BaseModel):
    """RFC 7807 Problem Details response schema.

    Reference: https://www.rfc-editor.org/rfc/rfc7807
    """

    type: str = Field(
        description="URI reference identifying the problem type",
        examples=["https://erp.example.com/errors/not-found"],
    )
    title: str = Field(
        description="Short, human-readable summary of the problem type",
        examples=["Resource Not Found"],
    )
    status: int = Field(
        description="HTTP status code",
        examples=[404],
    )
    detail: str = Field(
        description="Human-readable explanation specific to this occurrence",
        examples=["Invoice INV-001 was not found"],
    )
    instance: Optional[str] = Field(
        default=None,
        description="URI reference identifying the specific occurrence",
        examples=["/api/v1/invoices/INV-001"],
    )
    errors: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Field-level validation errors (for 422 responses)",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "type": "https://erp.example.com/errors/validation-error",
                "title": "Validation Error",
                "status": 422,
                "detail": "Invoice total does not match line items",
                "instance": "/api/v1/invoices/INV-001",
            }
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# Common response schemas
# ─────────────────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    """Simple success/message response."""

    message: str
    success: bool = True


class IDResponse(BaseModel):
    """Response containing a created/updated resource ID."""

    id: str
    message: str = "سەرکەوتوو بوو"


# ─────────────────────────────────────────────────────────────────────────────
# Sorting and filtering query schemas
# ─────────────────────────────────────────────────────────────────────────────

class SortOrder(BaseModel):
    """Sort order specification."""

    field: str = Field(max_length=100, description="خانەی ڕیزکردن")
    direction: str = Field(
        default="desc",
        pattern="^(asc|desc)$",
        description="ئاراستەی ڕیزکردن: asc یان desc",
    )


class FilterSpec(BaseModel):
    """Single filter specification."""

    field: str = Field(max_length=100)
    op: str = Field(
        pattern="^(==|!=|>|>=|<|<=|in|not-in|array_contains)$",
        description="عملیاتی فلتەر",
    )
    value: Any = Field(description="بەهای فلتەر")

    @model_validator(mode="after")
    def validate_in_value(self) -> "FilterSpec":
        """Ensure 'in' and 'not-in' operators have list values."""
        if self.op in ("in", "not-in") and not isinstance(self.value, list):
            raise ValueError(f"Operator '{self.op}' requires a list value")
        return self
