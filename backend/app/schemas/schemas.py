from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime, date


def _validate_strong_password(value: str) -> str:
    """Require at least one letter and one digit; min 8 chars (enforced by Field).

    Login keeps min_length=1 so existing short passwords still authenticate;
    this validator runs only on Setup/Register/Reset to harden new passwords.
    """
    has_alpha = any(c.isalpha() for c in value)
    has_digit = any(c.isdigit() for c in value)
    if not (has_alpha and has_digit):
        raise ValueError("وشەی نهێنی پێویستە لانیکەم پیتێک و ژمارەیەکی تێدابێت")
    return value


# ===== Auth Schemas =====
class SetupRequest(BaseModel):
    org_name: str = Field(max_length=200)
    user_name: str = Field(max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    currency_code: str = Field(default="IQD", max_length=10)
    language: str = Field(default="ku", max_length=10)

    _check_pw = field_validator("password")(_validate_strong_password)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    totp_code: Optional[str] = Field(default=None, max_length=8)


class RegisterRequest(BaseModel):
    org_name: str = Field(max_length=200)
    user_name: str = Field(max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    currency_code: str = Field(default="IQD", max_length=10)
    language: str = Field(default="ku", max_length=10)

    _check_pw = field_validator("password")(_validate_strong_password)


class FirebaseRegisterRequest(BaseModel):
    id_token: str
    # Optional: individuals can sign up with Google without a business name —
    # the backend defaults the workspace name to their Google display name.
    org_name: Optional[str] = Field(default=None, max_length=200)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)

    _check_pw = field_validator("new_password")(_validate_strong_password)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None  # Requirement 2.8: 7-day refresh token
    token_type: str = "bearer"
    user_id: str
    org_id: str
    user_name: str
    role: Optional[str] = None
    is_platform_admin: bool = False
    requires_2fa_setup: bool = False


# ===== Contact Schemas =====
def _normalize_iraqi_phone(raw: Optional[str]) -> Optional[str]:
    """Normalize an Iraqi mobile to E.164 form (+9647XXXXXXXXX).

    Hardening per launch-readiness § R2.1. Rules:
      * Strip whitespace, dashes, parentheses.
      * Accept ``+9647XXXXXXXXX`` (already E.164), ``009647XXXXXXXXX``,
        ``9647XXXXXXXXX``, ``07XXXXXXXXX`` and ``7XXXXXXXXX``.
      * Empty / None / strings that do not match any rule are passed through
        unchanged (downstream may store free-form landline / international
        numbers — we don't reject those).
    """
    if raw is None:
        return None
    s = "".join(ch for ch in str(raw) if ch not in " -()\t")
    if not s:
        return None
    # Already E.164 Iraqi mobile
    if s.startswith("+964") and len(s) == 14 and s[4] == "7" and s[1:].isdigit():
        return s
    # International access prefix
    if s.startswith("00964") and len(s) == 15 and s[5] == "7" and s[2:].isdigit():
        return "+" + s[2:]
    # Country code without +
    if s.startswith("964") and len(s) == 13 and s[3] == "7" and s.isdigit():
        return "+" + s
    # Local with leading zero: 07XXXXXXXXX (11 digits)
    if s.startswith("07") and len(s) == 11 and s.isdigit():
        return "+964" + s[1:]
    # Local without leading zero: 7XXXXXXXXX (10 digits)
    if s.startswith("7") and len(s) == 10 and s.isdigit():
        return "+964" + s
    # Not a recognised Iraqi mobile — return the cleaned form (no spaces/dashes)
    return s


class ContactBase(BaseModel):
    contact_type: str = Field(default="customer", max_length=20)
    display_name: str = Field(max_length=200)
    company_name: Optional[str] = Field(default=None, max_length=200)
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    mobile: Optional[str] = Field(default=None, max_length=50)
    currency_code: str = Field(default="IQD", max_length=10)
    payment_terms: Optional[int] = Field(default=None, ge=0, le=365)
    tax_number: Optional[str] = Field(default=None, max_length=50)
    notes: Optional[str] = Field(default=None, max_length=2000)


class ContactCreate(ContactBase):
    # Hardening (launch-readiness § R2.1):
    #   * ``display_name`` is the only required field (already enforced by base).
    #   * ``email`` and ``phone`` are explicitly Optional — no 400/422 on
    #     missing values.
    #   * ``display_name`` minimum length is relaxed to 1 char so quick-create
    #     from a search bar with the typed query works on the first keystroke;
    #     the legacy max_length=200 is kept.
    display_name: str = Field(min_length=1, max_length=200)

    @field_validator("phone", "mobile", mode="before")
    @classmethod
    def _normalize_phone(cls, v):
        return _normalize_iraqi_phone(v) if v is not None else v


class ContactUpdate(ContactBase):
    display_name: Optional[str] = Field(default=None, max_length=200)
    contact_type: Optional[str] = Field(default=None, max_length=20)
    expected_version: Optional[int] = Field(default=None, ge=0)


class ContactResponse(ContactBase):
    id: str
    org_id: str
    is_active: bool
    opening_balance: float = 0
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Item Schemas =====
class ItemBase(BaseModel):
    name: str = Field(max_length=200)
    name_ku: Optional[str] = Field(default=None, max_length=200)
    sku: Optional[str] = Field(default=None, max_length=50)
    barcode: Optional[str] = Field(default=None, max_length=100)
    item_type: str = Field(default="goods", max_length=20)
    unit: Optional[str] = Field(default=None, max_length=30)
    description: Optional[str] = Field(default=None, max_length=2000)
    selling_price: float = Field(default=0, ge=0, le=999999999)
    cost_price: float = Field(default=0, ge=0, le=999999999)
    tax_id: Optional[str] = None
    sales_account_id: Optional[str] = None
    purchase_account_id: Optional[str] = None
    is_trackable: bool = True
    reorder_point: Optional[float] = Field(default=None, ge=0, le=999999999)
    group_id: Optional[str] = None
    image_url: Optional[str] = Field(default=None, max_length=500)  # FIX-73
    # POS visibility — when true, the item appears on /pos/products and
    # the POS Terminal. Defaults to False so items created from the regular
    # /items/new form are NOT auto-exposed to POS; the POS Products page
    # explicitly flips this on via the "Add from inventory" flow.
    available_in_pos: bool = False
    pos_category_id: Optional[str] = Field(default=None, max_length=64)


class ItemCreate(ItemBase):
    # Hardening (launch-readiness § R2.2):
    #   * Empty-string / null FK fields are coerced to ``None`` so the quick-create
    #     modal can POST `""` for an unselected select without tripping 422.
    #   * Accept ``income_account_id`` / ``expense_account_id`` aliases (matches the
    #     frontend quickCreateRegistry naming) and map them onto the legacy
    #     ``sales_account_id`` / ``purchase_account_id`` storage fields.
    income_account_id: Optional[str] = Field(default=None, max_length=64)
    expense_account_id: Optional[str] = Field(default=None, max_length=64)

    @field_validator(
        "tax_id",
        "sales_account_id",
        "purchase_account_id",
        "income_account_id",
        "expense_account_id",
        "group_id",
        "pos_category_id",
        mode="before",
    )
    @classmethod
    def _empty_fk_to_none(cls, v):
        if v is None:
            return None
        if isinstance(v, str) and v.strip() == "":
            return None
        return v


class ItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    name_ku: Optional[str] = Field(default=None, max_length=200)
    sku: Optional[str] = Field(default=None, max_length=50)
    barcode: Optional[str] = Field(default=None, max_length=100)
    item_type: Optional[str] = Field(default=None, max_length=20)
    unit: Optional[str] = Field(default=None, max_length=30)
    description: Optional[str] = Field(default=None, max_length=2000)
    selling_price: Optional[float] = Field(default=None, ge=0, le=999999999)
    cost_price: Optional[float] = Field(default=None, ge=0, le=999999999)
    tax_id: Optional[str] = None
    is_trackable: Optional[bool] = None
    is_active: Optional[bool] = None
    reorder_point: Optional[float] = Field(default=None, ge=0, le=999999999)
    image_url: Optional[str] = Field(default=None, max_length=500)  # FIX-73
    # POS visibility — controls whether the item appears on /pos/products
    # and the POS Terminal. Defaults to None so partial updates don't
    # accidentally toggle visibility.
    available_in_pos: Optional[bool] = None
    pos_category_id: Optional[str] = Field(default=None, max_length=64)
    income_account_id: Optional[str] = Field(default=None, max_length=64)
    expense_account_id: Optional[str] = Field(default=None, max_length=64)
    expected_version: Optional[int] = Field(default=None, ge=0)


class ItemResponse(ItemBase):
    id: str
    org_id: str
    stock_on_hand: float = 0
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Invoice Schemas =====
class InvoiceLineCreate(BaseModel):
    item_id: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=1000)
    quantity: float = Field(default=1, gt=0, le=999999999)
    unit_price: float = Field(default=0, ge=0, le=999999999)
    discount_percent: float = Field(default=0, ge=0, le=100)
    tax_id: Optional[str] = None
    account_id: Optional[str] = None


