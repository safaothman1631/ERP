from typing import Optional

from pydantic import Field

from ._common import WriteModelBase


class BillWriteModel(WriteModelBase):
    vendor_id: Optional[str] = None
    contact_id: Optional[str] = None
    date: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    total: Optional[float] = Field(default=None, ge=0)
    balance_due: Optional[float] = Field(default=None, ge=0)
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)
    bill_number: Optional[str] = None
    notes: Optional[str] = None
    schema_version: int = 2
