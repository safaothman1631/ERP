"""Streaming-focused report tests for Wave R."""
from datetime import datetime, timedelta
from unittest.mock import patch

from app.api import reports
from app.services import report_queries


def test_collect_journal_entries_streams_and_filters_dates():
    docs = [
        {"id": "e-old", "date": "2026-01-01", "status": "posted"},
        {"id": "e-in", "date": "2026-01-10", "status": "posted"},
        {"id": "e-void", "date": "2026-01-12", "status": "void"},
        {"id": "e-late", "date": "2026-02-01", "status": "posted"},
    ]
    with patch("app.firestore.journals.JournalEntryRepository") as repo_cls:
        repo_cls.return_value.stream_org_docs.return_value = iter(docs)
        rows = report_queries.collect_journal_entries(
            "org-1",
            start=datetime(2026, 1, 5),
            end=datetime(2026, 1, 31),
        )

    repo_cls.return_value.stream_org_docs.assert_called_once()
    assert [row["id"] for row in rows] == ["e-in"]


def test_journal_balances_reads_lines_per_entry():
    docs = [
        {"id": "j1", "date": "2026-01-10", "status": "posted"},
        {"id": "j2", "date": "2026-01-11", "status": "posted"},
    ]
    # This test pins the LEGACY 1+N path (get_lines per entry). The fast
    # collection_group path (REPORTS_USE_COLLECTION_GROUP, now on by default) is
    # covered separately in test_reports_cg.py + validated on real data, so force
    # the flag off here to exercise the legacy aggregation deterministically.
    with patch("app.firestore.journals.JournalEntryRepository") as repo_cls, patch(
        "app.config.settings.REPORTS_USE_COLLECTION_GROUP", False
    ):
        repo = repo_cls.return_value
        repo.stream_org_docs.return_value = iter(docs)
        repo.get_lines.side_effect = [
            [{"account_id": "a1", "debit": 100, "credit": 0}],
            [
                {"account_id": "a1", "debit": 0, "credit": 25},
                {"account_id": "a2", "debit": 10, "credit": 0},
            ],
        ]
        balances = report_queries.journal_balances("org-1")

    assert repo.get_lines.call_count == 2
    assert balances["a1"]["debit"] == 100.0
    assert balances["a1"]["credit"] == 25.0
    assert balances["a2"]["debit"] == 10.0


def test_top_items_loads_subcollection_lines_when_embedded_lines_missing():
    invoices = [{"id": "inv-1", "status": "sent"}]
    with patch("app.api.reports.collect_invoices", return_value=invoices), patch(
        "app.firestore.invoices.InvoiceRepository"
    ) as inv_cls, patch("app.firestore.items.ItemRepository") as item_cls:
        inv_cls.return_value.get_lines.return_value = [
            {"item_id": "it-1", "quantity": 2, "unit_price": 50},
            {"item_id": "it-1", "quantity": 1, "amount": 60},
        ]
        item_cls.return_value.get.return_value = {"name": "Widget", "sku": "W-1"}

        out = reports.top_items(limit=5, user={"org_id": "org-1"})

    inv_cls.return_value.get_lines.assert_called_once_with("inv-1")
    assert out["total"] == 1
    assert out["items"][0]["item_id"] == "it-1"
    assert out["items"][0]["quantity"] == 3.0
    assert out["items"][0]["revenue"] == 160.0


def test_project_profitability_aggregates_from_single_stream_pass():
    projects = [{"id": "p1", "name": "Alpha"}, {"id": "p2", "name": "Beta"}]
    invoices = [
        {"id": "i1", "project_id": "p1", "total": 200, "status": "sent"},
        {"id": "i2", "project_id": "p1", "total": 100, "status": "paid"},
    ]
    expenses = [
        {"id": "e1", "project_id": "p1", "amount": 120, "status": "approved"},
        {"id": "e2", "project_id": "p2", "amount": 30, "status": "approved"},
    ]
    with patch("app.firestore.projects.ProjectRepository") as project_cls, patch(
        "app.api.reports.collect_invoices", return_value=invoices
    ) as inv_collect, patch(
        "app.api.reports.collect_expenses", return_value=expenses
    ) as exp_collect:
        project_cls.return_value.stream_org_docs.return_value = iter(projects)
        out = reports.project_profitability_report(user={"org_id": "org-1"})

    inv_collect.assert_called_once_with("org-1")
    exp_collect.assert_called_once_with("org-1")
    assert out["items"][0]["project_id"] == "p1"
    assert out["items"][0]["revenue"] == 300.0
    assert out["items"][0]["costs"] == 120.0


def test_receivable_aging_uses_shared_open_docs_helper():
    now = datetime.utcnow()
    due = (now - timedelta(days=14)).date().isoformat()
    docs = [
        {
            "id": "inv-1",
            "invoice_number": "INV-1",
            "contact_name": "Customer A",
            "due_date": due,
            "balance_due": 250,
        }
    ]
    with patch("app.api.reports.open_invoices_for_aging", return_value=docs) as open_mock:
        out = reports.receivable_aging(user={"org_id": "org-1"})

    open_mock.assert_called_once_with("org-1")
    assert out["total"] == 250.0
    assert out["details"][0]["invoice_id"] == "inv-1"


def test_open_docs_helpers_delegate_to_report_queries():
    with patch("app.api.reports.open_invoices_for_aging", return_value=[{"id": "a"}]) as inv_open:
        assert reports._open_invoice_docs("org-1") == [{"id": "a"}]
    inv_open.assert_called_once_with("org-1")

    with patch("app.api.reports.open_bills_for_aging", return_value=[{"id": "b"}]) as bill_open:
        assert reports._open_bill_docs("org-1") == [{"id": "b"}]
    bill_open.assert_called_once_with("org-1")
