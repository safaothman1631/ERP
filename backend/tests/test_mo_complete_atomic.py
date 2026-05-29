"""A2.10 — MO done with optional warehouse stock posting."""
from unittest.mock import MagicMock, patch

import pytest


def test_mo_complete_raises_when_not_found():
    from app.services.mo_complete_atomic import complete_manufacturing_order_atomic
    from app.services.firestore_tx import TenantMismatchError

    mock_db = MagicMock()
    mo_snap = MagicMock()
    mo_snap.exists = False
    mo_ref = MagicMock()
    mo_ref.get.return_value = mo_snap
    mock_db.collection.return_value.document.return_value = mo_ref

    with patch("app.services.mo_complete_atomic.get_db", return_value=mock_db), patch(
        "app.services.mo_complete_atomic.fs.transactional", lambda f: f
    ):
        with pytest.raises(TenantMismatchError):
            complete_manufacturing_order_atomic(
                "org-1", "mo-x", produced_qty=1.0
            )


def test_mo_complete_already_done():
    from app.services.mo_complete_atomic import complete_manufacturing_order_atomic

    mock_db = MagicMock()
    mo_snap = MagicMock()
    mo_snap.exists = True
    mo_snap.to_dict.return_value = {"org_id": "org-1", "status": "done", "quantity": 1}
    mo_ref = MagicMock()
    mo_ref.get.return_value = mo_snap
    mock_db.collection.return_value.document.return_value = mo_ref

    with patch("app.services.mo_complete_atomic.get_db", return_value=mock_db), patch(
        "app.services.mo_complete_atomic.fs.transactional", lambda f: f
    ):
        with pytest.raises(ValueError, match="mo_already_done"):
            complete_manufacturing_order_atomic(
                "org-1", "mo-1", produced_qty=1.0
            )


def test_mo_complete_posts_component_and_finished_stock():
    from app.services.mo_complete_atomic import complete_manufacturing_order_atomic

    mock_db = MagicMock()
    tx = MagicMock()
    mock_db.transaction.return_value = tx

    mo_snap = MagicMock()
    mo_snap.exists = True
    mo_snap.to_dict.return_value = {
        "org_id": "org-1",
        "status": "confirmed",
        "quantity": 10,
        "product_id": "prod-1",
        "components": [
            {"item_id": "comp-1", "required_qty": 20},
        ],
    }
    mo_ref = MagicMock()
    mo_ref.get.return_value = mo_snap
    mo_coll = MagicMock()
    mo_coll.document.return_value = mo_ref
    mock_db.collection.side_effect = lambda n: mo_coll if n == "manufacturing_orders" else MagicMock()

    with patch("app.services.mo_complete_atomic.get_db", return_value=mock_db), patch(
        "app.services.mo_complete_atomic.fs.transactional", lambda f: f
    ), patch(
        "app.services.mo_complete_atomic._adjust_warehouse_stock"
    ) as mock_adjust:
        result = complete_manufacturing_order_atomic(
            "org-1",
            "mo-1",
            produced_qty=10,
            warehouse_id="WH-1",
        )

    assert result["status"] == "done"
    assert result["produced_qty"] == 10
    assert mock_adjust.call_count == 2
    deltas = [c.args[5] for c in mock_adjust.call_args_list]
    assert -20.0 in deltas
    assert 10.0 in deltas
