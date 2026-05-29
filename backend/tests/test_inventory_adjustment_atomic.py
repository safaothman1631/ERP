"""Inventory adjustment atomic post."""
from unittest.mock import MagicMock, patch


def test_post_adjustment_updates_stock():
    from app.services.inventory_adjustment_atomic import post_adjustment_atomic

    mock_db = MagicMock()
    item_snap = MagicMock()
    item_snap.exists = True
    item_snap.to_dict.return_value = {
        "org_id": "org-1",
        "is_trackable": True,
        "stock_on_hand": 10,
    }
    mock_db.collection.return_value.document.return_value.get.return_value = item_snap

    with patch(
        "app.services.inventory_adjustment_atomic.get_db", return_value=mock_db
    ), patch("app.services.inventory_adjustment_atomic.fs.transactional", lambda f: f):
        result = post_adjustment_atomic(
            "org-1",
            {
                "id": "adj-1",
                "item_id": "item-1",
                "quantity_adjusted": 5,
                "created_by_id": "u1",
            },
        )
        assert result["status"] == "posted"
        assert result["balance_after"] == 15
