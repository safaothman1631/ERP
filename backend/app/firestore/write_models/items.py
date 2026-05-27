from typing import Optional

from pydantic import Field

from ._common import WriteModelBase


class ItemWriteModel(WriteModelBase):
    name: Optional[str] = None
    sku: Optional[str] = None
    type: Optional[str] = None
    sale_price: Optional[float] = Field(default=None, ge=0)
    purchase_price: Optional[float] = Field(default=None, ge=0)
    stock_on_hand: Optional[float] = None
    is_trackable: Optional[bool] = True
    is_active: Optional[bool] = True
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)
