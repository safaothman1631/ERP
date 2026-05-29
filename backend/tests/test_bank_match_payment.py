"""Bank match create_payment uses PaymentReceived + record_payment."""
from unittest.mock import MagicMock, patch

from app.services.bank_matching_service import apply_match


@patch("app.services.accounting.AccountingService.create_payment_received_journal")
@patch("app.services.invoice_payments.create_payment_received_atomic")
@patch("app.services.numbering_service.get_next_number")
@patch("app.firestore.invoices.InvoiceRepository")
@patch("app.firestore.banking.BankTransactionRepository")
def test_apply_match_create_payment_invoice(
    mock_txn_cls,
    mock_inv_cls,
    mock_num,
    mock_atomic,
    mock_je,
):
    mock_txn_cls.return_value.get.return_value = {
        "id": "txn-1",
        "amount": 5000,
        "reference": "REF1",
    }
    mock_inv_cls.return_value.get.return_value = {
        "id": "inv-1",
        "contact_id": "c1",
        "balance_due": 5000,
        "total": 5000,
        "currency_code": "IQD",
    }
    mock_atomic.return_value = {"id": "pay-1", "payment_number": "RCP-1", "amount": 5000}
    mock_num.return_value = "RCP-001"

    result = apply_match("org-1", "txn-1", "invoice", "inv-1", "create_payment")
    assert result["payment_created"] is True
    assert result["payment_id"] == "pay-1"
    mock_atomic.assert_called_once()
