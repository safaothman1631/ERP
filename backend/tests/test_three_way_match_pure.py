"""Pure-logic unit tests for the three-way match engine.

Targets ``app.services.three_way_match.ThreeWayMatchService`` — a static,
pure-dict service (``typing`` only, no Firestore/network). Covers the matched /
partial / discrepancy verdicts, each discrepancy ``type`` (qty_over_received,
qty_over_ordered, price_variance, extra_line), tolerance boundaries, the summary
totals, and the ``can_post_bill`` gate.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.three_way_match import ThreeWayMatchService


def _po(line_id="L1", item="A", qty=10.0, price=5.0):
    return {"id": "PO1", "lines": [{"po_line_id": line_id, "item_id": item, "qty_ordered": qty, "unit_price": price}]}


def _receipt(line_id="L1", item="A", qty=10.0, cost=5.0, rid="GR1"):
    return {"id": rid, "lines": [{"po_line_id": line_id, "item_id": item, "qty_received": qty, "unit_cost": cost}]}


def _bill(line_id="L1", item="A", qty=10.0, price=5.0):
    return {"id": "B1", "lines": [{"po_line_id": line_id, "item_id": item, "qty_billed": qty, "unit_price": price}]}


# ─────────────────────────────────────────────────────────────────────────
# Happy path — fully matched
# ─────────────────────────────────────────────────────────────────────────


def test_perfect_match_status_matched():
    res = ThreeWayMatchService.match(_po(), [_receipt()], _bill())
    assert res["match_status"] == "matched"
    assert res["discrepancies"] == []
    assert res["summary"]["lines_matched"] == 1
    assert res["summary"]["lines_total"] == 1


def test_summary_totals_computed():
    res = ThreeWayMatchService.match(
        _po(qty=10, price=5), [_receipt(qty=10, cost=5)], _bill(qty=10, price=5)
    )
    assert res["summary"]["po_total"] == 50.0
    assert res["summary"]["received_total"] == 50.0
    assert res["summary"]["billed_total"] == 50.0


# ─────────────────────────────────────────────────────────────────────────
# qty_over_received (block) — billed more than received
# ─────────────────────────────────────────────────────────────────────────


def test_billed_more_than_received_blocks():
    res = ThreeWayMatchService.match(_po(qty=10), [_receipt(qty=5)], _bill(qty=8))
    types = {d["type"] for d in res["discrepancies"]}
    assert "qty_over_received" in types
    assert res["match_status"] == "discrepancy"


def test_qty_over_received_is_block_severity():
    res = ThreeWayMatchService.match(_po(qty=10), [_receipt(qty=5)], _bill(qty=8))
    over = [d for d in res["discrepancies"] if d["type"] == "qty_over_received"][0]
    assert over["severity"] == "block"


# ─────────────────────────────────────────────────────────────────────────
# qty_over_ordered (block) — billed more than ordered
# ─────────────────────────────────────────────────────────────────────────


def test_billed_more_than_ordered_blocks():
    # Receive plenty so only the "over ordered" rule fires.
    res = ThreeWayMatchService.match(_po(qty=10), [_receipt(qty=20)], _bill(qty=15))
    types = {d["type"] for d in res["discrepancies"]}
    assert "qty_over_ordered" in types
    assert res["match_status"] == "discrepancy"


# ─────────────────────────────────────────────────────────────────────────
# price_variance — warn vs block by magnitude (default tol 5%)
# ─────────────────────────────────────────────────────────────────────────


def test_price_variance_within_tolerance_no_discrepancy():
    # 5.20 vs 5.00 = 4% < 5% tolerance.
    res = ThreeWayMatchService.match(_po(price=5.0), [_receipt(cost=5.0)], _bill(price=5.2))
    assert res["match_status"] == "matched"
    assert res["discrepancies"] == []


def test_price_variance_above_tolerance_warns():
    # 5.35 vs 5.00 = 7% → > 5% but <= 10% → warn (not block).
    res = ThreeWayMatchService.match(_po(price=5.0), [_receipt(cost=5.0)], _bill(price=5.35))
    pv = [d for d in res["discrepancies"] if d["type"] == "price_variance"][0]
    assert pv["severity"] == "warn"
    # warn-only → partial, not discrepancy.
    assert res["match_status"] == "partial"


def test_price_variance_double_tolerance_blocks():
    # 6.00 vs 5.00 = 20% → > 2*5% → block.
    res = ThreeWayMatchService.match(_po(price=5.0), [_receipt(cost=5.0)], _bill(price=6.0))
    pv = [d for d in res["discrepancies"] if d["type"] == "price_variance"][0]
    assert pv["severity"] == "block"
    assert res["match_status"] == "discrepancy"


def test_po_no_price_but_bill_charges_warns():
    res = ThreeWayMatchService.match(_po(price=0.0), [_receipt(cost=0.0)], _bill(price=5.0))
    pv = [d for d in res["discrepancies"] if d["type"] == "price_variance"][0]
    assert pv["severity"] == "warn"


# ─────────────────────────────────────────────────────────────────────────
# extra_line (block) — bill line not on PO
# ─────────────────────────────────────────────────────────────────────────


def test_extra_bill_line_blocks():
    res = ThreeWayMatchService.match(_po(line_id="L1"), [_receipt(line_id="L1")], _bill(line_id="L99"))
    types = {d["type"] for d in res["discrepancies"]}
    assert "extra_line" in types
    assert res["match_status"] == "discrepancy"


# ─────────────────────────────────────────────────────────────────────────
# partial — received but not yet billed
# ─────────────────────────────────────────────────────────────────────────


def test_received_unbilled_line_is_partial():
    po = {"id": "PO1", "lines": [
        {"po_line_id": "L1", "qty_ordered": 10, "unit_price": 5},
        {"po_line_id": "L2", "qty_ordered": 10, "unit_price": 5},
    ]}
    receipts = [{"id": "GR1", "lines": [
        {"po_line_id": "L1", "qty_received": 10, "unit_cost": 5},
        {"po_line_id": "L2", "qty_received": 10, "unit_cost": 5},
    ]}]
    # Only L1 billed; L2 received but unbilled.
    bill = {"id": "B1", "lines": [{"po_line_id": "L1", "qty_billed": 10, "unit_price": 5}]}
    res = ThreeWayMatchService.match(po, receipts, bill)
    assert res["match_status"] == "partial"
    assert "L2" in res["unbilled_received_lines"]


# ─────────────────────────────────────────────────────────────────────────
# Multiple receipts aggregate
# ─────────────────────────────────────────────────────────────────────────


def test_multiple_receipts_aggregate_qty():
    po = _po(qty=10)
    receipts = [_receipt(qty=4, rid="GR1"), _receipt(qty=6, rid="GR2")]
    # 4 + 6 = 10 received, bill 10 → OK.
    res = ThreeWayMatchService.match(po, receipts, _bill(qty=10))
    assert res["match_status"] == "matched"


# ─────────────────────────────────────────────────────────────────────────
# can_post_bill gate
# ─────────────────────────────────────────────────────────────────────────


def test_can_post_bill_allows_matched():
    res = ThreeWayMatchService.match(_po(), [_receipt()], _bill())
    allowed, reason = ThreeWayMatchService.can_post_bill(res)
    assert allowed is True
    assert reason is None


def test_can_post_bill_blocks_discrepancy_with_reason():
    res = ThreeWayMatchService.match(_po(qty=10), [_receipt(qty=5)], _bill(qty=8))
    allowed, reason = ThreeWayMatchService.can_post_bill(res)
    assert allowed is False
    assert reason and "Billed" in reason


def test_can_post_bill_allows_partial_warn_only():
    # Warn-only price variance → partial → still postable.
    res = ThreeWayMatchService.match(_po(price=5.0), [_receipt(cost=5.0)], _bill(price=5.35))
    allowed, reason = ThreeWayMatchService.can_post_bill(res)
    assert allowed is True
    assert reason is None
