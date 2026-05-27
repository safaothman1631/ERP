"""Wave K — smoke that core repos expose BaseRepository semantics."""
import inspect

import pytest

from app.firestore.accounts import AccountRepository
from app.firestore.bills import BillRepository
from app.firestore.contacts import ContactRepository
from app.firestore.invoices import InvoiceRepository
from app.firestore.items import ItemRepository


@pytest.mark.parametrize(
    "repo_cls",
    [InvoiceRepository, BillRepository, ContactRepository, ItemRepository, AccountRepository],
)
def test_repository_has_crud_and_versioned(repo_cls):
    for name in ("get", "create", "update", "update_versioned", "delete"):
        assert hasattr(repo_cls, name)
    assert repo_cls.collection_name
    sig = inspect.signature(repo_cls.update_versioned)
    assert "expected_version" in sig.parameters
