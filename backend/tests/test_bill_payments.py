"""Atomic AP payment + bill balance."""
from unittest.mock import MagicMock, patch

import pytest


def test_apply_bill_payment_atomic_missing_bill():
    from app.services.bill_payments import apply_bill_payment_atomic

    mock_db = MagicMock()
    mock_snap = MagicMock()
    mock_snap.exists = False
    mock_db.collection.return_value.document.return_value.get.return_value = mock_snap

    with patch("app.services.bill_payments.get_db", return_value=mock_db):
        with patch("app.services.bill_payments.fs.transactional", lambda f: f):
            assert apply_bill_payment_atomic("org-1", "bill-x", 10.0) is None


def test_create_payment_made_atomic_bill_not_found():
    from app.services.bill_payments import create_payment_made_atomic

    mock_db = MagicMock()
    mock_snap = MagicMock()
    mock_snap.exists = False
    mock_db.collection.return_value.document.return_value.get.return_value = mock_snap

    with patch("app.services.bill_payments.get_db", return_value=mock_db):
        with patch("app.services.bill_payments.fs.transactional", lambda f: f):
            with pytest.raises(ValueError, match="bill_not_found"):
                create_payment_made_atomic(
                    "org-1",
                    "pay-1",
                    {"bill_id": "bill-x", "amount": 50},
                )
