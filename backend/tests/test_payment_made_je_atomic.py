"""A2.8 — Bill payment + JE in one Firestore transaction."""
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest


def test_create_payment_made_with_je_requires_lines():
    from app.services.bill_payments import create_payment_made_with_je_atomic

    with pytest.raises(ValueError, match="je_lines_required"):
        create_payment_made_with_je_atomic(
            "org-1",
            "pay-1",
            {"bill_id": "b1", "amount": 10},
            je_lines=[],
        )


def test_create_payment_made_with_je_single_transaction():
    """Payment doc, bill balance, and JE are written in the same transaction."""
    from app.services.bill_payments import create_payment_made_with_je_atomic

    mock_db = MagicMock()
    tx = MagicMock()
    mock_db.transaction.return_value = tx

    bill_snap = MagicMock()
    bill_snap.exists = True
    bill_snap.to_dict.return_value = {
        "org_id": "org-1",
        "balance_due": 100.0,
        "total": 100.0,
        "status": "open",
    }
    bill_ref = MagicMock()
    bill_ref.get.return_value = bill_snap

    pay_ref = MagicMock()
    pay_coll = MagicMock()
    pay_coll.document.return_value = pay_ref
    bill_coll = MagicMock()
    bill_coll.document.return_value = bill_ref

    def _collection(name: str):
        if name == "bills":
            return bill_coll
        if name == "payments_made":
            return pay_coll
        return MagicMock()

    mock_db.collection.side_effect = _collection
    fake_journal = {"id": "je-1", "entry_number": "JOU-000042"}

    je_lines = [
        {"account_id": "ap-1", "debit": 50, "credit": 0},
        {"account_id": "cash-1", "debit": 0, "credit": 50},
    ]

    with patch("app.services.bill_payments.get_db", return_value=mock_db), patch(
        "app.services.bill_payments.fs.transactional", lambda f: f
    ), patch("app.services.bill_payments.cache.delete"    ), patch(
        "app.services.org_counters.transition_bill_counters"
    ), patch(
        "app.services.journal_entry_atomic.create_journal_entry_in_transaction",
        return_value=(fake_journal, ["ap-1", "cash-1"]),
    ) as mock_je_in_tx:
        result = create_payment_made_with_je_atomic(
            "org-1",
            "pay-1",
            {
                "bill_id": "bill-1",
                "amount": 50,
                "date": "2026-05-26",
                "payment_number": "PM-001",
            },
            je_lines=je_lines,
            je_description="Vendor payment",
            created_by="user-1",
        )

    assert result["journal_entry_id"] == "je-1"
    assert result["bill_balance_due"] == 50.0
    mock_je_in_tx.assert_called_once()
    assert mock_je_in_tx.call_args[0][0] is tx
    assert any(call.args[0] is pay_ref for call in tx.set.call_args_list)
    assert any(call.args[0] is bill_ref for call in tx.update.call_args_list)


def test_void_payment_made_atomic_not_found():
    from app.services.bill_payments import void_payment_made_atomic

    mock_db = MagicMock()
    pay_snap = MagicMock()
    pay_snap.exists = False
    mock_db.collection.return_value.document.return_value.get.return_value = pay_snap

    with patch("app.services.bill_payments.get_db", return_value=mock_db), patch(
        "app.services.bill_payments.fs.transactional", lambda f: f
    ):
        with pytest.raises(ValueError, match="payment_not_found"):
            void_payment_made_atomic("org-1", "pay-x")


def test_void_payment_made_atomic_restores_bill_balance():
    from app.services.bill_payments import void_payment_made_atomic

    mock_db = MagicMock()
    tx = MagicMock()
    mock_db.transaction.return_value = tx

    pay_snap = MagicMock()
    pay_snap.exists = True
    pay_snap.to_dict.return_value = {
        "org_id": "org-1",
        "status": "completed",
        "bill_id": "bill-1",
        "amount": 40.0,
    }
    pay_ref = MagicMock()
    pay_ref.get.return_value = pay_snap

    bill_snap = MagicMock()
    bill_snap.exists = True
    bill_snap.to_dict.return_value = {
        "org_id": "org-1",
        "balance_due": 10.0,
        "total": 100.0,
        "status": "partially_paid",
    }
    bill_ref = MagicMock()
    bill_ref.get.return_value = bill_snap

    pay_coll = MagicMock()
    pay_coll.document.return_value = pay_ref
    bill_coll = MagicMock()
    bill_coll.document.return_value = bill_ref

    def _collection(name: str):
        if name == "payments_made":
            return pay_coll
        if name == "bills":
            return bill_coll
        return MagicMock()

    mock_db.collection.side_effect = _collection

    with patch("app.services.bill_payments.get_db", return_value=mock_db), patch(
        "app.services.bill_payments.fs.transactional", lambda f: f
    ), patch("app.services.bill_payments.cache.delete"), patch(
        "app.services.org_counters.transition_bill_counters"
    ):
        result = void_payment_made_atomic("org-1", "pay-1")

    assert result["status"] == "void"
    bill_update = next(
        c for c in tx.update.call_args_list if c.args[0] is bill_ref
    )
    assert bill_update.args[1]["balance_due"] == 50.0
    assert bill_update.args[1]["status"] == "partially_paid"