class InvoiceCreate(BaseModel):
    contact_id: str
    date: datetime
    due_date: Optional[datetime] = None
    reference: Optional[str] = Field(default=None, max_length=200)
    currency_code: str = Field(default="IQD", max_length=10)
    exchange_rate: float = Field(default=1.0, ge=0)
    discount_type: Optional[str] = Field(default=None, max_length=20)
    discount_amount: float = Field(default=0, ge=0, le=999999999)
    shipping_charge: float = Field(default=0, ge=0, le=999999999)
    adjustment: float = Field(default=0, ge=-999999999, le=999999999)
    notes: Optional[str] = Field(default=None, max_length=2000)
    terms: Optional[str] = Field(default=None, max_length=2000)
    lines: list[InvoiceLineCreate]


class InvoiceUpdate(BaseModel):
    contact_id: Optional[str] = None
    date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    reference: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=2000)
    terms: Optional[str] = Field(default=None, max_length=2000)
    lines: Optional[list[InvoiceLineCreate]] = None
    expected_version: Optional[int] = Field(default=None, ge=0)


class InvoiceLineResponse(BaseModel):
    id: str
    item_id: Optional[str] = None
    description: Optional[str] = None
    quantity: float
    unit_price: float
    discount_percent: float = 0
    discount_amount: float = 0
    tax_id: Optional[str] = None
    tax_amount: float = 0
    account_id: Optional[str] = None
    line_total: float

    class Config:
        from_attributes = True


