"""Smoke test for Phase 4 Lot/Serial Allocation Service."""
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from app.firebase_client import init_firebase
from app.services import lot_allocation as la_mod
from app.services.lot_allocation import (
    LotAllocationService, STRATEGY_FIFO, STRATEGY_LIFO, STRATEGY_FEFO,
)

init_firebase()

results = []


def _assert(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((status, name, detail))
    print(f"  [{status}] {name}{(' - ' + detail) if detail else ''}")


def _patch(lots):
    """Patch BatchRepository to return given lots."""
    class FakeRepo:
        collection_name = "batches"
        def __init__(self, org_id):
            pass
        def list(self, **kw):
            return list(lots), len(lots)
        def get(self, lot_id):
            return next((l for l in lots if l.get("id") == lot_id), None)
    orig = la_mod.BatchRepository
    la_mod.BatchRepository = FakeRepo
    return orig


def _restore(orig):
    la_mod.BatchRepository = orig


# Common fixtures
def _make_lots():
    return [
        {"id": "L1", "item_id": "ITEM-A", "warehouse_id": "WH1",
         "lot_number": "LOT-001", "received_date": datetime(2026, 1, 15),
         "expiry_date": datetime(2026, 8, 1),
         "qty_on_hand": 50.0, "unit_cost": 10.0},
        {"id": "L2", "item_id": "ITEM-A", "warehouse_id": "WH1",
         "lot_number": "LOT-002", "received_date": datetime(2026, 2, 1),
         "expiry_date": datetime(2026, 6, 1),
         "qty_on_hand": 30.0, "unit_cost": 11.0},
        {"id": "L3", "item_id": "ITEM-A", "warehouse_id": "WH1",
         "lot_number": "LOT-003", "received_date": datetime(2026, 3, 1),
         "expiry_date": datetime(2026, 12, 1),
         "qty_on_hand": 100.0, "unit_cost": 12.0},
        {"id": "L_OTHER", "item_id": "ITEM-B", "warehouse_id": "WH1",
         "lot_number": "LOT-X", "received_date": datetime(2026, 1, 1),
         "qty_on_hand": 99.0, "unit_cost": 5.0},
        {"id": "L_EMPTY", "item_id": "ITEM-A", "warehouse_id": "WH1",
         "lot_number": "LOT-EMPTY", "received_date": datetime(2026, 1, 1),
         "qty_on_hand": 0.0, "unit_cost": 9.0},
    ]


def t1_list_available_filters_zero_and_other_items():
    print("\nT1 - list_available_lots filters by item, excludes qty=0")
    orig = _patch(_make_lots())
    try:
        out = LotAllocationService.list_available_lots("o", "ITEM-A", "WH1")
        ids = sorted([l["id"] for l in out])
        _assert("3 lots returned", len(out) == 3, str(ids))
        _assert("L_EMPTY excluded", "L_EMPTY" not in ids)
        _assert("L_OTHER excluded", "L_OTHER" not in ids)
    finally:
        _restore(orig)


def t2_fifo():
    """FIFO: L1 (Jan15), L2 (Feb), L3 (Mar). Need 60 => L1=50, L2=10."""
    print("\nT2 - FIFO allocation 60 from [50, 30, 100]")
    orig = _patch(_make_lots())
    try:
        # Use as_of after expiry to also test skip_expired off path
        out = LotAllocationService.allocate(
            "o", "ITEM-A", 60.0, "WH1", strategy=STRATEGY_FIFO,
            as_of=datetime(2026, 4, 1),
        )
        _assert("fully allocated", out["fully_allocated"])
        _assert("2 allocations", len(out["allocations"]) == 2,
                str(out["allocations"]))
        _assert("first is L1 qty 50",
                out["allocations"][0]["lot_id"] == "L1" and
                out["allocations"][0]["qty"] == 50.0)
        _assert("second is L2 qty 10",
                out["allocations"][1]["lot_id"] == "L2" and
                out["allocations"][1]["qty"] == 10.0)
    finally:
        _restore(orig)


def t3_lifo():
    """LIFO: L3 first. Need 50 => L3=50."""
    print("\nT3 - LIFO allocation 50")
    orig = _patch(_make_lots())
    try:
        out = LotAllocationService.allocate(
            "o", "ITEM-A", 50.0, "WH1", strategy=STRATEGY_LIFO,
            as_of=datetime(2026, 4, 1),
        )
        _assert("1 allocation", len(out["allocations"]) == 1)
        _assert("L3 picked first",
                out["allocations"][0]["lot_id"] == "L3")
    finally:
        _restore(orig)


def t4_fefo():
    """FEFO with as_of=April. After excluding L2 (expired June... wait, June > April so L2 not expired).
    Order by expiry: L2 (Jun1), L1 (Aug1), L3 (Dec1).
    Need 60 => L2=30, L1=30."""
    print("\nT4 - FEFO allocation 60 picks earliest expiry")
    orig = _patch(_make_lots())
    try:
        out = LotAllocationService.allocate(
            "o", "ITEM-A", 60.0, "WH1", strategy=STRATEGY_FEFO,
            as_of=datetime(2026, 4, 1),
        )
        _assert("2 allocations", len(out["allocations"]) == 2,
                str(out["allocations"]))
        _assert("L2 first (Jun expiry)",
                out["allocations"][0]["lot_id"] == "L2")
        _assert("L1 second qty 30",
                out["allocations"][1]["lot_id"] == "L1" and
                out["allocations"][1]["qty"] == 30.0)
    finally:
        _restore(orig)


def t5_fefo_skips_expired():
    """as_of=July => L2 (expired June) should be skipped."""
    print("\nT5 - FEFO skips expired lots")
    orig = _patch(_make_lots())
    try:
        out = LotAllocationService.allocate(
            "o", "ITEM-A", 60.0, "WH1", strategy=STRATEGY_FEFO,
            as_of=datetime(2026, 7, 1),
        )
        _assert("L2 NOT in allocations",
                all(a["lot_id"] != "L2" for a in out["allocations"]))
        _assert("L1 first (Aug expiry)",
                out["allocations"][0]["lot_id"] == "L1")
    finally:
        _restore(orig)


def t6_partial_allocation_short():
    """Need 999 => only 180 available."""
    print("\nT6 - partial allocation reports shortage")
    orig = _patch(_make_lots())
    try:
        out = LotAllocationService.allocate(
            "o", "ITEM-A", 999.0, "WH1", strategy=STRATEGY_FIFO,
            as_of=datetime(2026, 4, 1),
        )
        _assert("not fully allocated", not out["fully_allocated"])
        _assert("qty_allocated == 180",
                abs(out["qty_allocated"] - 180.0) < 0.01,
                str(out["qty_allocated"]))
        _assert("qty_short == 819",
                abs(out["qty_short"] - 819.0) < 0.01,
                str(out["qty_short"]))
    finally:
        _restore(orig)


def t7_zero_request():
    print("\nT7 - zero qty returns empty")
    orig = _patch(_make_lots())
    try:
        out = LotAllocationService.allocate("o", "ITEM-A", 0.0)
        _assert("0 allocations", len(out["allocations"]) == 0)
        _assert("fully_allocated", out["fully_allocated"])
    finally:
        _restore(orig)


def t8_warehouse_filter():
    """Lots in another warehouse should not be picked."""
    print("\nT8 - warehouse filter respected")
    lots = _make_lots() + [
        {"id": "L_WH2", "item_id": "ITEM-A", "warehouse_id": "WH2",
         "lot_number": "LOT-WH2", "received_date": datetime(2025, 1, 1),
         "qty_on_hand": 1000.0, "unit_cost": 1.0},
    ]
    orig = _patch(lots)
    try:
        out = LotAllocationService.allocate(
            "o", "ITEM-A", 50.0, "WH1", strategy=STRATEGY_FIFO,
            as_of=datetime(2026, 4, 1),
        )
        _assert("L_WH2 NOT picked",
                all(a["lot_id"] != "L_WH2" for a in out["allocations"]))
    finally:
        _restore(orig)


def t9_check_expiring_soon():
    """as_of=May 15, 30 days => only L2 (Jun 1, ~17 days) qualifies."""
    print("\nT9 - check_expiring_soon (30 days window)")
    orig = _patch(_make_lots())
    try:
        out = LotAllocationService.check_expiring_soon(
            "o", days=30, as_of=datetime(2026, 5, 15),
        )
        ids = [l["id"] for l in out]
        _assert("only L2", ids == ["L2"], str(ids))
        _assert("days_until_expiry ~17",
                abs(out[0]["days_until_expiry"] - 17) <= 1,
                str(out[0]["days_until_expiry"]))
    finally:
        _restore(orig)


def t10_unit_cost_preserved():
    print("\nT10 - allocation includes unit_cost (for COGS)")
    orig = _patch(_make_lots())
    try:
        out = LotAllocationService.allocate(
            "o", "ITEM-A", 60.0, "WH1", strategy=STRATEGY_FIFO,
            as_of=datetime(2026, 4, 1),
        )
        _assert("L1 unit_cost 10",
                out["allocations"][0]["unit_cost"] == 10.0)
        _assert("L2 unit_cost 11",
                out["allocations"][1]["unit_cost"] == 11.0)
    finally:
        _restore(orig)


def main():
    print("=" * 70)
    print("PHASE 4 SMOKE TEST - Lot/Serial Allocation (FIFO/LIFO/FEFO)")
    print("=" * 70)
    t1_list_available_filters_zero_and_other_items()
    t2_fifo()
    t3_lifo()
    t4_fefo()
    t5_fefo_skips_expired()
    t6_partial_allocation_short()
    t7_zero_request()
    t8_warehouse_filter()
    t9_check_expiring_soon()
    t10_unit_cost_preserved()

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
