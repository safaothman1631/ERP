"""Three-way match enforcement on bill approval."""
from app.services.match_normalizers import (
    normalize_bill_for_match,
    normalize_po_for_match,
    normalize_receipts_for_match,
)
from app.services.three_way_match import ThreeWayMatchService


def _sample_po():
    return {
        "id": "po1",
        "lines": [{"id": "pl1", "item_id": "item1", "qty": 10, "unit_price": 100}],
        "goods_receipts": [{
            "id": "grn1",
            "lines": [{"po_line_id": "pl1", "item_id": "item1", "qty_received": 10, "unit_cost": 100}],
        }],
    }


def test_match_allows_bill_when_quantities_align():
    po = _sample_po()
    bill = {
        "id": "b1",
        "lines": [{"po_line_id": "pl1", "item_id": "item1", "qty": 10, "unit_price": 100}],
    }
    result = ThreeWayMatchService.match(
        normalize_po_for_match(po),
        normalize_receipts_for_match(po["goods_receipts"]),
        normalize_bill_for_match(bill),
    )
    allowed, reason = ThreeWayMatchService.can_post_bill(result)
    assert allowed is True
    assert reason is None
    assert result["match_status"] == "matched"


def test_match_blocks_over_billing():
    po = _sample_po()
    bill = {
        "id": "b1",
        "lines": [{"po_line_id": "pl1", "item_id": "item1", "qty": 15, "unit_price": 100}],
    }
    result = ThreeWayMatchService.match(
        normalize_po_for_match(po),
        normalize_receipts_for_match(po["goods_receipts"]),
        normalize_bill_for_match(bill),
    )
    allowed, reason = ThreeWayMatchService.can_post_bill(result)
    assert allowed is False
    assert "received" in (reason or "").lower()
