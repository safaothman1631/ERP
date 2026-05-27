"""Phase T1 — Accounting integrity tests (plan Phase 1 / test_accounting_integrity.py)."""
import pytest
from fastapi import HTTPException
from hypothesis import given, settings as h_settings
from hypothesis import strategies as st

from app.services.je_validation import validate_je_balance


class TestJournalEntryIntegrity:
    def test_balanced_entry(self):
        validate_je_balance([
            {"debit": 1000, "credit": 0},
            {"debit": 0, "credit": 1000},
        ], "IQD")

    def test_unbalanced_rejected(self):
        with pytest.raises(HTTPException) as exc:
            validate_je_balance([
                {"debit": 100, "credit": 0},
                {"debit": 0, "credit": 99},
            ], "IQD")
        assert exc.value.status_code == 422

    @h_settings(max_examples=30, deadline=None)
    @given(st.floats(min_value=0.01, max_value=1_000_000, allow_nan=False, allow_infinity=False))
    def test_property_balanced_pairs(self, amount: float):
        amt = round(amount, 2)
        validate_je_balance([
            {"debit": amt, "credit": 0},
            {"debit": 0, "credit": amt},
        ], "IQD")


class TestPeriodLockIntegration:
    def test_period_close_service_importable(self):
        from app.services.period_close import PeriodCloseService
        assert PeriodCloseService is not None