class InvoiceResponse(BaseModel):
    id: str
    org_id: str
    contact_id: str
    invoice_number: str
    reference: Optional[str] = None
    date: datetime
    due_date: Optional[datetime] = None
    status: str
    subtotal: float
    discount_amount: float = 0
    tax_amount: float = 0
    shipping_charge: float = 0
    adjustment: float = 0
    total: float
    balance_due: float
    currency_code: str
    exchange_rate: float = 1.0
    notes: Optional[str] = None
    terms: Optional[str] = None
    lines: list[InvoiceLineResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Expense Schemas =====
class ExpenseCreate(BaseModel):
    date: datetime
    account_id: str
    amount: float = Field(ge=0, le=999999999)
    tax_id: Optional[str] = None
    paid_through_account_id: Optional[str] = None
    contact_id: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=2000)
    reference: Optional[str] = Field(default=None, max_length=200)
    is_billable: bool = False
    project_id: Optional[str] = None
    currency_code: str = Field(default="IQD", max_length=10)
    exchange_rate: float = Field(default=1.0, ge=0)


class ExpenseResponse(BaseModel):
    id: str
    org_id: str
    expense_number: str
    date: datetime
    account_id: str
    amount: float
    tax_amount: float = 0
    total: float
    paid_through_account_id: Optional[str] = None
    contact_id: Optional[str] = None
    description: Optional[str] = None
    reference: Optional[str] = None
    status: str
    is_billable: bool = False
    project_id: Optional[str] = None
    currency_code: str
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Payment Schemas =====
class PaymentAllocation(BaseModel):
    invoice_id: str
    amount: float


class PaymentReceivedCreate(BaseModel):
    contact_id: str
    date: datetime
    amount: float = Field(ge=0, le=999999999)
    payment_mode: Optional[str] = Field(default=None, max_length=50)
    reference: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    deposit_to_account_id: Optional[str] = None
    currency_code: str = Field(default="IQD", max_length=10)
    exchange_rate: float = Field(default=1.0, ge=0)
    allocations: list[PaymentAllocation] = []


class PaymentReceivedResponse(BaseModel):
    id: str
    org_id: str
    contact_id: str
    payment_number: str
    date: datetime
    amount: float
    unused_amount: float = 0
    payment_mode: Optional[str] = None
    reference: Optional[str] = None
    currency_code: str
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Account Schemas =====
class AccountCreate(BaseModel):
    name: str = Field(max_length=200)
    name_ku: Optional[str] = Field(default=None, max_length=200)
    code: Optional[str] = Field(default=None, max_length=20)
    account_type: str = Field(max_length=50)
    parent_id: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=2000)
    currency_code: str = Field(default="IQD", max_length=10)


class AccountResponse(BaseModel):
    id: str
    org_id: str
    name: str
    name_ku: Optional[str] = None
    code: Optional[str] = None
    account_type: str
    parent_id: Optional[str] = None
    balance: float = 0
    is_system: bool = False
    is_active: bool = True

    class Config:
        from_attributes = True


# ===== Journal Schemas =====
class JournalLineCreate(BaseModel):
    account_id: str
    debit: float = 0
    credit: float = 0
    description: Optional[str] = Field(default=None, max_length=1000)
    contact_id: Optional[str] = None


