"""Perpetual inventory valuation (Pool 3.4) — pure cost engine.

Two methods, each with its own state shape:

* **FIFO** — a list of cost *layers* (oldest first), each ``{"qty", "unit_cost"}``.
  A receipt appends a layer; an issue consumes the oldest layers and the COGS is
  the *actual* cost of the consumed layers.
* **Moving average** — a running ``{"qty", "value"}`` state. A receipt adds
  qty + cost to the pool; an issue is costed at the current weighted-average
  unit cost (``value / qty``).

These functions are PURE (no I/O) so the money math is exhaustively unit-tested.
Persistence + COGS wiring layer on top of them (flag-gated, standard-cost stays
the default until perpetual valuation is enabled).

All money is rounded to 4 dp internally; callers quantize to currency precision.
"""
from __future__ import annotations

_EPS = 1e-9


def _r(x: float) -> float:
    return round(float(x), 4)


# ───────────────────────────── FIFO ─────────────────────────────

def fifo_qty(layers: list[dict]) -> float:
    return _r(sum(float(l.get("qty", 0) or 0) for l in layers))


def fifo_value(layers: list[dict]) -> float:
    return _r(sum(float(l.get("qty", 0) or 0) * float(l.get("unit_cost", 0) or 0) for l in layers))


def fifo_receive(layers: list[dict], qty: float, unit_cost: float, meta: dict | None = None) -> list[dict]:
    """Append a new cost layer (returns a new list; input not mutated)."""
    if qty <= _EPS:
        return [dict(l) for l in layers]
    layer = {"qty": _r(qty), "unit_cost": _r(unit_cost)}
    if meta:
        layer.update({k: v for k, v in meta.items() if k not in ("qty", "unit_cost")})
    return [dict(l) for l in layers] + [layer]


def fifo_issue(layers: list[dict], qty: float) -> tuple[float, list[dict], float]:
    """Consume ``qty`` oldest-first. Returns (cogs, remaining_layers, short_qty).

    ``short_qty`` > 0 means stock ran out (oversell); COGS then covers only the
    quantity that was actually on hand — the caller decides how to value the
    shortfall (block, backorder, or last-cost)."""
    need = float(qty)
    cogs = 0.0
    out: list[dict] = []
    for layer in layers:  # oldest first
        lq = float(layer.get("qty", 0) or 0)
        lc = float(layer.get("unit_cost", 0) or 0)
        if need > _EPS and lq > _EPS:
            take = min(lq, need)
            cogs += take * lc
            need -= take
            rem = lq - take
            if rem > _EPS:
                kept = dict(layer)
                kept["qty"] = _r(rem)
                out.append(kept)
        else:
            out.append(dict(layer))
    short = _r(need) if need > _EPS else 0.0
    return _r(cogs), out, short


# ───────────────────────── Moving average ─────────────────────────

def avg_state(qty: float = 0.0, value: float = 0.0) -> dict:
    return {"qty": _r(qty), "value": _r(value)}


def avg_unit_cost(state: dict) -> float:
    q = float(state.get("qty", 0) or 0)
    v = float(state.get("value", 0) or 0)
    return _r(v / q) if q > _EPS else 0.0


def avg_receive(state: dict, qty: float, unit_cost: float) -> dict:
    if qty <= _EPS:
        return avg_state(state.get("qty", 0), state.get("value", 0))
    return avg_state(
        float(state.get("qty", 0) or 0) + qty,
        float(state.get("value", 0) or 0) + qty * unit_cost,
    )


def avg_issue(state: dict, qty: float) -> tuple[float, dict, float]:
    """Issue ``qty`` at the current weighted-average cost. Returns
    (cogs, new_state, short_qty)."""
    on_hand = float(state.get("qty", 0) or 0)
    unit = avg_unit_cost(state)
    take = min(on_hand, float(qty)) if qty > 0 else 0.0
    cogs = take * unit
    short = _r(float(qty) - take) if float(qty) - take > _EPS else 0.0
    new = avg_state(
        on_hand - take,
        max(0.0, float(state.get("value", 0) or 0) - cogs),
    )
    return _r(cogs), new, short


# ───────────────────────── Dispatch ─────────────────────────

FIFO = "fifo"
AVERAGE = "average"


def issue_cogs(method: str, state, qty: float):
    """Unified issue: dispatch on method. ``state`` is layers (FIFO) or an
    avg-state dict (AVERAGE). Returns (cogs, new_state, short_qty)."""
    if method == FIFO:
        return fifo_issue(state, qty)
    return avg_issue(state, qty)


def receive(method: str, state, qty: float, unit_cost: float, meta: dict | None = None):
    if method == FIFO:
        return fifo_receive(state, qty, unit_cost, meta)
    return avg_receive(state, qty, unit_cost)
