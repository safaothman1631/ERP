"""Pydantic request/response schemas for the quick-create endpoints.

These back the 9 quick-create entity slugs declared in the frontend
``quickCreateRegistry.ts`` that previously had no backend route. Field names
match the registry exactly — the frontend POSTs these keys verbatim, so any
rename here surfaces as a silent 422 in the quick-create modal.

See ``.kiro/specs/launch-readiness/requirements.md`` § R2.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


# ── Expense category (R2.5) ──────────────────────────────────────────────

class ExpenseCategoryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    code: Optional[str] = Field(None, max_length=32)
    default_account_id: Optional[str] = None
    description: Optional[str] = Field(None, max_length=280)
    is_active: bool = True


class ExpenseCategoryResponse(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    default_account_id: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


# ── Equipment category (R2.6) ────────────────────────────────────────────

class EquipmentCategoryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    description: Optional[str] = Field(None, max_length=280)
    parent_id: Optional[str] = None
    maintenance_interval_days: Optional[int] = Field(None, gt=0)
    is_active: bool = True


class EquipmentCategoryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    maintenance_interval_days: Optional[int] = None
    is_active: bool = True


# ── Currency (R2.11) ─────────────────────────────────────────────────────

class CurrencyCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=3)
    name: str = Field(..., min_length=1, max_length=80)
    symbol: str = Field(..., min_length=1, max_length=4)
    # Frontend registry sends `decimals`; accept it as the canonical field.
    decimals: int = Field(2, ge=0, le=6)
    exchange_rate_to_base: Decimal = Field(Decimal("1"), gt=0)
    is_active: bool = True


class CurrencyResponse(BaseModel):
    id: str
    code: str
    name: str
    symbol: str
    decimals: int = 2
    exchange_rate_to_base: float = 1.0
    is_active: bool = True


# ── Tag (R2.12) ──────────────────────────────────────────────────────────

class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=40)
    color: Optional[str] = Field("blue", max_length=16)
    scope: str = Field("global", max_length=20)


class TagResponse(BaseModel):
    id: str
    name: str
    color: Optional[str] = None
    scope: str = "global"


# ── Payment method (R2.13) ───────────────────────────────────────────────

_PAYMENT_METHOD_TYPES = (
    "cash", "card", "wallet", "bank_transfer", "check",
    "qi_card", "fastpay", "zain_cash", "asia_pay", "cod", "other",
)
# Provider-backed types require the tenant to configure a gateway in settings.
_GATEWAY_TYPES = {"card", "wallet", "qi_card", "fastpay", "zain_cash", "asia_pay"}


class PaymentMethodCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    type: str = Field("cash")
    provider_code: Optional[str] = None
    # Registry sends `account_id`; map to the GL account link.
    account_id: Optional[str] = None
    gl_account_id: Optional[str] = None
    is_active: bool = True
    is_default: bool = False

    def resolved_type(self) -> str:
        return self.type if self.type in _PAYMENT_METHOD_TYPES else "other"


class PaymentMethodResponse(BaseModel):
    id: str
    name: str
    type: str
    provider_code: Optional[str] = None
    account_id: Optional[str] = None
    gl_account_id: Optional[str] = None
    is_active: bool = True
    is_default: bool = False
    requires_gateway_config: bool = False


# ── Team (R2.9) ──────────────────────────────────────────────────────────

class TeamCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    description: Optional[str] = Field(None, max_length=280)
    # Registry sends `lead_id`; accept both lead_id and manager_user_id.
    lead_id: Optional[str] = None
    manager_user_id: Optional[str] = None
    members: list[str] = Field(default_factory=list)
    is_active: bool = True


class TeamResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    lead_id: Optional[str] = None
    members: list[str] = Field(default_factory=list)
    is_active: bool = True


# ── Subscription plan (R2.7) ─────────────────────────────────────────────

class SubscriptionPlanQuickCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    # Registry sends billing_period in {monthly, quarterly, yearly}.
    billing_period: str = Field("monthly")
    price: Decimal = Field(..., ge=0)
    currency: str = Field("IQD", min_length=3, max_length=3)
    trial_days: int = Field(0, ge=0)
    code: Optional[str] = None
    is_active: bool = True


class SubscriptionPlanResponse(BaseModel):
    id: str
    name: str
    billing_period: str = "monthly"
    price: float = 0.0
    currency: str = "IQD"
    trial_days: int = 0
    is_active: bool = True


# ── Bank account (R2.10) ─────────────────────────────────────────────────

class BankAccountQuickCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    bank_name: str = Field(..., min_length=1, max_length=120)
    account_number: str = Field(..., min_length=1, max_length=64)
    iban: Optional[str] = Field(None, max_length=64)
    swift: Optional[str] = Field(None, max_length=16)
    currency: str = Field("IQD", min_length=3, max_length=3)
    opening_balance: Decimal = Field(Decimal("0"))
    is_active: bool = True


class BankAccountResponse(BaseModel):
    id: str
    name: str
    bank_name: str
    account_number: str
    iban: Optional[str] = None
    swift: Optional[str] = None
    currency: str = "IQD"
    opening_balance: float = 0.0
    is_active: bool = True


# ── Location (R2.8) ──────────────────────────────────────────────────────

class LocationQuickCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    code: Optional[str] = Field(None, max_length=16)
    type: str = Field("warehouse")
    address: Optional[str] = Field(None, max_length=280)
    region: Optional[str] = Field(None, max_length=64)
    governorate: Optional[str] = None
    country: str = Field("Iraq", max_length=64)
    phone: Optional[str] = Field(None, max_length=32)
    is_active: bool = True
    is_default: bool = False


class LocationResponse(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    type: str = "warehouse"
    address: Optional[str] = None
    region: Optional[str] = None
    country: str = "Iraq"
    is_active: bool = True
    is_default: bool = False
