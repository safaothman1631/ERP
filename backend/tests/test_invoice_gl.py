"""P0 Fix 1 — invoice confirm posts a balanced JE; void/cancel reverses it.

The JE *builder* (AccountingService.create_invoice_journal) is mocked here — its
own balance is proven by tests/test_accounting_balance.py / test_accounting_integrity.py.
These tests pin invoice_gl's contract: idempotency, draft-skip, soft-skip on a
missing chart of accounts, and reversal.
"""
from datetime import datetime
from unittest.mock import patch

from fastapi import HTTPException


def test_confirm_posts_je():
    from app.services.invoice_gl import post_invoice_confirmation_je
    inv = {
        "id": "inv-1", "invoice_number": "INV-1", "status": "sent",
        "date": "2026-06-01", "subtotal": 1_000_000, "total": 1_000_000,
        "tax_amount": 0, "discount_amount": 0,
    }
    with patch("app.services.accounting.AccountingService.create_invoice_journal") as build:
        build.return_value = {"id": "je-1"}
        je = post_invoice_confirmation_je("org-1", inv, created_by="u-1")
    assert je["id"] == "je-1"
    build.assert_called_once()
    # the deterministic entry id + created_by are threaded to the builder
    passed = build.call_args[0][1]
    assert passed["_je_entry_id"]  # non-empty deterministic id
    assert passed["created_by"] == "u-1"


def test_confirm_is_idempotent_when_already_posted():
    from app.services.invoice_gl import post_invoice_confirmation_je
    inv = {"id": "inv-1", "status": "sent", "gl_posted": True, "journal_entry_id": "je-1"}
    with patch("app.services.accounting.AccountingService.create_invoice_journal") as build:
        je = post_invoice_confirmation_je("org-1", inv)
    build.assert_not_called()
    assert je["skipped"] == "already_posted"


def test_deterministic_entry_id_is_stable():
    from app.services.invoice_gl import _deterministic_je_id
    assert _deterministic_je_id("inv-1") == _deterministic_je_id("inv-1")
    assert _deterministic_je_id("inv-1") != _deterministic_je_id("inv-2")


def test_draft_does_not_post():
    from app.services.invoice_gl import post_invoice_confirmation_je
    with patch("app.services.accounting.AccountingService.create_invoice_journal") as build:
        assert post_invoice_confirmation_je("org-1", {"id": "i", "status": "draft"}) is None
    build.assert_not_called()


def test_void_status_does_not_post():
    from app.services.invoice_gl import post_invoice_confirmation_je
    with patch("app.services.accounting.AccountingService.create_invoice_journal") as build:
        assert post_invoice_confirmation_je("org-1", {"id": "i", "status": "void"}) is None
    build.assert_not_called()


def test_missing_coa_soft_skips():
    from app.services.invoice_gl import post_invoice_confirmation_je
    inv = {"id": "inv-1", "status": "sent"}
    with patch(
        "app.services.accounting.AccountingService.create_invoice_journal",
        side_effect=HTTPException(status_code=404, detail="no CoA"),
    ):
        assert post_invoice_confirmation_je("org-1", inv) is None  # no raise


def test_void_reverses_je():
    from app.services.invoice_gl import reverse_invoice_je
    inv = {"id": "inv-1", "invoice_number": "INV-1", "journal_entry_id": "je-1"}
    with patch("app.services.accounting.AccountingService.reverse_journal_entry") as rev:
        rev.return_value = {"id": "je-rev"}
        out = reverse_invoice_je("org-1", inv, reversal_date=datetime(2026, 6, 2), user_id="u-1")
    assert out["id"] == "je-rev"
    rev.assert_called_once()


def test_reverse_no_je_is_noop():
    from app.services.invoice_gl import reverse_invoice_je
    with patch("app.services.accounting.AccountingService.reverse_journal_entry") as rev:
        assert reverse_invoice_je("org-1", {"id": "i"}, reversal_date=datetime(2026, 6, 2)) is None
    rev.assert_not_called()


def test_reverse_already_reversed_is_swallowed():
    from app.services.invoice_gl import reverse_invoice_je
    inv = {"id": "inv-1", "journal_entry_id": "je-1"}
    with patch(
        "app.services.accounting.AccountingService.reverse_journal_entry",
        side_effect=HTTPException(status_code=409, detail="already reversed"),
    ):
        assert reverse_invoice_je("org-1", inv, reversal_date=datetime(2026, 6, 2)) is None
