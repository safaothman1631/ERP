from typing import Optional

from pydantic import Field

from ._common import WriteModelBase


class POSOrderWriteModel(WriteModelBase):
    session_id: Optional[str] = None
    status: Optional[str] = None
    total: Optional[float] = Field(default=None, ge=0)
    amount_paid: Optional[float] = Field(default=None, ge=0)
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)


class POSSessionWriteModel(WriteModelBase):
    config_id: Optional[str] = None
    status: Optional[str] = None
    opened_at: Optional[str] = None
    closed_at: Optional[str] = None
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None
