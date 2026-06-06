"""COGS auto-post (Dr COGS / Cr Inventory at standard cost) on picking-done."""
from unittest.mock import MagicMock, patch

from fastapi import HTTPException


def _item_repo(items_by_id):
    repo = MagicMock()
    repo.get.side_effect = lambda iid: items_by_id.get(iid)
    return repo


def test_total_standard_cost_sums_cost_times_qty():
    from app.services.cogs_gl import _total_standard_cost
    picking = {"lines": [{"item_id": "i1", "qty": 3}, {"item_id": "i2", "quantity": 2}]}
    items = {"i1": {"cost_price": 800_000}, "i2": {"cost_price": 50_000}}
    with patch("app.firestore.items.ItemRepository", return_value=_item_repo(items)):
        assert _total_standard_cost("org-1", picking) == 3 * 800_000 + 2 * 50_000


def test_service_item_skipped():
    from app.services.cogs_gl import _total_standard_cost
    picking = {"lines": [{"item_id": "svc", "qty": 5}, {"item_id": "i1", "qty": 1}]}
    items = {"svc": {"cost_price": 999, "track_inventory": False}, "i1": {"cost_price": 100}}
    with patch("app.firestore.items.ItemRepository", return_value=_item_repo(items)):
        assert _total_standard_cost("org-1", picking) == 100  # service item excluded


def test_post_idempotent_when_already_posted():
    from app.services.cogs_gl import post_picking_cogs_je
    pk = {"id": "pk-1", "gl_posted_cogs": True, "cogs_journal_entry_id": "je-9"}
    with patch("app.services.accounting.AccountingService.create_cogs_journal") as build:
        je = post_picking_cogs_je("org-1", pk)
    build.assert_not_called()
    assert je["skipped"] == "already_posted"


def test_zero_cost_returns_none():
    from app.services.cogs_gl import post_picking_cogs_je
    pk = {"id": "pk-1", "lines": [{"item_id": "i1", "qty": 1}]}
    items = {"i1": {"cost_price": 0}}
    with patch("app.firestore.items.ItemRepository", return_value=_item_repo(items)), \
         patch("app.services.accounting.AccountingService.create_cogs_journal") as build:
        assert post_picking_cogs_je("org-1", pk) is None
    build.assert_not_called()


def test_post_calls_create_cogs_with_total():
    from app.services.cogs_gl import post_picking_cogs_je
    pk = {"id": "pk-1", "lines": [{"item_id": "i1", "qty": 2}]}
    items = {"i1": {"cost_price": 800_000}}
    with patch("app.firestore.items.ItemRepository", return_value=_item_repo(items)), \
         patch("app.services.accounting.AccountingService.create_cogs_journal", return_value={"id": "je-c"}) as build:
        je = post_picking_cogs_je("org-1", pk, created_by="u1")
    assert je["id"] == "je-c"
    args = build.call_args[0]
    assert args[2] == 1_600_000          # total cost = 2 × 800k
    assert args[1]["_je_entry_id"]       # deterministic id threaded


def test_missing_coa_soft_skips():
    from app.services.cogs_gl import post_picking_cogs_je
    pk = {"id": "pk-1", "lines": [{"item_id": "i1", "qty": 1}]}
    items = {"i1": {"cost_price": 100}}
    with patch("app.firestore.items.ItemRepository", return_value=_item_repo(items)), \
         patch("app.services.accounting.AccountingService.create_cogs_journal",
               side_effect=HTTPException(status_code=404, detail="no CoA")):
        assert post_picking_cogs_je("org-1", pk) is None  # no raise


def test_create_cogs_journal_balanced():
    from app.services.accounting import AccountingService
    with patch.object(AccountingService, "_get_account_by_type", side_effect=lambda o, t: f"acct-{t}"), \
         patch.object(AccountingService, "create_journal_entry", return_value={"id": "je-x"}) as cje:
        out = AccountingService.create_cogs_journal("org-1", {"id": "pk-1"}, 1_600_000)
    assert out["id"] == "je-x"
    lines = cje.call_args.kwargs["lines"]
    dr = sum(l["debit"] for l in lines)
    cr = sum(l["credit"] for l in lines)
    assert dr == cr == 1_600_000
    assert any(l["account_id"] == "acct-cost_of_goods_sold" and l["debit"] == 1_600_000 for l in lines)
    assert any(l["account_id"] == "acct-inventory" and l["credit"] == 1_600_000 for l in lines)


def test_create_cogs_journal_zero_returns_none():
    from app.services.accounting import AccountingService
    assert AccountingService.create_cogs_journal("org-1", {"id": "pk-1"}, 0) is None
