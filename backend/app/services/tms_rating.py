"""TMS freight rating + route engine (Pool 3.5) — pure, unit-tested.

``rate_freight`` computes a deterministic freight charge from a rate card;
``optimize_route`` orders stops with a nearest-neighbour heuristic. No I/O.
"""
from __future__ import annotations

from typing import Callable

_DEFAULT_CARD = {
    "base": 5000.0,           # IQD flat
    "per_kg": 250.0,
    "per_km": 120.0,
    "zone_mult": {"domestic": 1.0, "regional": 1.4, "remote": 2.0},
    "service_mult": {"standard": 1.0, "express": 1.6, "economy": 0.8},
    "min_charge": 7000.0,
}


def rate_freight(
    *,
    weight_kg: float,
    distance_km: float,
    zone: str = "domestic",
    service: str = "standard",
    rate_card: dict | None = None,
) -> dict:
    """Freight = (base + per_kg·weight + per_km·distance) · zone_mult · service_mult,
    floored at min_charge. Returns {cost, breakdown}."""
    card = {**_DEFAULT_CARD, **(rate_card or {})}
    base = float(card["base"])
    weight_cost = float(card["per_kg"]) * max(0.0, float(weight_kg))
    distance_cost = float(card["per_km"]) * max(0.0, float(distance_km))
    zone_mult = float(card["zone_mult"].get(zone, 1.0))
    service_mult = float(card["service_mult"].get(service, 1.0))
    subtotal = (base + weight_cost + distance_cost) * zone_mult * service_mult
    cost = round(max(subtotal, float(card["min_charge"])), 2)
    return {
        "cost": cost,
        "breakdown": {
            "base": base,
            "weight_cost": round(weight_cost, 2),
            "distance_cost": round(distance_cost, 2),
            "zone_mult": zone_mult,
            "service_mult": service_mult,
            "floored_to_min": cost == round(float(card["min_charge"]), 2) and subtotal < float(card["min_charge"]),
        },
    }


def optimize_route(
    start: str,
    stops: list[str],
    dist: Callable[[str, str], float],
) -> tuple[list[str], float]:
    """Nearest-neighbour stop ordering from ``start``. ``dist(a, b)`` returns the
    leg distance. Returns (ordered_stops, total_distance)."""
    remaining = list(stops)
    order: list[str] = []
    cur = start
    total = 0.0
    while remaining:
        nxt = min(remaining, key=lambda s: dist(cur, s))
        total += float(dist(cur, nxt))
        order.append(nxt)
        remaining.remove(nxt)
        cur = nxt
    return order, round(total, 4)
