"""SaaS plan catalogue — single source of truth.

The frontend pricing page, the change-plan modal, the Stripe bootstrap script,
and the dunning rules all read from this module. Prices live in **both** IQD
(no decimals; whole dinars) and USD (two decimals). Annual prices include the
"two months free" discount — equivalently a 16.67 % discount versus 12 × monthly.

A plan's ``limits`` are enforced at the service layer (e.g. the user-invite
flow checks ``users``); a plan's ``features`` are read by feature-gate helpers
(``app/services/feature_gate.py`` — TODO).

When adding a plan, mirror the change in:
    - ``scripts/bootstrap-stripe.ts``  (Stripe Product/Price creation)
    - ``frontend/src/pages/pricing/Pricing.tsx``  (public marketing)
    - ``frontend/src/pages/billing/PlanPicker.tsx``  (in-app upgrade)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Dict, List, Optional


@dataclass(frozen=True)
class Plan:
    """A SaaS subscription plan offered to tenants."""

    slug: str
    name_ku: str
    name_en: str
    # Monthly prices.
    price_iqd_monthly: int           # whole IQD (no decimals).
    price_usd_monthly: Decimal       # 2-decimal USD.
    # Annual prices (already discounted — see module docstring).
    price_iqd_annual: int
    price_usd_annual: Decimal
    # Resource caps. Sentinel ``-1`` means "unlimited".
    limits: Dict[str, int] = field(default_factory=dict)
    # Feature flags. Truthy ⇒ feature available on this plan.
    features: Dict[str, bool] = field(default_factory=dict)
    # If ``True``, the plan is publicly visible. ``False`` for legacy or
    # internal-only plans we keep for grandfathered customers.
    is_public: bool = True
    # 0 means no trial; non-zero overrides the per-tenant trial default.
    trial_days_override: Optional[int] = None

    # ── Derived helpers ──────────────────────────────────────────────────
    def price(self, *, currency: str, cycle: str) -> Decimal | int:
        """Return the configured price for a (currency, cycle) pair.

        Raises ``ValueError`` for unknown currency or cycle.
        """
        currency = currency.upper()
        cycle = cycle.lower()
        if cycle not in {"monthly", "annual"}:
            raise ValueError(f"unknown billing cycle: {cycle!r}")
        if currency == "IQD":
            return self.price_iqd_monthly if cycle == "monthly" else self.price_iqd_annual
        if currency == "USD":
            return self.price_usd_monthly if cycle == "monthly" else self.price_usd_annual
        raise ValueError(f"unsupported currency: {currency!r}")

    def stripe_lookup_key(self, *, currency: str, cycle: str) -> str:
        """Stable lookup key used by the bootstrap script for idempotency."""
        return f"{self.slug}_{currency.lower()}_{cycle.lower()}"

    def limit(self, key: str, default: int = 0) -> int:
        return int(self.limits.get(key, default))

    def has_feature(self, key: str) -> bool:
        return bool(self.features.get(key, False))


# ── Catalogue ────────────────────────────────────────────────────────────

PLANS: Dict[str, Plan] = {
    "starter": Plan(
        slug="starter",
        name_ku="سەرەتایی",
        name_en="Starter",
        price_iqd_monthly=30_000,
        price_usd_monthly=Decimal("25.00"),
        price_iqd_annual=300_000,                    # 2 months free
        price_usd_annual=Decimal("250.00"),
        limits={
            "users": 3,
            "tenants": 1,
            "invoices_per_month": 100,
            "pos_terminals": 1,
            "storage_gb": 5,
        },
        features={
            "multi_currency": False,
            "api_access": False,
            "priority_support": False,
            "sso": False,
            "custom_reports": False,
            "advanced_inventory": False,
        },
    ),
    "growth": Plan(
        slug="growth",
        name_ku="گەشە",
        name_en="Growth",
        price_iqd_monthly=80_000,
        price_usd_monthly=Decimal("60.00"),
        price_iqd_annual=800_000,
        price_usd_annual=Decimal("600.00"),
        limits={
            "users": 10,
            "tenants": 3,
            "invoices_per_month": 1_000,
            "pos_terminals": 5,
            "storage_gb": 50,
        },
        features={
            "multi_currency": True,
            "api_access": True,
            "priority_support": False,
            "sso": False,
            "custom_reports": True,
            "advanced_inventory": True,
        },
    ),
    "pro": Plan(
        slug="pro",
        name_ku="پیشەیی",
        name_en="Pro",
        price_iqd_monthly=200_000,
        price_usd_monthly=Decimal("150.00"),
        price_iqd_annual=2_000_000,
        price_usd_annual=Decimal("1500.00"),
        limits={
            "users": 50,
            "tenants": -1,                            # unlimited
            "invoices_per_month": -1,                 # unlimited
            "pos_terminals": -1,                      # unlimited
            "storage_gb": 500,
        },
        features={
            "multi_currency": True,
            "api_access": True,
            "priority_support": True,
            "sso": True,
            "custom_reports": True,
            "advanced_inventory": True,
        },
    ),
}


def get_plan(slug: str) -> Plan:
    """Return the plan by slug, raising ``KeyError`` if unknown."""
    if slug not in PLANS:
        raise KeyError(f"unknown plan slug: {slug!r}")
    return PLANS[slug]


def list_plans(*, public_only: bool = True) -> List[Plan]:
    """Return plans in display order. Default hides legacy/internal plans."""
    plans = list(PLANS.values())
    if public_only:
        plans = [p for p in plans if p.is_public]
    # Display order matches the catalogue insertion order (starter → growth → pro).
    return plans


# ── Cycle metadata used by the frontend ──────────────────────────────────

ANNUAL_DISCOUNT_MONTHS = 2     # "two months free" copy.
DEFAULT_TRIAL_DAYS = 90        # § R5 — 90-day trial by default.

# Stripe-side decimal handling: USD uses 2-decimal cents, IQD has no decimals.
# Stripe still requires "smallest unit" amounts, so multiply USD by 100 and
# pass IQD as-is.
ZERO_DECIMAL_CURRENCIES = {"IQD", "JPY", "KRW", "VND"}


def to_stripe_amount(amount: Decimal | int, currency: str) -> int:
    """Convert a plan price into Stripe's smallest-unit integer."""
    currency = currency.upper()
    if currency in ZERO_DECIMAL_CURRENCIES:
        return int(amount)
    # USD / EUR / GBP / etc.: cents.
    return int(Decimal(amount) * 100)