class JournalEntryCreate(BaseModel):
    date: datetime
    description: Optional[str] = Field(default=None, max_length=1000)
    reference: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=2000)
    currency_code: str = Field(default="IQD", max_length=10)
    exchange_rate: float = 1.0
    lines: list[JournalLineCreate]


class JournalLineResponse(BaseModel):
    id: str
    account_id: str
    description: Optional[str] = None
    debit: float = 0
    credit: float = 0
    contact_id: Optional[str] = None

    class Config:
        from_attributes = True


class JournalEntryResponse(BaseModel):
    id: str
    org_id: str
    entry_number: str
    date: datetime
    description: Optional[str] = None
    reference: Optional[str] = None
    source_type: Optional[str] = None
    total_debit: float
    total_credit: float
    status: str
    is_auto: bool
    lines: list[JournalLineResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Bill Schemas =====
class BillLineCreate(BaseModel):
    item_id: Optional[str] = None
    account_id: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=1000)
    quantity: float = Field(default=1, gt=0, le=999999999)
    unit_price: float = Field(default=0, ge=0, le=999999999)
    discount_percent: float = Field(default=0, ge=0, le=100)
    tax_id: Optional[str] = None


class BillCreate(BaseModel):
    contact_id: str
    date: datetime
    due_date: Optional[datetime] = None
    vendor_bill_number: Optional[str] = Field(default=None, max_length=100)
    reference: Optional[str] = Field(default=None, max_length=200)
    currency_code: str = Field(default="IQD", max_length=10)
    exchange_rate: float = 1.0
    notes: Optional[str] = Field(default=None, max_length=2000)
    lines: list[BillLineCreate]


class BillUpdate(BaseModel):
    contact_id: Optional[str] = None
    date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    reference: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=2000)
    lines: Optional[list[BillLineCreate]] = None


class BillResponse(BaseModel):
    id: str
    org_id: str
    contact_id: str
    bill_number: str
    vendor_bill_number: Optional[str] = None
    date: datetime
    due_date: Optional[datetime] = None
    status: str
    subtotal: float
    discount_amount: float = 0
    tax_amount: float = 0
    total: float
    balance_due: float
    currency_code: str
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Dashboard Schemas =====
class DashboardResponse(BaseModel):
    total_receivable: float = 0
    total_payable: float = 0
    income_this_month: float = 0
    expenses_this_month: float = 0
    total_contacts: int = 0
    overdue_invoices: int = 0
    recent_invoices: list = []
    recent_expenses: list = []
    income_expense_chart: list = []
    # ── Additive analytics (purely optional; default [] so the endpoint and
    #    every existing field keep working even when a computation fails). ──
    revenue_trend: list = []
    cash_flow: list = []
    top_customers: list = []
    aging: list = []
    receivable_sparkline: list = []
    payable_sparkline: list = []
    income_sparkline: list = []
    expense_sparkline: list = []
    cash_breakdown: list = []


# ===== Project Schemas =====
class ProjectCreate(BaseModel):
    name: str = Field(max_length=200)
    contact_id: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=2000)
    billing_type: str = Field(default="fixed", max_length=20)
    budget_amount: float = Field(default=0, ge=0, le=999999999)
    hourly_rate: float = Field(default=0, ge=0, le=999999999)
    fixed_cost: float = Field(default=0, ge=0, le=999999999)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    currency_code: str = Field(default="IQD", max_length=10)


class ProjectResponse(BaseModel):
    id: str
    org_id: str
    name: str
    contact_id: Optional[str] = None
    description: Optional[str] = None
    status: str
    billing_type: str
    budget_amount: float = 0
    total_hours: float = 0
    total_cost: float = 0
    total_billed: float = 0
    currency_code: str
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Common Schemas =====
class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int


class MessageResponse(BaseModel):
    message: str
    success: bool = True


# ===== Quote Schemas =====
class QuoteLineCreate(BaseModel):
    item_id: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=1000)
    quantity: float = Field(default=1, gt=0, le=999999999)
    unit_price: float = Field(default=0, ge=0, le=999999999)
    discount_percent: float = Field(default=0, ge=0, le=100)
    tax_id: Optional[str] = None


class QuoteCreate(BaseModel):
    contact_id: str
    date: datetime
    expiry_date: Optional[datetime] = None
    reference: Optional[str] = Field(default=None, max_length=200)
    currency_code: str = Field(default="IQD", max_length=10)
    exchange_rate: float = 1.0
    notes: Optional[str] = Field(default=None, max_length=2000)
    terms: Optional[str] = Field(default=None, max_length=2000)
    lines: list[QuoteLineCreate]


class QuoteUpdate(BaseModel):
    contact_id: Optional[str] = None
    date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    reference: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=2000)
    terms: Optional[str] = Field(default=None, max_length=2000)
    lines: Optional[list[QuoteLineCreate]] = None


