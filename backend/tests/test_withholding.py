"""Tests for the Iraqi WHT calculator (growth-to-100 § R4.5)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.tax.withholding import (
    DEFAULT_CALCULATOR,
    DEFAULT_WHT_RATES,
    WHTCalculator,
    WithholdingType,
    placeholder_rate_count,
)


# ─────────────────────────────────────────────────────────────────────────
# Default rate semantics
# ─────────────────────────────────────────────────────────────────────────


def test_services_rate_is_3_percent_placeholder():
    rate = DEFAULT_WHT_RATES[WithholdingType.SERVICES]
    assert rate.rate_percent == 3.0
    assert rate.placeholder is True
    assert "خزمەتگوزاری" in rate.name_ku  # Kurdish label present


def test_rent_rate_is_5_percent():
    assert DEFAULT_WHT_RATES[WithholdingType.RENT].rate_percent == 5.0


def test_materials_rate_is_2_percent():
    assert DEFAULT_WHT_RATES[WithholdingType.MATERIALS].rate_percent == 2.0


def test_all_default_rates_flagged_placeholder_for_R71():
    assert placeholder_rate_count() == len(DEFAULT_WHT_RATES) == 4


# ─────────────────────────────────────────────────────────────────────────
# Happy path — B2B
# ─────────────────────────────────────────────────────────────────────────


def test_services_b2b_3_percent():
    r = DEFAULT_CALCULATOR.calculate(1_000_000, "services", "b2b")
    assert r.applied is True
    assert r.wht_rate == 3.0
    assert r.wht_withheld == 30_000.0
    assert r.net_payable == 970_000.0


def test_rent_b2b_5_percent():
    r = DEFAULT_CALCULATOR.calculate(500_000, WithholdingType.RENT, "b2b")
    assert r.wht_withheld == 25_000.0
    assert r.net_payable == 475_000.0


def test_materials_b2b_2_percent():
    r = DEFAULT_CALCULATOR.calculate(250_000, "materials", "b2b")
    assert r.wht_withheld == 5_000.0
    assert r.net_payable == 245_000.0


def test_b2g_treated_same_as_b2b():
    r = DEFAULT_CALCULATOR.calculate(1_000_000, "services", "b2g")
    assert r.applied is True
    assert r.wht_withheld == 30_000.0


# ─────────────────────────────────────────────────────────────────────────
# B2C exemption
# ─────────────────────────────────────────────────────────────────────────


def test_b2c_consumer_exempt():
    r = DEFAULT_CALCULATOR.calculate(1_000_000, "services", "b2c")
    assert r.applied is False
    assert r.wht_withheld == 0.0
    assert r.net_payable == 1_000_000.0
    assert r.reason_key == "b2c_exempt"


def test_is_business_false_alias_for_b2c():
    r = DEFAULT_CALCULATOR.calculate(
        1_000_000, "services", "b2b", is_business=False
    )
    assert r.applied is False
    assert r.customer_type == "b2c"


def test_is_business_true_alias_for_b2b():
    r = DEFAULT_CALCULATOR.calculate(
        1_000_000, "services", "b2c", is_business=True
    )
    assert r.applied is True
    assert r.customer_type == "b2b"


# ─────────────────────────────────────────────────────────────────────────
# Edge cases
# ─────────────────────────────────────────────────────────────────────────


def test_zero_amount_returns_zero():
    r = DEFAULT_CALCULATOR.calculate(0, "services", "b2b")
    assert r.applied is False  # zero gross → nothing to withhold
    assert r.wht_withheld == 0.0
    assert r.net_payable == 0.0


def test_negative_amount_clamped_to_zero():
    r = DEFAULT_CALCULATOR.calculate(-500, "services", "b2b")
    assert r.gross_amount == 0.0
    assert r.wht_withheld == 0.0


def test_unknown_wht_type_string_falls_back_to_other():
    r = DEFAULT_CALCULATOR.calculate(1000, "garbage", "b2b")
    assert r.wht_type == WithholdingType.OTHER
    # Other defaults to 0%
    assert r.wht_withheld == 0.0
    assert r.reason_key == "zero_rate"


def test_override_rate_takes_precedence():
    r = DEFAULT_CALCULATOR.calculate(
        1_000_000, "services", "b2b", override_rate_percent=4.5
    )
    assert r.wht_rate == 4.5
    assert r.wht_withheld == 45_000.0


def test_override_rate_zero_marks_not_applied():
    r = DEFAULT_CALCULATOR.calculate(
        1_000_000, "services", "b2b", override_rate_percent=0
    )
    assert r.applied is False
    assert r.wht_withheld == 0.0


def test_rounding_to_two_decimals():
    # 1234.567 × 3% = 37.03701 → rounds to 37.04
    r = DEFAULT_CALCULATOR.calculate(1234.567, "services", "b2b")
    assert r.wht_withheld == pytest.approx(37.04, abs=0.01)
    assert r.net_payable == pytest.approx(1197.53, abs=0.02)


def test_to_dict_serialisable():
    r = DEFAULT_CALCULATOR.calculate(1000, "services", "b2b")
    d = r.to_dict()
    assert isinstance(d, dict)
    assert d["wht_type"] == "services"  # enum → string
    assert d["wht_withheld"] == 30.0


def test_calculator_accepts_custom_rate_table():
    custom = dict(DEFAULT_WHT_RATES)
    services = DEFAULT_WHT_RATES[WithholdingType.SERVICES]
    # Replace with a tenant override at 10%
    from app.tax.withholding import WHTRate
    custom[WithholdingType.SERVICES] = WHTRate(
        wht_type=WithholdingType.SERVICES,
        rate_percent=10.0,
        name_en=services.name_en,
        name_ku=services.name_ku,
        name_ar=services.name_ar,
        placeholder=False,
    )
    calc = WHTCalculator(rates=custom)
    r = calc.calculate(1000, "services", "b2b")
    assert r.wht_withheld == 100.0
    assert r.placeholder_rate is False


def test_all_rates_returns_serialisable_rows():
    rows = DEFAULT_CALCULATOR.all_rates()
    assert len(rows) == 4
    assert {r["wht_type"] for r in rows} == {"services", "rent", "materials", "other"}
    for row in rows:
        assert row["placeholder"] is True  # all defaults flagged
