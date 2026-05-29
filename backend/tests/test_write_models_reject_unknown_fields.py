"""Wave V10 — write models validate declared fields."""
import pytest
from pydantic import ValidationError

from app.firestore.write_models import InvoiceWriteModel, PaymentReceivedWriteModel


def test_invoice_rejects_negative_total():
    with pytest.raises(ValidationError):
        InvoiceWriteModel(total=-1)


def test_payment_received_accepts_minimal():
    m = PaymentReceivedWriteModel(amount=10.0, contact_id="c1")
    assert m.amount == 10.0


def test_write_model_ignores_extra_keys():
    m = InvoiceWriteModel.model_validate({"total": 1.0, "unknown_field": "x"})
    assert m.total == 1.0
