"""AP-side GL: bill approve posts Dr Expense/Inventory / Cr AP; void reverses."""
from datetime import datetime
from unittest.mock import patch

from fastapi import HTTPException


def test_approve_posts_je():
    from app.services.bill_gl import post_bill_approval_je
    bill = {"id": "b-1", "bill_number": "BILL-1", "status": "open",
            "date": "2026-06-01", "total": 700_000, "contact_id": "v-1"}
    lines = [{"account_id": "exp-1", "line_total": 700_000}]
    with patch("app.services.accounting.AccountingService.create_bill_journal") as build:
        build.return_value = {"id": "je-b"}
        je = post_bill_approval_je("org-1", bill, lines, created_by="u-1")
    assert je["id"] == "je-b"
    passed_bill = build.call_args[0][1]
    assert passed_bill["_je_entry_id"]
    assert passed_bill["created_by"] == "u-1"
    assert build.call_args[0][2] == lines


def test_idempotent_when_already_posted():
    from app.services.bill_gl import post_bill_approval_je
    bill = {"id": "b-1", "status": "open", "gl_posted": True, "journal_entry_id": "je-b"}
    with patch("app.services.accounting.AccountingService.create_bill_journal") as build:
        je = post_bill_approval_je("org-1", bill, [])
    build.assert_not_called()
    assert je["skipped"] == "already_posted"


def test_draft_does_not_post():
    from app.services.bill_gl import post_bill_approval_je
    with patch("app.services.accounting.AccountingService.create_bill_journal") as build:
        assert post_bill_approval_je("org-1", {"id": "b", "status": "draft"}, []) is None
    build.assert_not_called()


def test_missing_coa_soft_skips():
    from app.services.bill_gl import post_bill_approval_je
    bill = {"id": "b-1", "status": "open", "bill_number": "B1", "total": 100}
    with patch("app.services.accounting.AccountingService.create_bill_journal",
               side_effect=HTTPException(status_code=404, detail="no CoA")):
        assert post_bill_approval_je("org-1", bill, [{"account_id": "x", "line_total": 100}]) is None


def test_void_reverses_je():
    from app.services.bill_gl import reverse_bill_je
    bill = {"id": "b-1", "bill_number": "BILL-1", "journal_entry_id": "je-b"}
    with patch("app.services.accounting.AccountingService.reverse_journal_entry") as rev:
        rev.return_value = {"id": "je-rev"}
        out = reverse_bill_je("org-1", bill, reversal_date=datetime(2026, 6, 2), user_id="u-1")
    assert out["id"] == "je-rev"


def test_reverse_no_je_is_noop():
    from app.services.bill_gl import reverse_bill_je
    with patch("app.services.accounting.AccountingService.reverse_journal_entry") as rev:
        assert reverse_bill_je("org-1", {"id": "b"}, reversal_date=datetime(2026, 6, 2)) is None
    rev.assert_not_called()


def test_deterministic_id_stable():
    from app.services.bill_gl import _deterministic_je_id
    assert _deterministic_je_id("b-1") == _deterministic_je_id("b-1")
    assert _deterministic_je_id("b-1") != _deterministic_je_id("b-2")
