"""Fallback validation for repos without a dedicated WRITE_MODEL (Wave V6)."""
from typing import Optional

from pydantic import Field

from ._common import WriteModelBase


class GenericWriteModel(WriteModelBase):
    """Permissive model: validates numeric bounds on common ERP fields."""

    name: Optional[str] = Field(default=None, max_length=500)
    display_name: Optional[str] = Field(default=None, max_length=500)
    status: Optional[str] = Field(default=None, max_length=64)
    total: Optional[float] = Field(default=None, ge=0)
    amount: Optional[float] = Field(default=None)
    balance_due: Optional[float] = Field(default=None, ge=0)
    quantity: Optional[float] = Field(default=None)
    unit_price: Optional[float] = Field(default=None, ge=0)
    discount_percent: Optional[float] = Field(default=None, ge=0, le=100)
    notes: Optional[str] = Field(default=None, max_length=4000)
    description: Optional[str] = Field(default=None, max_length=4000)
    reference: Optional[str] = Field(default=None, max_length=256)
    currency_code: Optional[str] = Field(default=None, min_length=3, max_length=3)
