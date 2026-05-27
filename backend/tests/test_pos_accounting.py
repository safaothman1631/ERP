"""POS accounting service unit tests."""
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.services.pos_accounting import create_invoice_from_pos_order, post_session_sales_journal


@patch("app.services.pos_accounting.AccountingService.create_invoice_journal")
@patch("app.firestore.invoices.InvoiceRepository")
@patch("app.firestore.system.SequenceRepository")
@patch("app.services.settings_service.get_pos_settings")
def test_create_invoice_from_pos_order(mock_pos_cfg, mock_seq, mock_inv_cls, mock_je):
    mock_pos_cfg.return_value = {"walk_in_contact_id": "contact-walkin"}
    mock_seq.return_value.get_next.return_value = "INV-001"
    mock_repo = MagicMock()
    mock_inv_cls.return_value = mock_repo
    mock_repo.create.return_value = {
        "id": "inv-1",
        "invoice_number": "INV-001",
        "total": 5000,
    }

    order = {"id": "ord-1", "order_number": "POS-1", "subtotal": 4500, "tax_total": 500, "total": 5000}
    lines = [{"item_id": "i1", "qty": 1, "unit_price": 5000, "total": 5000, "item_name": "Tea"}]
    inv = create_invoice_from_pos_order("org-1", order, lines, "user-1")
    assert inv["id"] == "inv-1"
    mock_repo.set_lines.assert_called_once()


@patch("app.services.settings_service.get_pos_settings")
def test_create_invoice_requires_contact(mock_pos_cfg):
    mock_pos_cfg.return_value = {}
    with pytest.raises(HTTPException) as exc:
        create_invoice_from_pos_order("org-1", {"id": "o1"}, [], "u1")
    assert exc.value.status_code == 422


@patch("app.services.pos_accounting.AccountingService.create_journal_entry")
@patch("app.services.pos_accounting.AccountingService._get_account_by_code")
@patch("app.services.pos_accounting.AccountingService._get_account_by_type")
def test_post_session_sales_journal(mock_type, mock_code, mock_create):
    mock_type.side_effect = lambda _org, t: f"acc-{t}"
    mock_code.return_value = "acc-tax"
    mock_create.return_value = {"id": "je-1"}

    je = post_session_sales_journal("org-1", {"id": "sess-1"}, 11000, 1000, 11000, 0, "u1")
    assert je["id"] == "je-1"
    lines = mock_create.call_args.kwargs["lines"]
    assert sum(l["debit"] for l in lines) == sum(l["credit"] for l in lines)
