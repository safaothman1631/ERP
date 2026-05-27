"""Reconcile uses stream_org_docs and opening_stock."""
from app.services.reconciliation import compute_stock_drift, run_reconcile_for_org
from unittest.mock import patch, MagicMock


def test_stock_drift_with_opening():
    item = {"id": "i1", "is_trackable": True, "stock_on_hand": 15, "opening_stock": 10}
    row = compute_stock_drift(item, [2.0, 3.0])
    assert row is None


def test_run_reconcile_uses_stream():
    inv = {"id": "inv1", "total": 100, "balance_due": 100, "org_id": "org-1"}
    with patch("app.firebase_client.init_firebase"), patch(
        "app.firebase_client.is_firebase_available", return_value=True
    ), patch("app.firestore.invoices.InvoiceRepository") as inv_cls, patch(
        "app.firestore.invoices.PaymentReceivedRepository"
    ) as pay_cls, patch(
        "app.firestore.bills.BillRepository"
    ) as bill_cls, patch(
        "app.firestore.bills.PaymentMadeRepository"
    ) as pm_cls, patch(
        "app.firestore.inventory.ItemRepository"
    ) as item_cls, patch(
        "app.firestore.inventory.StockMovementRepository"
    ) as mov_cls, patch(
        "app.firestore.banking.BankAccountRepository"
    ) as ba_cls, patch(
        "app.firestore.banking.BankTransactionRepository"
    ) as bt_cls, patch("app.services.reconciliation._save_reconcile_run"):
        inv_cls.return_value.stream_org_docs.return_value = iter([inv])
        pay_cls.return_value.stream_org_docs.return_value = iter([])
        bill_cls.return_value.stream_org_docs.return_value = iter([])
        pm_cls.return_value.stream_org_docs.return_value = iter([])
        item_cls.return_value.stream_org_docs.return_value = iter([])
        mov_cls.return_value.stream_org_docs.return_value = iter([])
        ba_cls.return_value.stream_org_docs.return_value = iter([])
        bt_cls.return_value.stream_org_docs.return_value = iter([])
        summary = run_reconcile_for_org("org-1")
        inv_cls.return_value.stream_org_docs.assert_called_once()
        assert summary["drift_count"] == 0
