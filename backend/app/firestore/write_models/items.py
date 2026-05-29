from typing import Optional

from pydantic import Field

from ._common import WriteModelBase


class ItemWriteModel(WriteModelBase):
    name: Optional[str] = None
    name_ku: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    type: Optional[str] = None
    item_type: Optional[str] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    sale_price: Optional[float] = Field(default=None, ge=0)
    purchase_price: Optional[float] = Field(default=None, ge=0)
    # API uses selling_price / cost_price; keep both shapes so PATCHes from
    # either spelling persist. The repo layer reads whichever is set.
    selling_price: Optional[float] = Field(default=None, ge=0)
    cost_price: Optional[float] = Field(default=None, ge=0)
    stock_on_hand: Optional[float] = None
    reorder_point: Optional[float] = Field(default=None, ge=0)
    is_trackable: Optional[bool] = True
    is_active: Optional[bool] = True
    image_url: Optional[str] = None
    # POS-related — without these, PUT /api/items silently dropped them via
    # `extra=ignore` and the POS Products page never saw the change.
    available_in_pos: Optional[bool] = None
    pos_category_id: Optional[str] = None
    tax_id: Optional[str] = None
    income_account_id: Optional[str] = None
    expense_account_id: Optional[str] = None
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)
