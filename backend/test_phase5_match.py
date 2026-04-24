"""Smoke test for Phase 5 Three-Way Match Service."""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.firebase_client import init_firebase
from app.services.three_way_match import ThreeWayMatchService

init_firebase()

results = []


def _assert(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((status, name, detail))
    print(f"  [{status}] {name}{(' - ' + detail) if detail else ''}")


def t1_perfect_match():
    """PO 10 @ 5, GR 10, Bill 10 @ 5 => matched, can post."""
    print("\nT1 - perfect three-way match")
    po = {"id": "PO1", "lines": [
        {"po_line_id": "PL1", "item_id": "I1", "qty_ordered": 10.0, "unit_price": 5.0},
    ]}
    receipts = [{"id": "GR1", "lines": [
        {"po_line_id": "PL1", "qty_received": 10.0, "unit_cost": 5.0},
    ]}]
    bill = {"id": "B1", "lines": [
        {"po_line_id": "PL1", "qty_billed": 10.0, "unit_price": 5.0},
    ]}
    res = ThreeWayMatchService.match(po, receipts, bill)
    _assert("matched", res["match_status"] == "matched", res["match_status"])
    _assert("0 discrepancies", len(res["discrepancies"]) == 0)
    _assert("lines_matched 1", res["summary"]["lines_matched"] == 1)
    ok, reason = ThreeWayMatchService.can_post_bill(res)
    _assert("can post", ok)


def t2_billed_more_than_received():
    """PO 10, GR 5, Bill 10 => block."""
    print("\nT2 - bill exceeds received => block")
    po = {"lines": [{"po_line_id": "PL1", "qty_ordered": 10, "unit_price": 5}]}
    receipts = [{"lines": [{"po_line_id": "PL1", "qty_received": 5, "unit_cost": 5}]}]
    bill = {"lines": [{"po_line_id": "PL1", "qty_billed": 10, "unit_price": 5}]}
    res = ThreeWayMatchService.match(po, receipts, bill)
    _assert("status discrepancy", res["match_status"] == "discrepancy")
    has_qty_disc = any(d["type"] == "qty_over_received" for d in res["discrepancies"])
    _assert("qty_over_received recorded", has_qty_disc)
    ok, reason = ThreeWayMatchService.can_post_bill(res)
    _assert("cannot post", not ok)


def t3_billed_more_than_ordered():
    """PO 10, GR 15 (over-receipt), Bill 12 => qty_over_ordered block."""
    print("\nT3 - bill exceeds ordered => block")
    po = {"lines": [{"po_line_id": "PL1", "qty_ordered": 10, "unit_price": 5}]}
    receipts = [{"lines": [{"po_line_id": "PL1", "qty_received": 15, "unit_cost": 5}]}]
    bill = {"lines": [{"po_line_id": "PL1", "qty_billed": 12, "unit_price": 5}]}
    res = ThreeWayMatchService.match(po, receipts, bill)
    has = any(d["type"] == "qty_over_ordered" for d in res["discrepancies"])
    _assert("qty_over_ordered recorded", has)


def t4_price_variance_warn():
    """PO @5, Bill @5.20 (4%) => warn (within 5% tolerance)."""
    print("\nT4 - price variance within tolerance => warn? actually no — pct=4% < 5%")
    po = {"lines": [{"po_line_id": "PL1", "qty_ordered": 10, "unit_price": 5.0}]}
    receipts = [{"lines": [{"po_line_id": "PL1", "qty_received": 10, "unit_cost": 5.0}]}]
    bill = {"lines": [{"po_line_id": "PL1", "qty_billed": 10, "unit_price": 5.20}]}
    res = ThreeWayMatchService.match(po, receipts, bill)
    _assert("matched (within tolerance)", res["match_status"] == "matched",
            res["match_status"])


def t5_price_variance_block():
    """PO @5, Bill @5.60 => 12% > 2*5% => block."""
    print("\nT5 - price variance > 10% (2x tolerance) => block")
    po = {"lines": [{"po_line_id": "PL1", "qty_ordered": 10, "unit_price": 5.0}]}
    receipts = [{"lines": [{"po_line_id": "PL1", "qty_received": 10, "unit_cost": 5.0}]}]
    bill = {"lines": [{"po_line_id": "PL1", "qty_billed": 10, "unit_price": 5.60}]}
    res = ThreeWayMatchService.match(po, receipts, bill)
    blocks = [d for d in res["discrepancies"] if d["severity"] == "block"]
    _assert("has block discrepancy", len(blocks) > 0,
            f"discrepancies={res['discrepancies']}")
    _assert("status discrepancy", res["match_status"] == "discrepancy")


def t6_price_variance_warn_only():
    """PO @5, Bill @5.35 => 7% > 5% but < 10% => warn only."""
    print("\nT6 - price variance 5-10% => warn (still partial, can post)")
    po = {"lines": [{"po_line_id": "PL1", "qty_ordered": 10, "unit_price": 5.0}]}
    receipts = [{"lines": [{"po_line_id": "PL1", "qty_received": 10, "unit_cost": 5.0}]}]
    bill = {"lines": [{"po_line_id": "PL1", "qty_billed": 10, "unit_price": 5.35}]}
    res = ThreeWayMatchService.match(po, receipts, bill)
    _assert("status partial", res["match_status"] == "partial",
            res["match_status"])
    ok, _ = ThreeWayMatchService.can_post_bill(res)
    _assert("can post (warn only)", ok)


def t7_extra_bill_line():
    """Bill references unknown po_line_id => block."""
    print("\nT7 - extra bill line not in PO => block")
    po = {"lines": [{"po_line_id": "PL1", "qty_ordered": 10, "unit_price": 5}]}
    receipts = []
    bill = {"lines": [
        {"po_line_id": "PL1", "qty_billed": 5, "unit_price": 5},
        {"po_line_id": "PL_GHOST", "qty_billed": 1, "unit_price": 99},
    ]}
    res = ThreeWayMatchService.match(po, receipts, bill)
    has = any(d["type"] == "extra_line" for d in res["discrepancies"])
    _assert("extra_line recorded", has)


def t8_partial_billing():
    """PO 10, GR 10, Bill only 5 => matched line + signals partial."""
    print("\nT8 - partial bill (5 of 10 received)")
    po = {"lines": [{"po_line_id": "PL1", "qty_ordered": 10, "unit_price": 5}]}
    receipts = [{"lines": [{"po_line_id": "PL1", "qty_received": 10, "unit_cost": 5}]}]
    bill = {"lines": [{"po_line_id": "PL1", "qty_billed": 5, "unit_price": 5}]}
    res = ThreeWayMatchService.match(po, receipts, bill)
    # Bill line itself is fine; line is matched. No discrepancies.
    _assert("matched (the billed line is consistent)",
            res["match_status"] == "matched", res["match_status"])
    _assert("billed_total 25", res["summary"]["billed_total"] == 25.0)
    _assert("received_total 50", res["summary"]["received_total"] == 50.0)


def t9_unbilled_received():
    """PO has line PL2 received but bill omits it => partial status (informational)."""
    print("\nT9 - PO line received but not billed => partial signal")
    po = {"lines": [
        {"po_line_id": "PL1", "qty_ordered": 10, "unit_price": 5},
        {"po_line_id": "PL2", "qty_ordered": 4, "unit_price": 7},
    ]}
    receipts = [{"lines": [
        {"po_line_id": "PL1", "qty_received": 10, "unit_cost": 5},
        {"po_line_id": "PL2", "qty_received": 4, "unit_cost": 7},
    ]}]
    bill = {"lines": [{"po_line_id": "PL1", "qty_billed": 10, "unit_price": 5}]}
    res = ThreeWayMatchService.match(po, receipts, bill)
    _assert("status partial", res["match_status"] == "partial",
            res["match_status"])
    _assert("PL2 in unbilled_received_lines",
            "PL2" in res["unbilled_received_lines"])


def t10_multiple_receipts_aggregated():
    """Two GRs for same PO line: 6 + 4 = 10 received."""
    print("\nT10 - multiple receipts aggregated")
    po = {"lines": [{"po_line_id": "PL1", "qty_ordered": 10, "unit_price": 5}]}
    receipts = [
        {"lines": [{"po_line_id": "PL1", "qty_received": 6, "unit_cost": 5}]},
        {"lines": [{"po_line_id": "PL1", "qty_received": 4, "unit_cost": 5}]},
    ]
    bill = {"lines": [{"po_line_id": "PL1", "qty_billed": 10, "unit_price": 5}]}
    res = ThreeWayMatchService.match(po, receipts, bill)
    _assert("matched after aggregation", res["match_status"] == "matched",
            res["match_status"])


def main():
    print("=" * 70)
    print("PHASE 5 SMOKE TEST - Three-Way Match (PO-GR-Bill)")
    print("=" * 70)
    t1_perfect_match()
    t2_billed_more_than_received()
    t3_billed_more_than_ordered()
    t4_price_variance_warn()
    t5_price_variance_block()
    t6_price_variance_warn_only()
    t7_extra_bill_line()
    t8_partial_billing()
    t9_unbilled_received()
    t10_multiple_receipts_aggregated()

    print("\n" + "=" * 70)
    p = sum(1 for r in results if r[0] == "PASS")
    f = sum(1 for r in results if r[0] == "FAIL")
    print(f"RESULT: {p} PASS, {f} FAIL")
    print("=" * 70)
    if f:
        for s, n, d in results:
            if s == "FAIL":
                print(f"  FAIL: {n} - {d}")
    return 0 if f == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
