"""Pure-logic unit tests for the Iraqi withholding-tax CALCULATION path.

Targets ``app.tax.withholding.WHTCalculator.calculate`` — a pure function
(stdlib only: dataclasses/enum/typing; self-contained ``_round``). This file
focuses on the *math/eligibility* outcomes (rate boundaries 0/2/3/5 %, B2B vs
B2C vs B2G eligibility, rounding, override) and intentionally does NOT repeat
the rate-registry assertions already covered by ``test_withholding.py``.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.tax.withholding import (
    DEFAULT_CALCULATOR,
    WHTCalculator,
    WithholdingType,
)


# ─────────────────────────────────────────────────────────────────────────
# Rate boundaries: services 3 %, rent 5 %, materials 2 %, other 0 %
# ─────────────────────────────────────────────────────────────────────────


def test_services_b2b_withholds_3_percent():
    b = DEFAULT_CALCULATOR.calculate(1000.0, WithholdingType.SERVICES, "b2b")
    assert b.applied is True
    assert b.wht_rate == 3.0
    assert b.wht_withheld == 30.0
    assert b.net_payable == 970.0


def test_rent_b2b_withholds_5_percent():
    b = DEFAULT_CALCULATOR.calculate(2000.0, WithholdingType.RENT, "b2b")
    assert b.applied is True
    assert b.wht_withheld == 100.0
    assert b.net_payable == 1900.0


def test_materials_b2b_withholds_2_percent():
    b = DEFAULT_CALCULATOR.calculate(5000.0, WithholdingType.MATERIALS, "b2b")
    assert b.applied is True
    assert b.wht_withheld == 100.0
    assert b.net_payable == 4900.0


def test_other_zero_rate_not_applied():
    # OTHER carries a 0 % rate → nothing withheld, applied is False.
    b = DEFAULT_CALCULATOR.calculate(1000.0, WithholdingType.OTHER, "b2b")
    assert b.applied is False
    assert b.wht_withheld == 0.0
    assert b.net_payable == 1000.0
    assert b.reason_key == "zero_rate"


def test_string_wht_type_is_accepted():
    b = DEFAULT_CALCULATOR.calculate(1000.0, "services", "b2b")
    assert b.wht_rate == 3.0
    assert b.wht_withheld == 30.0


def test_unknown_wht_type_falls_back_to_other():
    # Unrecognised string → OTHER (0 %), so nothing is withheld.
    b = DEFAULT_CALCULATOR.calculate(1000.0, "made-up-type", "b2b")
    assert b.wht_type == WithholdingType.OTHER
    assert b.applied is False


# ─────────────────────────────────────────────────────────────────────────
# Customer-type eligibility: B2C exempt, B2G withholds
# ─────────────────────────────────────────────────────────────────────────


def test_b2c_consumer_is_exempt():
    b = DEFAULT_CALCULATOR.calculate(1000.0, WithholdingType.SERVICES, "b2c")
    assert b.applied is False
    assert b.wht_withheld == 0.0
    assert b.net_payable == 1000.0
    assert b.reason_key == "b2c_exempt"


def test_b2g_government_withholds():
    b = DEFAULT_CALCULATOR.calculate(1000.0, WithholdingType.SERVICES, "b2g")
    assert b.applied is True
    assert b.wht_withheld == 30.0


def test_is_business_false_maps_to_b2c():
    # Legacy boolean flag: False overrides customer_type to b2c (exempt).
    b = DEFAULT_CALCULATOR.calculate(
        1000.0, WithholdingType.SERVICES, "b2b", is_business=False
    )
    assert b.customer_type == "b2c"
    assert b.applied is False


# ─────────────────────────────────────────────────────────────────────────
# Edge cases: zero/negative gross, override rate, rounding
# ─────────────────────────────────────────────────────────────────────────


def test_zero_amount_not_applied():
    b = DEFAULT_CALCULATOR.calculate(0.0, WithholdingType.SERVICES, "b2b")
    assert b.applied is False
    assert b.reason_key == "zero_amount"
    assert b.gross_amount == 0.0


def test_negative_amount_clamped_to_zero():
    b = DEFAULT_CALCULATOR.calculate(-500.0, WithholdingType.SERVICES, "b2b")
    assert b.applied is False
    assert b.gross_amount == 0.0
    assert b.net_payable == 0.0


def test_override_rate_percent_used():
    # Tenant configures 4 % on services instead of the default 3 %.
    b = DEFAULT_CALCULATOR.calculate(
        1000.0, WithholdingType.SERVICES, "b2b", override_rate_percent=4.0
    )
    assert b.wht_rate == 4.0
    assert b.wht_withheld == 40.0
    assert b.net_payable == 960.0


def test_withheld_amount_is_rounded_to_two_decimals():
    # 333.33 * 3 % = 9.9999 → rounds to 10.0; net = 333.33 - 10.0 = 323.33.
    b = DEFAULT_CALCULATOR.calculate(333.33, WithholdingType.SERVICES, "b2b")
    assert b.wht_withheld == 10.0
    assert b.net_payable == 323.33


def test_gross_equals_withheld_plus_net_when_applied():
    b = DEFAULT_CALCULATOR.calculate(1234.56, WithholdingType.RENT, "b2b")
    assert b.applied is True
    assert b.wht_withheld + b.net_payable == pytest.approx(b.gross_amount)


def test_custom_calculator_instance_is_independent():
    # A fresh instance with default rates behaves identically to the singleton.
    calc = WHTCalculator()
    b = calc.calculate(1000.0, WithholdingType.SERVICES, "b2b")
    assert b.wht_withheld == 30.0
