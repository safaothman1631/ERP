"""Property and unit tests for journal entry balance validation."""
import pytest
from decimal import Decimal
from fastapi import HTTPException
from hypothesis import given, settings as h_settings
from hypothesis import strategies as st

from app.services.je_validation import validate_je_balance


class TestValidateJeBalance:
    def test_balanced_two_lines_passes(self):
        lines = [
            {"account_id": "a1", "debit": 100, "credit": 0},
            {"account_id": "a2", "debit": 0, "credit": 100},
        ]
        validate_je_balance(lines, "IQD")  # no raise

    def test_unbalanced_raises_422(self):
        lines = [
            {"account_id": "a1", "debit": 100, "credit": 0},
            {"account_id": "a2", "debit": 0, "credit": 99},
        ]
        with pytest.raises(HTTPException) as exc:
            validate_je_balance(lines, "IQD")
        assert exc.value.status_code == 422
        assert exc.value.detail["code"] == "je_unbalanced"

    def test_single_line_rejected(self):
        with pytest.raises(HTTPException) as exc:
            validate_je_balance([{"debit": 10, "credit": 0}], "IQD")
        assert exc.value.detail["code"] == "je_min_lines"

    def test_both_debit_and_credit_rejected(self):
        lines = [
            {"debit": 50, "credit": 50},
            {"debit": 0, "credit": 50},
        ]
        with pytest.raises(HTTPException) as exc:
            validate_je_balance(lines, "IQD")
        assert exc.value.detail["code"] == "je_both_sides"

    def test_negative_amount_rejected(self):
        lines = [
            {"debit": -10, "credit": 0},
            {"debit": 0, "credit": 10},
        ]
        with pytest.raises(HTTPException) as exc:
            validate_je_balance(lines, "IQD")
        assert exc.value.detail["code"] == "je_negative_amount"

    def test_iqd_half_cent_tolerance(self):
        lines = [
            {"debit": Decimal("100.004"), "credit": 0},
            {"debit": 0, "credit": Decimal("100.000")},
        ]
        validate_je_balance(lines, "IQD")

    def test_usd_stricter_tolerance(self):
        lines = [
            {"debit": 100.02, "credit": 0},
            {"debit": 0, "credit": 100},
        ]
        with pytest.raises(HTTPException):
            validate_je_balance(lines, "USD")


@h_settings(max_examples=100)
@given(
    amount=st.decimals(min_value=Decimal("0.01"), max_value=Decimal("999999"), places=2),
)
def test_property_balanced_je_always_passes(amount: Decimal):
    """Any JE with equal debit/credit passes validation."""
    amt = float(amount)
    lines = [
        {"debit": amt, "credit": 0},
        {"debit": 0, "credit": amt},
    ]
    validate_je_balance(lines, "IQD")


@h_settings(max_examples=100)
@given(
    debit=st.decimals(min_value=Decimal("1"), max_value=Decimal("9999"), places=2),
    credit=st.decimals(min_value=Decimal("1"), max_value=Decimal("9999"), places=2),
)
def test_property_unbalanced_je_rejected(debit: Decimal, credit: Decimal):
    """Unbalanced pairs (beyond tolerance) are rejected."""
    d, c = float(debit), float(credit)
    if abs(d - c) <= 0.005:
        return
    lines = [{"debit": d, "credit": 0}, {"debit": 0, "credit": c}]
    with pytest.raises(HTTPException) as exc:
        validate_je_balance(lines, "IQD")
    assert exc.value.detail["code"] == "je_unbalanced"
