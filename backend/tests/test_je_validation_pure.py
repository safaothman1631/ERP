"""Pure-logic unit tests for double-entry journal validation.

Targets ``app.services.je_validation.validate_je_balance`` — a pure function
(Decimal math + FastAPI HTTPException, no Firestore/network). Covers balanced
vs unbalanced entries, the minimum-lines rule, sign/both-sides rules, and the
per-currency rounding tolerance (IQD half-cent vs USD one-cent).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import HTTPException

from app.services.je_validation import validate_je_balance


def _detail_code(exc_info: pytest.ExceptionInfo[HTTPException]) -> str:
    return exc_info.value.detail["code"]


# ─────────────────────────────────────────────────────────────────────────
# Balanced entries pass silently
# ─────────────────────────────────────────────────────────────────────────


def test_balanced_two_line_entry_passes():
    lines = [
        {"debit": 100, "credit": 0},
        {"debit": 0, "credit": 100},
    ]
    # Returns None and raises nothing when balanced.
    assert validate_je_balance(lines, "IQD") is None


def test_balanced_multi_line_entry_passes():
    lines = [
        {"debit": 250000, "credit": 0},
        {"debit": 0, "credit": 100000},
        {"debit": 0, "credit": 150000},
    ]
    assert validate_je_balance(lines, "IQD") is None


def test_decimal_string_amounts_balance():
    # Amounts arriving as strings must be coerced via Decimal(str(...)).
    lines = [
        {"debit": "1234.56", "credit": 0},
        {"debit": 0, "credit": "1234.56"},
    ]
    assert validate_je_balance(lines, "USD") is None


# ─────────────────────────────────────────────────────────────────────────
# Unbalanced / structural failures raise 422 with a stable code
# ─────────────────────────────────────────────────────────────────────────


def test_unbalanced_entry_raises():
    lines = [
        {"debit": 100, "credit": 0},
        {"debit": 0, "credit": 90},
    ]
    with pytest.raises(HTTPException) as exc:
        validate_je_balance(lines, "IQD")
    assert exc.value.status_code == 422
    assert _detail_code(exc) == "je_unbalanced"
    # Diff is reported back for the UI.
    assert exc.value.detail["diff"] == pytest.approx(10.0)


def test_single_line_entry_rejected():
    with pytest.raises(HTTPException) as exc:
        validate_je_balance([{"debit": 100, "credit": 0}], "IQD")
    assert _detail_code(exc) == "je_min_lines"


def test_empty_entry_rejected():
    with pytest.raises(HTTPException) as exc:
        validate_je_balance([], "IQD")
    assert _detail_code(exc) == "je_min_lines"


def test_negative_amount_rejected():
    lines = [
        {"debit": -50, "credit": 0},
        {"debit": 0, "credit": -50},
    ]
    with pytest.raises(HTTPException) as exc:
        validate_je_balance(lines, "IQD")
    assert _detail_code(exc) == "je_negative_amount"
    assert exc.value.detail["line_index"] == 0


def test_line_with_both_debit_and_credit_rejected():
    lines = [
        {"debit": 100, "credit": 100},
        {"debit": 0, "credit": 100},
    ]
    with pytest.raises(HTTPException) as exc:
        validate_je_balance(lines, "IQD")
    assert _detail_code(exc) == "je_both_sides"
    assert exc.value.detail["line_index"] == 0


def test_invalid_amount_string_raises_422():
    lines = [
        {"debit": "not-a-number", "credit": 0},
        {"debit": 0, "credit": 100},
    ]
    with pytest.raises(HTTPException) as exc:
        validate_je_balance(lines, "IQD")
    assert _detail_code(exc) == "je_invalid_amount"


# ─────────────────────────────────────────────────────────────────────────
# Per-currency rounding tolerance
# ─────────────────────────────────────────────────────────────────────────


def test_iqd_within_half_cent_tolerance_passes():
    # diff = 0.004 <= IQD tolerance 0.005 → balanced.
    lines = [
        {"debit": "100.000", "credit": 0},
        {"debit": 0, "credit": "100.004"},
    ]
    assert validate_je_balance(lines, "IQD") is None


def test_iqd_just_over_tolerance_fails():
    # diff = 0.006 > IQD tolerance 0.005 → unbalanced.
    lines = [
        {"debit": "100.000", "credit": 0},
        {"debit": 0, "credit": "100.006"},
    ]
    with pytest.raises(HTTPException) as exc:
        validate_je_balance(lines, "IQD")
    assert _detail_code(exc) == "je_unbalanced"


def test_usd_tolerance_is_one_cent():
    # diff = 0.01 <= USD tolerance 0.01 → balanced (boundary, inclusive).
    lines = [
        {"debit": "100.00", "credit": 0},
        {"debit": 0, "credit": "100.01"},
    ]
    assert validate_je_balance(lines, "USD") is None


def test_unknown_currency_uses_default_tolerance():
    # diff = 0.02 > default tolerance 0.01 → unbalanced for an unmapped code.
    lines = [
        {"debit": "100.00", "credit": 0},
        {"debit": 0, "credit": "100.02"},
    ]
    with pytest.raises(HTTPException) as exc:
        validate_je_balance(lines, "ZZZ")
    assert _detail_code(exc) == "je_unbalanced"


def test_currency_code_is_case_insensitive():
    # Lower-case "iqd" must resolve to the IQD tolerance (uppercased internally).
    lines = [
        {"debit": "100.000", "credit": 0},
        {"debit": 0, "credit": "100.004"},
    ]
    assert validate_je_balance(lines, "iqd") is None
