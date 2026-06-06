"""WMS bin/location allocation engine (Pool 3.5) — pure putaway + pick logic.

Greenfield + pure (no I/O), so it is fully unit-tested and cannot affect existing
flows. A bin is ``{"bin_id", "zone", "capacity", "load", "item_id"?}``; stock for
picking is ``{"bin_id", "item_id", "qty", "received_at", "seq"?}``.
"""
from __future__ import annotations

_EPS = 1e-9


def putaway(bins: list[dict], qty: float, *, item_id: str | None = None,
            zone: str | None = None, strategy: str = "consolidate") -> tuple[list[dict], float]:
    """Allocate incoming ``qty`` into bins with free capacity.

    strategy ``consolidate`` fills bins already holding ``item_id`` first (fewer
    locations); ``spread`` prefers the emptiest bins (faster picking later).
    Returns (allocations [{"bin_id","qty"}], leftover) — leftover>0 = no space."""
    candidates = [
        b for b in bins
        if (zone is None or b.get("zone") == zone)
        and (float(b.get("capacity", 0) or 0) - float(b.get("load", 0) or 0)) > _EPS
    ]

    def free(b):
        return float(b.get("capacity", 0) or 0) - float(b.get("load", 0) or 0)

    if strategy == "consolidate":
        candidates.sort(key=lambda b: (b.get("item_id") != item_id, free(b)))
    else:  # spread → emptiest first
        candidates.sort(key=lambda b: -free(b))

    need = float(qty)
    allocations: list[dict] = []
    for b in candidates:
        if need <= _EPS:
            break
        take = min(free(b), need)
        if take <= _EPS:
            continue
        allocations.append({"bin_id": b.get("bin_id"), "qty": round(take, 4)})
        need -= take
    return allocations, round(need, 4) if need > _EPS else 0.0


def pick(stock: list[dict], item_id: str, qty: float, *, strategy: str = "fifo") -> tuple[list[dict], float]:
    """Allocate ``qty`` of ``item_id`` from stock locations.

    strategy ``fifo`` picks oldest ``received_at`` first; ``nearest`` picks by the
    smallest ``seq`` (location sequence) to minimise travel. Returns
    (allocations [{"bin_id","qty"}], short) — short>0 = not enough stock."""
    rows = [s for s in stock if s.get("item_id") == item_id and float(s.get("qty", 0) or 0) > _EPS]
    if strategy == "nearest":
        rows.sort(key=lambda s: (s.get("seq", 1e18), s.get("received_at") or ""))
    else:  # fifo
        rows.sort(key=lambda s: (s.get("received_at") or "", s.get("seq", 0)))

    need = float(qty)
    allocations: list[dict] = []
    for s in rows:
        if need <= _EPS:
            break
        take = min(float(s.get("qty", 0) or 0), need)
        allocations.append({"bin_id": s.get("bin_id"), "qty": round(take, 4)})
        need -= take
    return allocations, round(need, 4) if need > _EPS else 0.0
