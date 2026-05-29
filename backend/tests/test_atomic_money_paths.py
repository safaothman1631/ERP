"""Smoke tests for atomic money/inventory service entry points."""
from unittest.mock import MagicMock, patch

import pytest


def test_create_bank_transaction_atomic_account_not_found():
    from app.services.bank_transactions import create_bank_transaction_atomic

    mock_db = MagicMock()
    mock_snap = MagicMock()
    mock_snap.exists = False
    mock_db.collection.return_value.document.return_value.get.return_value = mock_snap

    with patch("app.services.bank_transactions.get_db", return_value=mock_db):
        with patch("app.services.bank_transactions.fs.transactional", lambda f: f):
            with pytest.raises(ValueError, match="bank_account_not_found"):
                create_bank_transaction_atomic(
                    "org-1",
                    "user-1",
                    bank_account_id="missing",
                    date="2026-01-01",
                    transaction_type="credit",
                    amount=10.0,
                )


def test_apply_invoice_payment_atomic_returns_none_for_missing():
    from app.services.invoice_payments import apply_invoice_payment_atomic

    mock_db = MagicMock()
    mock_snap = MagicMock()
    mock_snap.exists = False
    mock_db.collection.return_value.document.return_value.get.return_value = mock_snap

    with patch("app.services.invoice_payments.get_db", return_value=mock_db):
        with patch("app.services.invoice_payments.fs.transactional", lambda f: f):
            assert apply_invoice_payment_atomic("org-1", "inv-x", 10.0) is None


def test_pos_checkout_insufficient_stock():
    from app.services.pos_checkout import POSCheckoutError, checkout_order_atomic

    mock_line_repo = MagicMock()
    mock_line_repo.list.return_value = ([], 0)
    with patch("app.services.pos_checkout.get_db", return_value=MagicMock()):
        with patch(
            "app.firestore.pos.POSOrderLineRepository",
            return_value=mock_line_repo,
        ):
            with patch(
                "app.services.pos_checkout.validate_stock_for_lines",
                return_value={"code": "insufficient_stock", "item_id": "i1"},
            ):
                with pytest.raises(POSCheckoutError) as exc:
                    checkout_order_atomic("org-1", "ord-1", "u1", [], {})
                assert exc.value.code == "insufficient_stock"
