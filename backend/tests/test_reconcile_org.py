"""Unit tests for reconciliation drift math."""
from app.services.reconciliation import (
    TOLERANCE,
    compute_bank_drift,
    compute_bill_balance_drift,
    compute_invoice_balance_drift,
    compute_stock_drift,
)


def test_invoice_drift_detected():
    inv = {"id": "inv-1", "total": 1000, "balance_due": 500}
    row = compute_invoice_balance_drift(inv, [400.0])
    assert row is not None
    assert row.computed == 600.0
    assert row.delta == 100.0


def test_invoice_no_drift_within_tolerance():
    inv = {"id": "inv-1", "total": 100.0, "balance_due": 50.0}
    assert compute_invoice_balance_drift(inv, [50.0]) is None


def test_stock_drift():
    item = {"id": "it-1", "is_trackable": True, "stock_on_hand": 10, "opening_stock": 0}
    row = compute_stock_drift(item, [5.0, 3.0])
    assert row is not None
    assert row.computed == 8.0


def test_bank_drift_credit_debit():
    account = {
        "id": "ba-1",
        "opening_balance": 100,
        "current_balance": 200,
    }
    txns = [
        {"transaction_type": "credit", "amount": 50, "reconciled": True},
        {"transaction_type": "debit", "amount": 25, "reconciled": True},
    ]
    row = compute_bank_drift(account, txns)
    assert row is not None
    assert row.computed == 125.0
    assert row.delta == 75.0


def test_bill_drift():
    bill = {"id": "bill-1", "total": 500, "balance_due": 200}
    row = compute_bill_balance_drift(bill, [400.0])
    assert row is not None
    assert row.computed == 100.0
    assert row.delta == 100.0


def test_tolerance_constant():
    assert TOLERANCE == 0.01