class QuoteLineResponse(BaseModel):
    id: str
    item_id: Optional[str] = None
    description: Optional[str] = None
    quantity: float
    unit_price: float
    discount_percent: float = 0
    tax_id: Optional[str] = None
    tax_amount: float = 0
    line_total: float

    class Config:
        from_attributes = True


class QuoteResponse(BaseModel):
    id: str
    org_id: str
    contact_id: str
    quote_number: str
    reference: Optional[str] = None
    date: datetime
    expiry_date: Optional[datetime] = None
    status: str
    subtotal: float
    discount_amount: float = 0
    tax_amount: float = 0
    total: float
    currency_code: str
    notes: Optional[str] = None
    terms: Optional[str] = None
    lines: list[QuoteLineResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Sales Order Schemas =====
class SalesOrderLineCreate(BaseModel):
    item_id: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=1000)
    quantity: float = Field(default=1, gt=0, le=999999999)
    unit_price: float = Field(default=0, ge=0, le=999999999)
    discount_percent: float = Field(default=0, ge=0, le=100)
    tax_id: Optional[str] = None


class SalesOrderCreate(BaseModel):
    contact_id: str
    date: datetime
    delivery_date: Optional[datetime] = None
    reference: Optional[str] = Field(default=None, max_length=200)
    currency_code: str = Field(default="IQD", max_length=10)
    exchange_rate: float = 1.0
    notes: Optional[str] = Field(default=None, max_length=2000)
    terms: Optional[str] = Field(default=None, max_length=2000)
    quote_id: Optional[str] = None
    lines: list[SalesOrderLineCreate]


class SalesOrderUpdate(BaseModel):
    contact_id: Optional[str] = None
    date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    reference: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=2000)
    terms: Optional[str] = Field(default=None, max_length=2000)
    lines: Optional[list[SalesOrderLineCreate]] = None


class SalesOrderLineResponse(BaseModel):
    id: str
    item_id: Optional[str] = None
    description: Optional[str] = None
    quantity: float
    unit_price: float
    discount_percent: float = 0
    tax_id: Optional[str] = None
    tax_amount: float = 0
    line_total: float

    class Config:
        from_attributes = True


class SalesOrderResponse(BaseModel):
    id: str
    org_id: str
    contact_id: str
    order_number: str
    reference: Optional[str] = None
    date: datetime
    delivery_date: Optional[datetime] = None
    status: str
    subtotal: float
    discount_amount: float = 0
    tax_amount: float = 0
    total: float
    currency_code: str
    notes: Optional[str] = None
    quote_id: Optional[str] = None
    lines: list[SalesOrderLineResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Purchase Order Schemas =====
class PurchaseOrderLineCreate(BaseModel):
    item_id: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=1000)
    quantity: float = Field(default=1, gt=0, le=999999999)
    unit_price: float = Field(default=0, ge=0, le=999999999)
    discount_percent: float = Field(default=0, ge=0, le=100)
    tax_id: Optional[str] = None


class PurchaseOrderCreate(BaseModel):
    contact_id: str
    date: datetime
    delivery_date: Optional[datetime] = None
    reference: Optional[str] = Field(default=None, max_length=200)
    currency_code: str = Field(default="IQD", max_length=10)
    exchange_rate: float = 1.0
    notes: Optional[str] = Field(default=None, max_length=2000)
    terms: Optional[str] = Field(default=None, max_length=2000)
    lines: list[PurchaseOrderLineCreate]


class PurchaseOrderUpdate(BaseModel):
    contact_id: Optional[str] = None
    date: Optional[datetime] = None
    delivery_date: Optional[datetime] = None
    reference: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=2000)
    terms: Optional[str] = Field(default=None, max_length=2000)
    lines: Optional[list[PurchaseOrderLineCreate]] = None


class PurchaseOrderLineResponse(BaseModel):
    id: str
    item_id: Optional[str] = None
    description: Optional[str] = None
    quantity: float
    unit_price: float
    discount_percent: float = 0
    tax_id: Optional[str] = None
    tax_amount: float = 0
    line_total: float

    class Config:
        from_attributes = True


class PurchaseOrderResponse(BaseModel):
    id: str
    org_id: str
    contact_id: str
    order_number: str
    reference: Optional[str] = None
    date: datetime
    delivery_date: Optional[datetime] = None
    status: str
    subtotal: float
    discount_amount: float = 0
    tax_amount: float = 0
    total: float
    currency_code: str
    notes: Optional[str] = None
    lines: list[PurchaseOrderLineResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Credit Note Schemas =====
class CreditNoteLineCreate(BaseModel):
    item_id: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=1000)
    quantity: float = Field(default=1, gt=0, le=999999999)
    unit_price: float = Field(default=0, ge=0, le=999999999)
    tax_id: Optional[str] = None


