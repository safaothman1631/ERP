"""Pure-logic unit tests for currency math/formatting helpers.

Targets ``app.utils.currency`` (``convert_amount`` + ``format_currency``).
Both are pure functions using ``decimal`` only — no Firestore/network. Covers
Decimal half-up rounding on conversion and the IQD-default formatting.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.utils.currency import convert_amount, format_currency


# ─────────────────────────────────────────────────────────────────────────
# convert_amount — Decimal multiply, quantize to 2dp, ROUND_HALF_UP
# ─────────────────────────────────────────────────────────────────────────


def test_convert_amount_basic():
    # 100 USD @ 1320 IQD/USD = 132000.
    assert convert_amount(100, 1320) == 132000.0


def test_convert_amount_two_decimal_quantize():
    # 10 * 1.005 = 10.05 exactly.
    assert convert_amount(10, 1.005) == 10.05


def test_convert_amount_rounds_half_up():
    # 1 * 1.005 = 1.005 → ROUND_HALF_UP → 1.01 (banker's rounding would give 1.00).
    assert convert_amount(1, 1.005) == 1.01


def test_convert_amount_rounds_down_below_half():
    # 1 * 1.004 = 1.004 → 1.00.
    assert convert_amount(1, 1.004) == 1.00


def test_convert_amount_zero():
    assert convert_amount(0, 1320) == 0.0


def test_convert_amount_returns_float():
    assert isinstance(convert_amount(100, 1.5), float)


# ─────────────────────────────────────────────────────────────────────────
# format_currency — thousands separators + symbol, IQD default (0 decimals)
# ─────────────────────────────────────────────────────────────────────────


def test_format_currency_default_is_iqd_no_decimals():
    # Default symbol is the Arabic IQD glyph, default 0 decimal places.
    assert format_currency(1500000) == "1,500,000 د.ع"


def test_format_currency_rounds_to_zero_decimals_by_default():
    # 1234.56 with 0 decimal places → "1,235".
    assert format_currency(1234.56) == "1,235 د.ع"


def test_format_currency_with_two_decimals():
    assert format_currency(1234.5, symbol="$", decimal_places=2) == "1,234.50 $"


def test_format_currency_custom_symbol():
    assert format_currency(1000, symbol="USD", decimal_places=0) == "1,000 USD"


def test_format_currency_zero():
    assert format_currency(0) == "0 د.ع"
