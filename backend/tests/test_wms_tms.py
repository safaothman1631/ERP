"""Pool 3.5 WMS bin allocation + TMS freight/route engines (pure)."""
from app.services import wms_allocation as W
from app.services import tms_rating as T


# ── WMS putaway ───────────────────────────────────────────────────
def _bins():
    return [
        {"bin_id": "A", "zone": "z1", "capacity": 10, "load": 8, "item_id": "itm"},
        {"bin_id": "B", "zone": "z1", "capacity": 10, "load": 0},
    ]


def test_putaway_consolidate_prefers_item_affinity():
    alloc, left = W.putaway(_bins(), 5, item_id="itm", strategy="consolidate")
    assert alloc == [{"bin_id": "A", "qty": 2.0}, {"bin_id": "B", "qty": 3.0}]
    assert left == 0.0


def test_putaway_spread_prefers_emptiest():
    alloc, left = W.putaway(_bins(), 5, item_id="itm", strategy="spread")
    assert alloc == [{"bin_id": "B", "qty": 5.0}] and left == 0.0


def test_putaway_leftover_when_full():
    _, left = W.putaway(_bins(), 15, item_id="itm")
    assert left == 3.0  # capacity 2 + 10 = 12


# ── WMS pick ──────────────────────────────────────────────────────
def _stock():
    return [
        {"bin_id": "A", "item_id": "itm", "qty": 5, "received_at": "2026-01-01", "seq": 9},
        {"bin_id": "B", "item_id": "itm", "qty": 5, "received_at": "2026-02-01", "seq": 1},
        {"bin_id": "C", "item_id": "itm", "qty": 5, "received_at": "2026-01-15", "seq": 0},
    ]


def test_pick_fifo_oldest_first():
    alloc, short = W.pick(_stock(), "itm", 7, strategy="fifo")
    assert alloc == [{"bin_id": "A", "qty": 5.0}, {"bin_id": "C", "qty": 2.0}] and short == 0.0


def test_pick_nearest_by_seq():
    alloc, short = W.pick(_stock(), "itm", 7, strategy="nearest")
    assert alloc == [{"bin_id": "C", "qty": 5.0}, {"bin_id": "B", "qty": 2.0}] and short == 0.0


def test_pick_short_when_insufficient():
    _, short = W.pick(_stock(), "itm", 20, strategy="fifo")
    assert short == 5.0  # only 15 on hand


# ── TMS freight ───────────────────────────────────────────────────
def test_rate_freight_formula():
    r = T.rate_freight(weight_kg=10, distance_km=50)  # 5000 + 2500 + 6000 = 13500
    assert r["cost"] == 13500.0


def test_rate_freight_min_charge_floor():
    r = T.rate_freight(weight_kg=0, distance_km=0)  # base 5000 < min 7000
    assert r["cost"] == 7000.0 and r["breakdown"]["floored_to_min"]


def test_rate_freight_zone_and_service_mult():
    r = T.rate_freight(weight_kg=10, distance_km=50, zone="regional", service="express")
    assert r["cost"] == round(13500 * 1.4 * 1.6, 2)


# ── TMS route ─────────────────────────────────────────────────────
def test_optimize_route_nearest_neighbour():
    d = {("S", "A"): 10, ("S", "B"): 5, ("S", "C"): 20,
         ("B", "A"): 3, ("B", "C"): 15, ("A", "C"): 8}

    def dist(a, b):
        return d.get((a, b)) or d.get((b, a)) or 0

    order, total = T.optimize_route("S", ["A", "B", "C"], dist)
    assert order == ["B", "A", "C"] and total == 16.0