class CreditNoteCreate(BaseModel):
    contact_id: str
    invoice_id: Optional[str] = None
    date: datetime
    currency_code: str = Field(default="IQD", max_length=10)
    notes: Optional[str] = Field(default=None, max_length=2000)
    lines: list[CreditNoteLineCreate]


class CreditNoteLineResponse(BaseModel):
    id: str
    item_id: Optional[str] = None
    description: Optional[str] = None
    quantity: float
    unit_price: float
    tax_id: Optional[str] = None
    tax_amount: float = 0
    line_total: float

    class Config:
        from_attributes = True


class CreditNoteResponse(BaseModel):
    id: str
    org_id: str
    contact_id: str
    credit_note_number: str
    invoice_id: Optional[str] = None
    date: datetime
    status: str
    subtotal: float
    tax_amount: float = 0
    total: float
    balance: float
    currency_code: str
    notes: Optional[str] = None
    lines: list[CreditNoteLineResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Vendor Credit Schemas =====
class VendorCreditLineCreate(BaseModel):
    item_id: Optional[str] = None
    account_id: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=1000)
    quantity: float = Field(default=1, gt=0, le=999999999)
    unit_price: float = Field(default=0, ge=0, le=999999999)
    tax_id: Optional[str] = None


class VendorCreditCreate(BaseModel):
    contact_id: str
    bill_id: Optional[str] = None
    date: datetime
    currency_code: str = Field(default="IQD", max_length=10)
    notes: Optional[str] = Field(default=None, max_length=2000)
    lines: list[VendorCreditLineCreate]


class VendorCreditLineResponse(BaseModel):
    id: str
    item_id: Optional[str] = None
    account_id: Optional[str] = None
    description: Optional[str] = None
    quantity: float
    unit_price: float
    tax_id: Optional[str] = None
    tax_amount: float = 0
    line_total: float

    class Config:
        from_attributes = True


