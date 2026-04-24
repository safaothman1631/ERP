"""Smoke test for Phase 8 MRP / BOM Service."""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.firebase_client import init_firebase
from app.services.mrp import BOMService

init_firebase()

results = []


def _assert(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((status, name, detail))
    print(f"  [{status}] {name}{(' - ' + detail) if detail else ''}")


# ===== Fixtures =====

def _bicycle_boms():
    """Bicycle BOM:
       Bike (1) -> Frame(1) + Wheel(2) + Seat(1)
       Wheel    -> Rim(1) + Spoke(32) + Tube(1) + Tyre(1)
       Frame, Seat, Rim, Spoke, Tube, Tyre = raw materials
    """
    return {
        "BIKE": {
            "id": "BOM-BIKE", "is_active": True,
            "components": [
                {"component_item_id": "FRAME", "qty_per_parent": 1},
                {"component_item_id": "WHEEL", "qty_per_parent": 2},
                {"component_item_id": "SEAT", "qty_per_parent": 1},
            ],
        },
        "WHEEL": {
            "id": "BOM-WHEEL", "is_active": True,
            "components": [
                {"component_item_id": "RIM", "qty_per_parent": 1},
                {"component_item_id": "SPOKE", "qty_per_parent": 32},
                {"component_item_id": "TUBE", "qty_per_parent": 1},
                {"component_item_id": "TYRE", "qty_per_parent": 1, "scrap_pct": 0.05},
            ],
        },
    }


# ===== Tests =====

def t1_explode_simple():
    """Make 1 BIKE => Frame=1, Wheel(via)=2 => Rim=2, Spoke=64, Tube=2, Tyre=2.10
    + Seat=1"""
    print("\nT1 - explode 1 bike to raw materials")
    boms = _bicycle_boms()
    out = BOMService.explode_bom(boms, "BIKE", 1.0)
    by_item = {}
    for l in out:
        by_item[l["item_id"]] = by_item.get(l["item_id"], 0) + l["qty"]
    _assert("FRAME = 1", by_item.get("FRAME") == 1.0, str(by_item.get("FRAME")))
    _assert("RIM = 2", by_item.get("RIM") == 2.0, str(by_item.get("RIM")))
    _assert("SPOKE = 64", by_item.get("SPOKE") == 64.0, str(by_item.get("SPOKE")))
    _assert("TUBE = 2", by_item.get("TUBE") == 2.0, str(by_item.get("TUBE")))
    # 2 wheels * 1 tyre/wheel * 1.05 scrap = 2.10
    _assert("TYRE = 2.10 (with 5% scrap)",
            abs(by_item.get("TYRE", 0) - 2.10) < 0.001, str(by_item.get("TYRE")))
    _assert("SEAT = 1", by_item.get("SEAT") == 1.0)


def t2_explode_quantity_scaling():
    """Make 10 bikes => Frame=10, Tyre=21 (10*2*1.05)"""
    print("\nT2 - explode 10 bikes (linear scale)")
    boms = _bicycle_boms()
    out = BOMService.explode_bom(boms, "BIKE", 10.0)
    by = {}
    for l in out:
        by[l["item_id"]] = by.get(l["item_id"], 0) + l["qty"]
    _assert("FRAME = 10", by.get("FRAME") == 10.0)
    _assert("TYRE = 21.0", abs(by.get("TYRE") - 21.0) < 0.001, str(by.get("TYRE")))
    _assert("SPOKE = 640", by.get("SPOKE") == 640.0)


def t3_raw_material_no_bom():
    """Item without a BOM is treated as a raw material leaf."""
    print("\nT3 - item without BOM => raw leaf")
    boms = {}
    out = BOMService.explode_bom(boms, "RAW1", 5.0)
    _assert("1 line", len(out) == 1)
    _assert("RAW1 qty 5", out[0]["item_id"] == "RAW1" and out[0]["qty"] == 5.0)
    _assert("is_raw True", out[0]["is_raw"])


def t4_inactive_bom_treated_as_leaf():
    print("\nT4 - inactive BOM => leaf")
    boms = {"X": {"id": "B", "is_active": False, "components": [
        {"component_item_id": "Y", "qty_per_parent": 99}]}}
    out = BOMService.explode_bom(boms, "X", 1.0)
    _assert("1 line", len(out) == 1)
    _assert("X (not Y)", out[0]["item_id"] == "X")


def t5_circular_bom_detected():
    print("\nT5 - circular BOM raises")
    boms = {
        "A": {"id": "BA", "is_active": True, "components": [
            {"component_item_id": "B", "qty_per_parent": 1}]},
        "B": {"id": "BB", "is_active": True, "components": [
            {"component_item_id": "A", "qty_per_parent": 1}]},
    }
    try:
        BOMService.explode_bom(boms, "A", 1.0)
        _assert("raises ValueError", False, "no exception")
    except ValueError as e:
        _assert("raises ValueError", "Circular" in str(e), str(e))


def t6_compute_requirements_aggregate():
    """Two orders aggregated"""
    print("\nT6 - compute_requirements aggregates orders")
    boms = _bicycle_boms()
    orders = [
        {"item_id": "BIKE", "qty": 10},
        {"item_id": "BIKE", "qty": 5},
    ]
    req = BOMService.compute_requirements(boms, orders)
    _assert("FRAME = 15", req["by_item"].get("FRAME") == 15.0)
    _assert("SPOKE = 960", req["by_item"].get("SPOKE") == 960.0)


def t7_check_availability_shortage():
    print("\nT7 - check_availability flags shortage")
    req = {"by_item": {"FRAME": 10, "RIM": 20}}
    on_hand = {"FRAME": 5, "RIM": 25}
    on_order = {"FRAME": 2}
    av = BOMService.check_availability(req, on_hand, on_order)
    _assert("not fully_available", not av["fully_available"])
    short = {s["item_id"]: s for s in av["shortages"]}
    _assert("FRAME shortage 3", short["FRAME"]["shortfall"] == 3.0,
            str(short["FRAME"]))
    _assert("RIM ok (no shortage)", "RIM" not in short)


def t8_check_availability_all_ok():
    print("\nT8 - all available")
    req = {"by_item": {"FRAME": 5}}
    on_hand = {"FRAME": 100}
    av = BOMService.check_availability(req, on_hand)
    _assert("fully_available", av["fully_available"])
    _assert("0 shortages", len(av["shortages"]) == 0)


def t9_suggest_pos_grouped_by_vendor():
    print("\nT9 - PO suggestion grouped by preferred supplier")
    shortages = [
        {"item_id": "FRAME", "shortfall": 3.0},
        {"item_id": "RIM", "shortfall": 5.0},
        {"item_id": "TYRE", "shortfall": 2.0},
    ]
    pref = {"FRAME": "V1", "RIM": "V1", "TYRE": "V2"}
    suggestions = BOMService.suggest_purchase_orders(shortages, pref)
    by_v = {s["vendor_id"]: s["lines"] for s in suggestions}
    _assert("V1 has 2 lines", len(by_v.get("V1", [])) == 2)
    _assert("V2 has 1 line", len(by_v.get("V2", [])) == 1)


def t10_unknown_supplier_groups_to_none():
    print("\nT10 - items with no preferred vendor go to None bucket")
    shortages = [{"item_id": "X", "shortfall": 1.0}]
    out = BOMService.suggest_purchase_orders(shortages, {})
    _assert("vendor None", out[0]["vendor_id"] is None)
    _assert("1 line", len(out[0]["lines"]) == 1)


def main():
    print("=" * 70)
    print("PHASE 8 SMOKE TEST - MRP / BOM (explosion + requirements)")
    print("=" * 70)
    t1_explode_simple()
    t2_explode_quantity_scaling()
    t3_raw_material_no_bom()
    t4_inactive_bom_treated_as_leaf()
    t5_circular_bom_detected()
    t6_compute_requirements_aggregate()
    t7_check_availability_shortage()
    t8_check_availability_all_ok()
    t9_suggest_pos_grouped_by_vendor()
    t10_unknown_supplier_groups_to_none()

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
