"""POS inventory uses qty field on order lines."""
from unittest.mock import MagicMock, patch

from app.services.pos_inventory import deduct_inventory_for_order, line_quantity, validate_stock_for_lines


def test_line_quantity_prefers_qty_then_quantity():
    assert line_quantity({"qty": 3}) == 3.0
    assert line_quantity({"quantity": 5}) == 5.0
    assert line_quantity({"qty": 2, "quantity": 9}) == 2.0
    assert line_quantity({}) == 0.0


@patch("app.firestore.inventory.ItemRepository")
def test_validate_stock_uses_qty(mock_item_repo_cls):
    mock_repo = MagicMock()
    mock_item_repo_cls.return_value = mock_repo
    mock_repo.get.return_value = {"name": "Tea", "is_trackable": True, "stock_on_hand": 1}

    err = validate_stock_for_lines("org1", [{"item_id": "i1", "qty": 5}])
    assert err is not None
    assert err["code"] == "insufficient_stock"
    assert err["requested"] == 5.0


@patch("app.services.pos_sync_inventory_atomic.deduct_inventory_for_order_atomic")
def test_deduct_inventory_with_qty_only_lines(mock_atomic):
    lines = [{"item_id": "item-1", "qty": 4}]
    deduct_inventory_for_order("org1", "order-1", "user-1", lines)
    mock_atomic.assert_called_once_with("org1", "order-1", "user-1", lines)
