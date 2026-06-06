"""P0 Fix 2 — customer receipt posts Dr Cash / Cr AR in the SAME transaction
as the invoice balance update. AR mirror of test_payment_made_je_atomic.py.
"""
import uuid
from unittest.mock import MagicMock, patch

import pytest


def _build_mock_db(inv_dict):
    mock_db = MagicMock()
    tx = MagicMock()
    mock_db.transaction.return_value = tx

    inv_snap = MagicMock()
    inv_snap.exists = inv_dict is not None
    inv_snap.to_dict.return_value = inv_dict or {}
    inv_ref = MagicMock()
    inv_ref.get.return_value = inv_snap

    pay_ref = MagicMock()
    pay_coll = MagicMock()
    pay_coll.document.return_value = pay_ref
    inv_coll = MagicMock()
    inv_coll.document.return_value = inv_ref

    def _collection(name):
        if name == "invoices":
            return inv_coll
        if name == "payments_received":
            return pay_coll
        return MagicMock()

    mock_db.collection.side_effect = _collection
    return mock_db, tx, pay_ref, inv_ref


def test_receipt_posts_balanced_je_in_same_transaction():
    from app.services.invoice_payments import create_payment_received_with_je_atomic

    mock_db, tx, pay_ref, inv_ref = _build_mock_db(
        {"org_id": "org-1", "balance_due": 1_000_000.0, "total": 1_000_000.0, "status": "sent"}
    )
    fake_journal = {"id": "je-1", "entry_number": "JOU-000099"}

    with patch("app.services.invoice_payments.get_db", return_value=mock_db), \
         patch("app.services.invoice_payments.fs.transactional", lambda f: f), \
         patch("app.services.invoice_payments.cache.delete"), \
         patch("app.services.org_counters.transition_invoice_counters"), \
         patch("app.services.journal_entry_atomic.create_journal_entry_in_transaction",
               return_value=(fake_journal, ["cash-1", "ar-1"])) as je_in_tx:
        result = create_payment_received_with_je_atomic(
            "org-1", "pay-1",
            {"invoice_id": "inv-1", "amount": 1_000_000, "date": "2026-06-01", "payment_number": "RCP-1"},
            deposit_account_id="cash-1", ar_account_id="ar-1", created_by="u-1",
        )

    # JE stamped on the payment doc
    assert result["journal_entry_id"] == "je-1"
    je_in_tx.assert_called_once()
    # same transaction object
    assert je_in_tx.call_args[0][0] is tx
    # JE is balanced and equals the receipt total
    lines = je_in_tx.call_args.kwargs["lines"]
    assert sum(l["debit"] for l in lines) == sum(l["credit"] for l in lines) == 1_000_000.0
    # Dr Cash, Cr AR
    assert lines[0]["account_id"] == "cash-1" and lines[0]["debit"] == 1_000_000.0
    assert lines[1]["account_id"] == "ar-1" and lines[1]["credit"] == 1_000_000.0
    # deterministic idempotent entry id (uuid5 of receipt-je:pay-1)
    assert je_in_tx.call_args.kwargs["entry_id"] == str(
        uuid.uuid5(uuid.NAMESPACE_URL, "receipt-je:pay-1")
    )
    # payment doc written + invoice balance updated, in the same tx
    assert any(call.args[0] is pay_ref for call in tx.set.call_args_list)
    inv_update = next(c for c in tx.update.call_args_list if c.args[0] is inv_ref)
    # full payment closes the invoice
    assert inv_update.args[1]["status"] == "paid"
    assert inv_update.args[1]["balance_due"] == 0.0


def test_receipt_partial_keeps_partially_paid():
    from app.services.invoice_payments import create_payment_received_with_je_atomic

    mock_db, tx, pay_ref, inv_ref = _build_mock_db(
        {"org_id": "org-1", "balance_due": 1_000_000.0, "total": 1_000_000.0, "status": "sent"}
    )
    with patch("app.services.invoice_payments.get_db", return_value=mock_db), \
         patch("app.services.invoice_payments.fs.transactional", lambda f: f), \
         patch("app.services.invoice_payments.cache.delete"), \
         patch("app.services.org_counters.transition_invoice_counters"), \
         patch("app.services.journal_entry_atomic.create_journal_entry_in_transaction",
               return_value=({"id": "je-2"}, [])):
        create_payment_received_with_je_atomic(
            "org-1", "pay-2",
            {"invoice_id": "inv-1", "amount": 400_000, "payment_number": "RCP-2"},
            deposit_account_id="cash-1", ar_account_id="ar-1",
        )
    inv_update = next(c for c in tx.update.call_args_list if c.args[0] is inv_ref)
    assert inv_update.args[1]["status"] == "partially_paid"
    assert inv_update.args[1]["balance_due"] == 600_000.0


def test_receipt_invoice_not_found_raises():
    from app.services.invoice_payments import create_payment_received_with_je_atomic

    mock_db, tx, pay_ref, inv_ref = _build_mock_db(None)  # snap.exists == False
    with patch("app.services.invoice_payments.get_db", return_value=mock_db), \
         patch("app.services.invoice_payments.fs.transactional", lambda f: f), \
         patch("app.services.invoice_payments.cache.delete"), \
         patch("app.services.journal_entry_atomic.create_journal_entry_in_transaction",
               return_value=({"id": "je-3"}, [])):
        with pytest.raises(ValueError, match="invoice_not_found"):
            create_payment_received_with_je_atomic(
                "org-1", "pay-3",
                {"invoice_id": "missing", "amount": 100, "payment_number": "RCP-3"},
                deposit_account_id="cash-1", ar_account_id="ar-1",
            )