class VendorCreditResponse(BaseModel):
    id: str
    org_id: str
    contact_id: str
    credit_note_number: str
    bill_id: Optional[str] = None
    date: datetime
    status: str
    subtotal: float
    tax_amount: float = 0
    total: float
    balance: float
    currency_code: str
    notes: Optional[str] = None
    lines: list[VendorCreditLineResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Recurring Invoice Schemas =====
class RecurringInvoiceCreate(BaseModel):
    contact_id: str
    profile_name: str = Field(default="Default", max_length=200)
    frequency: str = Field(default="monthly", max_length=20)
    start_date: datetime
    end_date: Optional[datetime] = None
    payment_terms: Optional[int] = None
    currency_code: str = Field(default="IQD", max_length=10)
    notes: Optional[str] = Field(default=None, max_length=2000)
    lines: list[InvoiceLineCreate] = []


class RecurringInvoiceResponse(BaseModel):
    id: str
    org_id: str
    contact_id: str
    profile_name: str
    frequency: str
    start_date: datetime
    end_date: Optional[datetime] = None
    next_invoice_date: Optional[datetime] = None
    payment_terms: Optional[int] = None
    subtotal: float = 0
    tax_amount: float = 0
    total: float = 0
    currency_code: str
    status: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Inventory Adjustment Schemas =====
class InventoryAdjustmentLineCreate(BaseModel):
    item_id: str
    quantity_adjusted: float
    value_adjusted: float = 0


class InventoryAdjustmentCreate(BaseModel):
    date: datetime
    reason: Optional[str] = Field(default=None, max_length=500)
    adjustment_type: str = Field(default="quantity", max_length=20)
    account_id: Optional[str] = None
    lines: list[InventoryAdjustmentLineCreate]


class InventoryAdjustmentResponse(BaseModel):
    id: str
    org_id: str
    adjustment_number: str
    date: datetime
    reason: Optional[str] = None
    adjustment_type: str
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Tax Rate Schemas =====
class TaxRateCreate(BaseModel):
    name: str = Field(max_length=100)
    name_ku: Optional[str] = Field(default=None, max_length=100)
    rate: float
    tax_type: str = Field(default="vat", max_length=20)
    is_compound: bool = False


class TaxRateResponse(BaseModel):
    id: str
    org_id: str
    name: str
    name_ku: Optional[str] = None
    rate: float
    tax_type: str
    is_compound: bool = False
    is_default: bool = False
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Budget Schemas =====
class BudgetLineCreate(BaseModel):
    account_id: str
    month_1: float = 0
    month_2: float = 0
    month_3: float = 0
    month_4: float = 0
    month_5: float = 0
    month_6: float = 0
    month_7: float = 0
    month_8: float = 0
    month_9: float = 0
    month_10: float = 0
    month_11: float = 0
    month_12: float = 0


class BudgetCreate(BaseModel):
    name: str = Field(max_length=200)
    fiscal_year_id: str
    budget_type: str = Field(default="expense", max_length=20)
    notes: Optional[str] = Field(default=None, max_length=2000)
    lines: list[BudgetLineCreate] = []


class BudgetResponse(BaseModel):
    id: str
    org_id: str
    name: str
    fiscal_year_id: str
    budget_type: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Fiscal Year Schemas =====
class FiscalYearCreate(BaseModel):
    name: str = Field(max_length=200)
    start_date: datetime
    end_date: datetime


class FiscalYearResponse(BaseModel):
    id: str
    org_id: str
    name: str
    start_date: datetime
    end_date: datetime
    is_closed: bool = False
    is_current: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Currency & Exchange Rate Schemas =====
class CurrencyResponse(BaseModel):
    id: str
    code: str
    name: str
    name_ku: Optional[str] = None
    symbol: str
    decimal_places: int = 2
    is_active: bool = True

    class Config:
        from_attributes = True


class ExchangeRateCreate(BaseModel):
    from_currency: str = Field(max_length=10)
    to_currency: str = Field(max_length=10)
    rate: float
    date: datetime


class ExchangeRateResponse(BaseModel):
    id: str
    from_currency: str
    to_currency: str
    rate: float
    date: datetime
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Settings Schemas =====
class SettingUpdate(BaseModel):
    key: str = Field(max_length=100)
    value: str = Field(max_length=2000)
    category: str = Field(default="general", max_length=50)


class SettingResponse(BaseModel):
    id: str
    key: str
    value: Optional[str] = None
    category: str

    class Config:
        from_attributes = True


# ===== Activity Log Schemas =====
class ActivityLogResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    entity_type: str
    entity_id: Optional[str] = None
    action: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Bank Reconciliation Schemas =====
class BankReconciliationCreate(BaseModel):
    bank_account_id: str
    statement_date: datetime
    statement_balance: float


class BankReconciliationResponse(BaseModel):
    id: str
    bank_account_id: str
    statement_date: datetime
    statement_balance: float
    book_balance: float = 0
    difference: float = 0
    status: str = "draft"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== Bank Rule Schemas =====
class BankRuleCreate(BaseModel):
    name: str = Field(max_length=200)
    rule_type: str = Field(max_length=20)  # deposit, withdrawal
    apply_to: str = Field(default="description", max_length=30)  # description, payee, reference
    condition_type: str = Field(default="contains", max_length=30)  # contains, starts_with, equals
    condition_value: str = Field(max_length=500)
    target_account_id: Optional[str] = None
    target_contact_id: Optional[str] = None
    target_tax_id: Optional[str] = None


class BankRuleResponse(BaseModel):
    id: str
    org_id: str
    name: str
    rule_type: str
    apply_to: str = "description"
    condition_type: str = "contains"
    condition_value: str
    target_account_id: Optional[str] = None
    target_contact_id: Optional[str] = None
    target_tax_id: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== CSV Import Schemas =====
class CSVImportPreview(BaseModel):
    rows: list[dict] = []
    total_rows: int = 0
    columns: list[str] = []
    sample_rows: list[dict] = []


class CSVImportConfirm(BaseModel):
    rows: list[dict]
    date_column: str = Field(default="date", max_length=50)
    amount_column: str = Field(default="amount", max_length=50)
    description_column: str = Field(default="description", max_length=50)
    reference_column: Optional[str] = Field(default=None, max_length=50)


# ===== Fixed Asset Schemas =====
class FixedAssetCreate(BaseModel):
    name: str = Field(max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    asset_account_id: str
    depreciation_account_id: str
    accumulated_depreciation_account_id: str
    purchase_date: date
    purchase_price: float
    salvage_value: float = 0
    useful_life_months: int
    depreciation_method: str = Field(default="straight_line", max_length=30)
    paid_through_account_id: Optional[str] = None


class FixedAssetResponse(BaseModel):
    id: str
    org_id: str
    name: str
    description: Optional[str] = None
    asset_number: Optional[str] = None
    asset_account_id: str
    depreciation_account_id: str
    accumulated_depreciation_account_id: str
    purchase_date: date
    purchase_price: float
    salvage_value: float = 0
    useful_life_months: int
    depreciation_method: str
    current_value: Optional[float] = None
    status: str
    disposed_date: Optional[date] = None
    disposal_amount: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DepreciationScheduleItem(BaseModel):
    period: int
    date: date
    opening_value: float
    depreciation_amount: float
    accumulated_depreciation: float
    closing_value: float


class AssetDisposeRequest(BaseModel):
    disposal_date: date
    disposal_amount: float = 0
    deposit_to_account_id: Optional[str] = None


# ===== Stock Transfer Schemas =====
class StockTransferLineCreate(BaseModel):
    item_id: str
    quantity: float


class StockTransferCreate(BaseModel):
    from_warehouse_id: str
    to_warehouse_id: str
    date: date
    notes: Optional[str] = Field(default=None, max_length=2000)
    lines: list[StockTransferLineCreate]


class StockTransferLineResponse(BaseModel):
    id: str
    item_id: str
    quantity: float

    class Config:
        from_attributes = True


class StockTransferResponse(BaseModel):
    id: str
    org_id: str
    transfer_number: Optional[str] = None
    from_warehouse_id: str
    to_warehouse_id: str
    date: date
    notes: Optional[str] = None
    status: str
    lines: list[StockTransferLineResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Credit Note Application Schemas =====
class CreditNoteApplicationCreate(BaseModel):
    invoice_id: str
    amount_applied: float


class CreditNoteApplicationResponse(BaseModel):
    id: str
    credit_note_id: str
    invoice_id: str
    amount_applied: float
    date: date
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Retainer Schemas =====
class RetainerCreate(BaseModel):
    contact_id: str
    date: datetime
    due_date: Optional[datetime] = None
    amount: float
    reference: Optional[str] = None
    currency_code: str = "IQD"
    exchange_rate: float = 1.0
    notes: Optional[str] = None
    deposit_to_account_id: Optional[str] = None


class RetainerApplyRequest(BaseModel):
    invoice_id: str
    amount_applied: float


# ===== Progress Invoice Schemas =====
class ProgressInvoiceLineCreate(BaseModel):
    quote_line_id: str
    progress_percent: float
    description: Optional[str] = None


class ProgressInvoiceCreate(BaseModel):
    date: datetime
    due_date: Optional[datetime] = None
    reference: Optional[str] = None
    currency_code: str = "IQD"
    exchange_rate: float = 1.0
    notes: Optional[str] = None
    lines: list[ProgressInvoiceLineCreate]


# ===== Tax Return Schemas =====
class TaxReturnCreate(BaseModel):
    name: str
    period_start: datetime
    period_end: datetime
    notes: Optional[str] = None


class TaxReturnResponse(BaseModel):
    id: str
    org_id: str
    name: str
    period_start: datetime
    period_end: datetime
    tax_collected: float = 0
    tax_paid: float = 0
    net_tax: float = 0
    status: str
    filed_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Price List Schemas =====
class PriceListItemCreate(BaseModel):
    item_id: str
    custom_price: float
    discount_percent: float = 0
    markup_percent: float = 0


class PriceListCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price_type: str = "sales"
    round_off_to: Optional[str] = None
    items: list[PriceListItemCreate] = []


class PriceListItemResponse(BaseModel):
    id: str
    item_id: str
    custom_price: float
    discount_percent: float = 0
    markup_percent: float = 0

    class Config:
        from_attributes = True


class PriceListResponse(BaseModel):
    id: str
    org_id: str
    name: str
    description: Optional[str] = None
    price_type: str
    round_off_to: Optional[str] = None
    is_active: bool = True
    items: list[PriceListItemResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Warehouse Schemas =====
class WarehouseCreate(BaseModel):
    name: str
    address: Optional[str] = None
    is_primary: bool = False


class WarehouseResponse(BaseModel):
    id: str
    org_id: str
    name: str
    address: Optional[str] = None
    is_primary: bool = False
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Phase 2: Email + PDF + Reports Schemas =====
class EmailSendRequest(BaseModel):
    to_email: Optional[str] = None
    subject: Optional[str] = None
    message: Optional[str] = None


class ReminderSettingUpdate(BaseModel):
    before_due_days: Optional[str] = None  # JSON
    after_due_days: Optional[str] = None  # JSON
    email_subject_template: Optional[str] = None
    email_body_template: Optional[str] = None
    is_active: bool = True


class ReminderSettingResponse(BaseModel):
    id: str
    org_id: str
    before_due_days: Optional[str] = None
    after_due_days: Optional[str] = None
    email_subject_template: Optional[str] = None
    email_body_template: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class InvoiceTemplateCreate(BaseModel):
    name: str
    layout: str = "classic"
    colors: Optional[str] = None
    show_logo: bool = True
    footer_text: Optional[str] = None


class InvoiceTemplateResponse(BaseModel):
    id: str
    org_id: str
    name: str
    layout: str
    colors: Optional[str] = None
    show_logo: bool
    footer_text: Optional[str] = None
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True
