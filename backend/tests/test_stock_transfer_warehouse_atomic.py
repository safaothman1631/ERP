"""A2.9 — Transfer complete updates warehouse_stock at source and destination."""
from unittest.mock import MagicMock, patch

import pytest


def test_transfer_missing_warehouses():
    from app.services.stock_transfer_atomic import complete_transfer_atomic

    mock_db = MagicMock()
    snap = MagicMock()
    snap.exists = True
    snap.to_dict.return_value = {
        "org_id": "org-1",
        "status": "approved",
        "from_warehouse_id": None,
        "to_warehouse_id": "wh-2",
    }
    transfer_ref = MagicMock()
    transfer_ref.get.return_value = snap
    mock_db.collection.return_value.document.return_value = transfer_ref

    with patch("app.services.stock_transfer_atomic.get_db", return_value=mock_db), patch(
        "app.services.stock_transfer_atomic.fs.transactional", lambda f: f
    ):
        with pytest.raises(ValueError, match="transfer_missing_warehouses"):
            complete_transfer_atomic(
                "org-1", "tr-1", lines=[{"item_id": "i1", "quantity": 1}]
            )


def test_transfer_complete_updates_warehouse_stock():
    from app.services.stock_transfer_atomic import complete_transfer_atomic

    mock_db = MagicMock()
    tx = MagicMock()
    mock_db.transaction.return_value = tx

    transfer_snap = MagicMock()
    transfer_snap.exists = True
    transfer_snap.to_dict.return_value = {
        "org_id": "org-1",
        "status": "approved",
        "from_warehouse_id": "WH-A",
        "to_warehouse_id": "WH-B",
    }
    transfer_ref = MagicMock()
    transfer_ref.get.return_value = transfer_snap

    item_snap = MagicMock()
    item_snap.exists = True
    item_snap.to_dict.return_value = {"org_id": "org-1", "is_trackable": True}
    item_ref = MagicMock()
    item_ref.get.return_value = item_snap

    transfer_coll = MagicMock()
    transfer_coll.document.return_value = transfer_ref
    item_coll = MagicMock()
    item_coll.document.return_value = item_ref
    mov_coll = MagicMock()
    mov_coll.document.return_value = MagicMock()
    ws_coll = MagicMock()
    ws_coll.document.return_value = MagicMock()

    def _collection(name: str):
        return {
            "stock_transfers": transfer_coll,
            "items": item_coll,
            "stock_movements": mov_coll,
            "warehouse_stock": ws_coll,
        }.get(name, MagicMock())

    mock_db.collection.side_effect = _collection

    src_ref = MagicMock()
    dst_ref = MagicMock()

    with patch("app.services.stock_transfer_atomic.get_db", return_value=mock_db), patch(
        "app.services.stock_transfer_atomic.fs.transactional", lambda f: f
    ), patch(
        "app.services.stock_transfer_atomic._find_warehouse_stock_doc",
        side_effect=[
            (src_ref, {"quantity": 10}),
            (dst_ref, {"quantity": 2}),
        ],
    ):
        out = complete_transfer_atomic(
            "org-1",
            "tr-1",
            lines=[{"item_id": "item-1", "quantity": 3}],
            user_id="u1",
        )

    assert out["status"] == "completed"
    src_update = next(c for c in tx.update.call_args_list if c.args[0] is src_ref)
    dst_update = next(c for c in tx.update.call_args_list if c.args[0] is dst_ref)
    assert src_update.args[1]["quantity"] == 7
    assert dst_update.args[1]["quantity"] == 5
    assert len(tx.set.call_args_list) >= 2
    assert any(call.args[0] is transfer_ref for call in tx.update.call_args_list)
