"""Org counter helpers."""
from unittest.mock import patch

from app.services.org_counters import (
    _default_counters,
    _open_invoice_metrics,
    transition_invoice_counters,
)


def test_default_counters_shape():
    c = _default_counters("org-1")
    assert c["org_id"] == "org-1"
    assert "invoices_open_balance" in c


def test_open_invoice_metrics_open_vs_paid():
    bal, cnt = _open_invoice_metrics(
        {"status": "sent", "balance_due": 100, "total": 100}
    )
    assert bal == 100 and cnt == 1
    bal2, cnt2 = _open_invoice_metrics({"status": "paid", "balance_due": 0})
    assert bal2 == 0 and cnt2 == 0


def test_transition_invoice_counters_on_payment():
    before = {"status": "sent", "balance_due": 100, "total": 100}
    after = {"status": "paid", "balance_due": 0, "total": 100}
    with patch("app.services.org_counters.bump_counter") as bump:
        transition_invoice_counters("org-1", before, after)
        calls = {c.args[1]: c.args[2] for c in bump.call_args_list}
        assert calls.get("invoices_open_balance") == -100
        assert calls.get("invoices_open_count") == -1
