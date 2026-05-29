"""Warehouse move atomic services."""
from unittest.mock import MagicMock, patch

import pytest


def test_validate_stock_move_atomic_updates_warehouse_balances():
    from app.services.warehouse_move_atomic import validate_stock_move_atomic

    mock_db = MagicMock()
    tx = MagicMock()
    mock_db.transaction.return_value = tx

    move_snap = MagicMock()
    move_snap.exists = True
    move_snap.to_dict.return_value = {
        "org_id": "org-1",
        "state": "draft",
        "item_id": "item-1",
        "quantity": 3,
        "from_location_id": "WH-A",
        "to_location_id": "WH-B",
    }

    move_ref = MagicMock()
    move_ref.get.return_value = move_snap
    move_collection = MagicMock()
    move_collection.document.return_value = move_ref

    ws_collection = MagicMock()
    ws_collection.document.return_value = MagicMock()

    def _collection(name: str):
        if name == "stock_movements":
            return move_collection
        if name == "warehouse_stock":
            return ws_collection
        return MagicMock()

    mock_db.collection.side_effect = _collection

    from_ref = MagicMock()
    to_ref = MagicMock()

    with patch("app.services.warehouse_move_atomic.get_db", return_value=mock_db), patch(
        "app.services.warehouse_move_atomic.fs.transactional", lambda f: f
    ), patch(
        "app.services.warehouse_move_atomic._find_warehouse_stock_doc",
        side_effect=[
            (from_ref, {"quantity": 10}),
            (to_ref, {"quantity": 2}),
        ],
    ):
        out = validate_stock_move_atomic("org-1", "move-1", validated_by="u1")

    assert out["state"] == "done"
    assert any(call.args[0] is from_ref for call in tx.update.call_args_list)
    assert any(call.args[0] is to_ref for call in tx.update.call_args_list)
    assert any(call.args[0] is move_ref for call in tx.update.call_args_list)


def test_done_picking_atomic_rejects_invalid_status():
    from app.services.warehouse_move_atomic import done_picking_atomic

    mock_db = MagicMock()
    tx = MagicMock()
    mock_db.transaction.return_value = tx

    picking_snap = MagicMock()
    picking_snap.exists = True
    picking_snap.to_dict.return_value = {
        "org_id": "org-1",
        "type": "picking",
        "status": "done",
        "warehouse_id": "WH-A",
        "lines": [{"item_id": "item-1", "qty": 1}],
    }

    picking_ref = MagicMock()
    picking_ref.get.return_value = picking_snap
    move_collection = MagicMock()
    move_collection.document.return_value = picking_ref

    mock_db.collection.side_effect = lambda name: move_collection if name == "stock_movements" else MagicMock()

    with patch("app.services.warehouse_move_atomic.get_db", return_value=mock_db), patch(
        "app.services.warehouse_move_atomic.fs.transactional", lambda f: f
    ):
        with pytest.raises(ValueError, match="picking_invalid_status"):
            done_picking_atomic("org-1", "pick-1", done_by="u1")
