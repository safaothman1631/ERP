"""Pydantic schemas for the onboarding wizard (launch-readiness § R3 / § 4).

The wizard is a finite-state machine with five steps:

  ``step1_company → step2_region → step3_coa → step4_pos? → step5_first_sale``

State persists per-tenant at ``tenants/{tenant_id}/onboarding/state`` and
expires 30 days after creation if ``completed_at`` is never set (see
``OnboardingRepository.put_state``). The frontend hydrates ``OnboardingState``
on mount and resumes at ``current_step``.

Field names match the frontend reducer payloads in
``frontend/src/onboarding/state.ts`` exactly — any rename here surfaces as a
silent 422 on the wizard's "Continue" button.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


# ── Sub-models ──────────────────────────────────────────────────────────

class CompanyInfo(BaseModel):
    """Step 1 — basic company profile."""

    legal_name: Optional[str] = Field(None, max_length=160)
    trade_name: Optional[str] = Field(None, max_length=160)
    # Iraqi tax/registration ids — opaque strings, validated downstream.
    tax_id: Optional[str] = Field(None, max_length=40)
    registration_no: Optional[str] = Field(None, max_length=40)
    industry: Optional[str] = Field(None, max_length=80)
    # Drives which COA templates surface in step 3.
    intended_use: list[str] = Field(default_factory=list)
    fiscal_year_start_month: int = Field(1, ge=1, le=12)
    base_currency: str = Field("IQD", min_length=3, max_length=3)
    employee_count_bucket: Optional[Literal["1", "2-10", "11-50", "51-200", "200+"]] = None


class IraqRegion(BaseModel):
    """Step 2 — Iraq governorate / KRG region preset."""

    governorate_code: str = Field(..., max_length=8)  # e.g. "IQ-BG", "IQ-AR"
    label_en: Optional[str] = None
    label_ku: Optional[str] = None
    label_ar: Optional[str] = None
    krg_region: bool = False
    # Tax-rate document IDs created in /api/taxes during step 2 submit.
    tax_rate_ids: list[str] = Field(default_factory=list)


class COATemplateChoice(BaseModel):
    """Step 3 — selected COA template plus any per-account name overrides."""

    template: Literal["small_smb", "medium_smb", "restaurant", "pharmacy", "retail"]
    # Optional per-account renames keyed by template code (e.g. "11200").
    overrides: list[dict] = Field(default_factory=list)
    # Account IDs created when the template was applied.
    account_ids: list[str] = Field(default_factory=list)


class POSHardwareConfig(BaseModel):
    """Step 4 — Web Bluetooth printer / cash-drawer pairing result."""

    printer_paired: bool = False
    printer_device_id: Optional[str] = None
    paper_width_mm: Optional[Literal[58, 80]] = None
    cash_drawer_enabled: bool = False
    skipped: bool = False


class FirstSaleResult(BaseModel):
    """Step 5 — outcome of the test sale (product + customer + cash charge)."""

    item_id: Optional[str] = None
    customer_id: Optional[str] = None
    invoice_id: Optional[str] = None
    amount_iqd: Optional[float] = Field(None, ge=0)
    receipt_printed: bool = False


# ── State envelope ──────────────────────────────────────────────────────

_STEP_LITERAL = Literal[
    "idle",
    "step1_company",
    "step2_region",
    "step3_coa",
    "step4_pos",
    "step5_first_sale",
    "completed",
]


class OnboardingState(BaseModel):
    """The wizard's full persisted state envelope.

    A new tenant returns the default-constructed instance with
    ``current_step='step1_company'``. Each ``PUT /api/onboarding/state``
    request replaces this whole envelope (idempotent) so the frontend
    reducer never has to merge.
    """

    current_step: _STEP_LITERAL = "step1_company"
    completed_steps: list[str] = Field(default_factory=list)
    skipped_steps: list[str] = Field(default_factory=list)
    company: Optional[CompanyInfo] = None
    region: Optional[IraqRegion] = None
    coa: Optional[COATemplateChoice] = None
    pos_hardware: Optional[POSHardwareConfig] = None
    first_sale: Optional[FirstSaleResult] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    # Server-managed expiry; 30 days from `started_at` until `completed_at` is set.
    expires_at: Optional[datetime] = None

    @field_validator("completed_steps", "skipped_steps")
    @classmethod
    def _dedupe(cls, v: list[str]) -> list[str]:
        # Preserve order, drop duplicates — the reducer might re-fire NEXT on
        # accidental double-clicks.
        seen: set[str] = set()
        out: list[str] = []
        for s in v:
            if s not in seen:
                seen.add(s)
                out.append(s)
        return out


# ── COA apply request/response ──────────────────────────────────────────

class COAOverride(BaseModel):
    """A single per-account override applied during ``coa/apply``.

    Keyed by ``code`` (e.g. ``'11200'``) so the user can rename "Bank — Main"
    to "Cihan Bank — Erbil" without forking the template.
    """

    code: str = Field(..., max_length=10)
    name: Optional[str] = Field(None, max_length=160)
    new_code: Optional[str] = Field(None, max_length=10)


class COAApplyRequest(BaseModel):
    template: Literal["small_smb", "medium_smb", "restaurant", "pharmacy", "retail"]
    overrides: list[COAOverride] = Field(default_factory=list)


class COAApplyResponse(BaseModel):
    accounts_created: int
    ids: list[str]
    template: str
    default_account_map: dict[str, str] = Field(default_factory=dict)


class CompleteResponse(BaseModel):
    completed_at: datetime
    tenant_id: str
