"""Tests for aged AR/AP bucket math."""
from datetime import date
from decimal import Decimal

from app.services.aged_reports import build_aged_buckets, build_partner_ledger


def test_aged_buckets_single_customer():
    docs = [
        {
            "contact_id": "c1",
            "contact_name": "Customer A",
            "balance_due": 100,
            "due_date": "2026-05-01",
        },
        {
            "contact_id": "c1",
            "contact_name": "Customer A",
            "balance_due": 200,
            "due_date": "2026-03-01",
        },
    ]
    result = build_aged_buckets(docs, date(2026, 5, 25))
    assert "c1" in result
    row = result["c1"]
    assert row["total"] == 300.0
    assert row["b_0_30"] == 100.0
    assert row["b_61_90"] == 200.0


def test_aged_buckets_ignores_zero_balance():
    docs = [{"contact_id": "c1", "balance_due": 0, "due_date": "2026-05-01"}]
    assert build_aged_buckets(docs, date(2026, 5, 25)) == {}


def test_partner_ledger_running_balance():
    lines = [
        {"date": "2026-01-01", "debit": 100, "credit": 0, "doc_number": "INV-1"},
        {"date": "2026-01-15", "debit": 0, "credit": 40, "doc_number": "PAY-1"},
    ]
    out = build_partner_ledger(lines, Decimal("10"))
    assert out["opening_balance"] == 10.0
    assert out["closing_balance"] == 70.0
    assert out["lines"][0]["running_balance"] == 110.0
    assert out["lines"][1]["running_balance"] == 70.0
