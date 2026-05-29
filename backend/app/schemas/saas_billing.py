"""Pydantic schemas for SaaS billing endpoints (launch-readiness § R5)."""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

BillingCycle = Literal["monthly", "annual"]
Currency = Literal["IQD", "USD"]
CancelTiming = Literal["now", "period_end"]


# ── State response ──────────────────────────────────────────────────────

class PlanSummary(BaseModel):
    slug: str
    name_ku: str
    name_en: str
    price_iqd_monthly: int
    price_usd_monthly: Decimal
    price_iqd_annual: int
    price_usd_annual: Decimal
    limits: Dict[str, int]
    features: Dict[str, bool]


class BillingStateResponse(BaseModel):
    tenant_id: str
    plan_slug: str
    billing_cycle: BillingCycle = "monthly"
    currency: Currency = "IQD"
    status: str
    trial_ends_at: Optional[str] = None
    days_left_in_trial: Optional[int] = None
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None
    payment_method_type: Optional[str] = None
    last_payment_at: Optional[str] = None
    dunning_step: int = 0
    plan: Optional[PlanSummary] = None
    cancel_at_period_end: bool = False


# ── Change plan ─────────────────────────────────────────────────────────

class ChangePlanRequest(BaseModel):
    to_plan: str = Field(..., min_length=2, max_length=32)
    billing_cycle: BillingCycle = "monthly"
    currency: Currency = "IQD"
    confirm: bool = False  # client must set true after seeing the preview.


class ProrationPreview(BaseModel):
    amount_due_now: int           # smallest unit (cents or whole IQD).
    currency: Currency
    credit_from_old_plan: int
    next_invoice_total: int
    next_invoice_at: Optional[str] = None


class ChangePlanResponse(BaseModel):
    preview: ProrationPreview
    applied: bool
    new_state: Optional[BillingStateResponse] = None


# ── Cancel / restart ────────────────────────────────────────────────────

class CancelRequest(BaseModel):
    at: CancelTiming = "period_end"
    reason: Optional[str] = Field(None, max_length=500)


class CancelResponse(BaseModel):
    status: str
    cancel_at_period_end: bool
    cancellation_reason: Optional[str] = None


class RestartRequest(BaseModel):
    note: Optional[str] = Field(None, max_length=280)


# ── Invoices ────────────────────────────────────────────────────────────

class InvoiceListItem(BaseModel):
    id: str
    number: Optional[str] = None
    amount_due: int
    currency: str
    status: str
    issued_at: Optional[str] = None
    paid_at: Optional[str] = None
    hosted_url: Optional[str] = None
    pdf_url: Optional[str] = None


class InvoiceListResponse(BaseModel):
    items: List[InvoiceListItem]
    total: int


# ── Admin dashboard ─────────────────────────────────────────────────────

class AdminDashboardResponse(BaseModel):
    mrr_iqd: int
    mrr_usd: Decimal
    arr_iqd: int
    arr_usd: Decimal
    active_tenants: int
    trialing_tenants: int
    past_due_tenants: int
    suspended_tenants: int
    cancelled_tenants: int
    trial_to_paid_conversion: float
    churn_rate_monthly: float


class AdminTenantRow(BaseModel):
    tenant_id: str
    plan_slug: Optional[str] = None
    status: Optional[str] = None
    billing_cycle: Optional[str] = None
    trial_ends_at: Optional[str] = None
    last_payment_at: Optional[str] = None
    mrr_value: int = 0  # normalized to IQD-equivalent for sorting.


class AdminTenantListResponse(BaseModel):
    items: List[AdminTenantRow]
    total: int
    page: int = 1
    page_size: int = 50


class ManualPaymentRequest(BaseModel):
    amount: int = Field(..., gt=0)
    currency: Currency = "IQD"
    provider: str = Field(..., min_length=2, max_length=32)
    reference: str = Field(..., min_length=1, max_length=120)
    note: Optional[str] = Field(None, max_length=500)


class ManualPaymentResponse(BaseModel):
    ok: bool
    new_status: str
    recorded_at: str
