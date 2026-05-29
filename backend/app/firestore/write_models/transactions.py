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
    quote_number: Optional[str] = None
    status: Optional[str] = None
    total: Optional[float] = Field(default=None, ge=0)
    subtotal: Optional[float] = Field(default=None, ge=0)
    tax_amount: Optional[float] = Field(default=None, ge=0)
    date: Optional[str] = None
    expiry_date: Optional[str] = None
    expiry_days: Optional[int] = Field(default=None, ge=0)
    valid_until: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    payment_terms: Optional[str] = None
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)
    exchange_rate: Optional[float] = Field(default=None, gt=0)
    discount_type: Optional[str] = None
    discount_amount: Optional[float] = Field(default=None, ge=0)
    discount_percent: Optional[float] = Field(default=None, ge=0)
    shipping_charge: Optional[float] = Field(default=None, ge=0)
    adjustment: Optional[float] = None
    requires_approval: Optional[bool] = None


class SalesOrderWriteModel(WriteModelBase):
    contact_id: Optional[str] = None
    order_number: Optional[str] = None
    status: Optional[str] = None
    total: Optional[float] = Field(default=None, ge=0)
    subtotal: Optional[float] = Field(default=None, ge=0)
    tax_amount: Optional[float] = Field(default=None, ge=0)
    date: Optional[str] = None
    delivery_date: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    payment_terms: Optional[str] = None
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)
    exchange_rate: Optional[float] = Field(default=None, gt=0)
    discount_type: Optional[str] = None
    discount_amount: Optional[float] = Field(default=None, ge=0)
    shipping_charge: Optional[float] = Field(default=None, ge=0)
    adjustment: Optional[float] = None


class PurchaseOrderWriteModel(WriteModelBase):
    vendor_id: Optional[str] = None
    contact_id: Optional[str] = None
    po_number: Optional[str] = None
    status: Optional[str] = None
    total: Optional[float] = Field(default=None, ge=0)
    subtotal: Optional[float] = Field(default=None, ge=0)
    tax_amount: Optional[float] = Field(default=None, ge=0)
    date: Optional[str] = None
    expected_date: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    payment_terms: Optional[str] = None
    currency_code: Optional[str] = Field(default="IQD", min_length=3, max_length=3)
    exchange_rate: Optional[float] = Field(default=None, gt=0)
    discount_type: Optional[str] = None
    discount_amount: Optional[float] = Field(default=None, ge=0)
    shipping_charge: Optional[float] = Field(default=None, ge=0)
    adjustment: Optional[float] = None
