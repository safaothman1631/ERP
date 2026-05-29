from typing import Optional

from pydantic import Field

from ._common import WriteModelBase


class InvoiceWriteModel(WriteModelBase):
    contact_id: Optional[str] = None
    date: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern=r"^(draft|sent|open|paid|void|partially_paid|overdue|cancelled)?$")
    total: Optional[float] = Field(default=None, ge=0)
    balance_due: Optional[float] = Field(default=None, ge=0)
    subtotal: Optional[float] = Field(default=None, ge=0)
    tax_amount: Optional[float] = Field(default=None, ge=0)
    amount_paid: Optional[float] = Field(default=None, ge=0)
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)
    exchange_rate: Optional[float] = Field(default=1.0, gt=0)
    invoice_number: Optional[str] = None
    notes: Optional[str] = None
    company_id: Optional[str] = None
    schema_version: int = 2
