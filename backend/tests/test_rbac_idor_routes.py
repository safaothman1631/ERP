"""IDOR smoke: tenant A cannot read tenant B entities via repository guard."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.mark.parametrize(
    "repo_cls,module_path",
    [
        ("InvoiceRepository", "app.firestore.invoices"),
        ("BillRepository", "app.firestore.bills"),
        ("ItemRepository", "app.firestore.inventory"),
        ("ContactRepository", "app.firestore.contacts"),
        ("BankTransactionRepository", "app.firestore.banking"),
        ("QuoteRepository", "app.firestore.invoices"),
        ("PurchaseOrderRepository", "app.firestore.bills"),
        ("PaymentReceivedRepository", "app.firestore.invoices"),
        ("ExpenseRepository", "app.firestore.expenses"),
        ("JournalEntryRepository", "app.firestore.journals"),
    ],
)
def test_get_hides_cross_org_document(repo_cls, module_path):
    import importlib

    mod = importlib.import_module(module_path)
    Repo = getattr(mod, repo_cls)
    with patch("app.firestore.base.get_db", return_value=MagicMock()):
        repo = Repo("org-tenant-a")
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.id = "foreign-1"
        mock_doc.to_dict.return_value = {"org_id": "org-tenant-b", "name": "secret"}

        with patch.object(repo.collection, "document") as mock_document:
            mock_document.return_value.get.return_value = mock_doc
            with patch("app.firestore.base.cache") as mock_cache:
                mock_cache.get.return_value = None
                assert repo.get("foreign-1") is None
