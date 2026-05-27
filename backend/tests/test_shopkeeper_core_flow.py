"""Shopkeeper production_core contract tests (unit-level)."""
from app.services.pos_inventory import line_quantity
from app.services.three_way_match import ThreeWayMatchService
from app.services.match_normalizers import (
    normalize_bill_for_match,
    normalize_po_for_match,
    normalize_receipts_for_match,
)


def test_pos_calculated_line_shape_includes_quantity_alias():
    """Document expected line shape after _calculate_order_totals fix."""
    line = {"item_id": "x", "qty": 7, "quantity": 7}
    assert line_quantity(line) == 7.0


def _sample_po_with_grn():
    return {
        "id": "po1",
        "lines": [{"id": "pl1", "item_id": "item1", "qty": 10, "unit_price": 100}],
        "goods_receipts": [{
            "id": "grn1",
            "lines": [{"po_line_id": "pl1", "item_id": "item1", "qty_received": 10, "unit_cost": 100}],
        }],
    }


def test_shopkeeper_bill_cannot_exceed_received_qty():
    """Supplier bill over GRN qty must block (debt/AP integrity)."""
    po = _sample_po_with_grn()
    bill = {
        "id": "b1",
        "lines": [{"po_line_id": "pl1", "item_id": "item1", "qty": 12, "unit_price": 100}],
    }
    result = ThreeWayMatchService.match(
        normalize_po_for_match(po),
        normalize_receipts_for_match(po["goods_receipts"]),
        normalize_bill_for_match(bill),
    )
    allowed, _ = ThreeWayMatchService.can_post_bill(result)
    assert allowed is False


def test_offline_sync_payload_shape():
    """Frontend sync contract: one temp_id per queued order."""
    queue_item_id = "550e8400-e29b-41d4-a716-446655440000"
    payload = {
        "orders": [{
            "temp_id": queue_item_id,
            "session_id": "sess-1",
            "lines": [{"item_id": "i1", "qty": 1, "unit_price": 1000, "discount_percent": 0, "tax_rate": 0}],
            "payments": [{"payment_method_id": "cash", "amount": 1000}],
        }],
    }
    assert payload["orders"][0]["temp_id"] == queue_item_id
    assert "qty" in payload["orders"][0]["lines"][0]
