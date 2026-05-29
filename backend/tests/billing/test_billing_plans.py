"""Tests for the SaaS plan catalogue (launch-readiness § R5.1)."""
from decimal import Decimal

import pytest

from app.billing.plans import (
    DEFAULT_TRIAL_DAYS,
    PLANS,
    Plan,
    get_plan,
    list_plans,
    to_stripe_amount,
    ZERO_DECIMAL_CURRENCIES,
)


def test_three_plans_exist_in_display_order():
    plans = list_plans()
    assert [p.slug for p in plans] == ["starter", "growth", "pro"]


def test_starter_pricing_matches_spec():
    p = get_plan("starter")
    assert p.price_iqd_monthly == 30_000
    assert p.price_usd_monthly == Decimal("25.00")
    assert p.price_iqd_annual == 300_000
    assert p.price_usd_annual == Decimal("250.00")
    assert p.limits["users"] == 3


def test_growth_features_include_api_access():
    p = get_plan("growth")
    assert p.has_feature("api_access") is True
    assert p.has_feature("sso") is False


def test_pro_unlocks_sso_and_priority_support():
    p = get_plan("pro")
    assert p.features["sso"] is True
    assert p.features["priority_support"] is True
    # Pro is "unlimited" for several limits.
    assert p.limits["tenants"] == -1
    assert p.limits["invoices_per_month"] == -1


def test_price_helper_returns_correct_combo():
    p = get_plan("growth")
    assert p.price(currency="IQD", cycle="monthly") == 80_000
    assert p.price(currency="USD", cycle="annual") == Decimal("600.00")


def test_price_helper_raises_on_bad_currency():
    p = get_plan("growth")
    with pytest.raises(ValueError):
        p.price(currency="EUR", cycle="monthly")
    with pytest.raises(ValueError):
        p.price(currency="USD", cycle="weekly")


def test_stripe_lookup_key_is_stable():
    p = get_plan("starter")
    assert p.stripe_lookup_key(currency="USD", cycle="monthly") == "starter_usd_monthly"


def test_to_stripe_amount_zero_decimal_iqd_passthrough():
    assert to_stripe_amount(30_000, "IQD") == 30_000


def test_to_stripe_amount_usd_converts_to_cents():
    assert to_stripe_amount(Decimal("25.00"), "USD") == 2500
    assert to_stripe_amount(Decimal("150.50"), "USD") == 15050


def test_iqd_is_zero_decimal():
    assert "IQD" in ZERO_DECIMAL_CURRENCIES


def test_default_trial_is_90_days():
    assert DEFAULT_TRIAL_DAYS == 90


def test_unknown_plan_raises():
    with pytest.raises(KeyError):
        get_plan("enterprise-plus")
