from typing import Optional

from pydantic import Field

from ._common import WriteModelBase


class PaymentReceivedWriteModel(WriteModelBase):
    contact_id: Optional[str] = None
    invoice_id: Optional[str] = None
    amount: Optional[float] = Field(default=None, ge=0)
    date: Optional[str] = None
    payment_mode: Optional[str] = None
    reference: Optional[str] = None
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)


class PaymentMadeWriteModel(WriteModelBase):
    vendor_id: Optional[str] = None
    bill_id: Optional[str] = None
    amount: Optional[float] = Field(default=None, ge=0)
    date: Optional[str] = None
    payment_mode: Optional[str] = None
    reference: Optional[str] = None
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)


class ExpenseWriteModel(WriteModelBase):
    account_id: Optional[str] = None
    amount: Optional[float] = Field(default=None, ge=0)
    date: Optional[str] = None
    status: Optional[str] = None
    vendor_id: Optional[str] = None
    description: Optional[str] = None
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)


class QuoteWriteModel(WriteModelBase):
    contact_id: Optional[str] = None
    status: Optional[str] = None
    total: Optional[float] = Field(default=None, ge=0)
    date: Optional[str] = None
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)


class SalesOrderWriteModel(WriteModelBase):
    contact_id: Optional[str] = None
    status: Optional[str] = None
    total: Optional[float] = Field(default=None, ge=0)
    date: Optional[str] = None
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)


class PurchaseOrderWriteModel(WriteModelBase):
    vendor_id: Optional[str] = None
    status: Optional[str] = None
    total: Optional[float] = Field(default=None, ge=0)
    date: Optional[str] = None
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)
