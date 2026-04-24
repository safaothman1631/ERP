"""Lot/Serial Allocation Service - Phase 4 Inventory Lots & FEFO

Provides:
- list_available_lots(item_id, warehouse_id): lots with qty > 0
- allocate_fifo(item_id, warehouse_id, qty): pick lots by received_date asc
- allocate_fefo(item_id, warehouse_id, qty): pick by expiry_date asc
- allocate_lifo(item_id, warehouse_id, qty): pick by received_date desc
- consume(allocations): atomically decrement lot quantities
- check_expiring_soon(days): list lots expiring within N days

Design:
- Batch document shape (collection `batches`):
    {
      org_id, item_id, warehouse_id,
      lot_number, serial_number (optional),
      received_date, expiry_date (optional),
      qty_received, qty_on_hand, unit_cost,
      created_at, updated_at,
    }
- Allocation result is a list of dicts: {lot_id, lot_number, qty, unit_cost, expiry_date}
- consume() uses a single batch write to keep all decrements atomic per call.
"""
from datetime import datetime, timedelta
from typing import Optional

from app.firebase_client import get_db
from app.firestore.inventory import BatchRepository

# Allocation strategy constants
STRATEGY_FIFO = "FIFO"
STRATEGY_LIFO = "LIFO"
STRATEGY_FEFO = "FEFO"

ALLOCATION_TOLERANCE = 0.0001


def _to_dt(v) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, str):
        try:
            s = v.replace(" ", "T").rstrip("Z")
            if len(s) == 10:
                s += "T00:00:00"
            return datetime.fromisoformat(s)
        except Exception:
            return None
    return None


class LotAllocationService:

    @staticmethod
    def list_available_lots(
        org_id: str,
        item_id: str,
        warehouse_id: Optional[str] = None,
    ) -> list[dict]:
        """Return lots for an item with qty_on_hand > 0."""
        repo = BatchRepository(org_id)
        items, _ = repo.list(limit=10000)
        out = []
        for b in items:
            if b.get("item_id") != item_id:
                continue
            if warehouse_id and b.get("warehouse_id") != warehouse_id:
                continue
            if float(b.get("qty_on_hand", 0) or 0) <= ALLOCATION_TOLERANCE:
                continue
            out.append(b)
        return out

    @staticmethod
    def _sort_key(strategy: str):
        if strategy == STRATEGY_FIFO:
            return lambda b: _to_dt(b.get("received_date")) or datetime.max
        if strategy == STRATEGY_LIFO:
            return lambda b: -(_to_dt(b.get("received_date")) or datetime.min).timestamp()
        if strategy == STRATEGY_FEFO:
            # No-expiry lots sink to bottom (treated as far-future)
            return lambda b: _to_dt(b.get("expiry_date")) or datetime.max
        raise ValueError(f"Unknown strategy: {strategy}")

    @staticmethod
    def allocate(
        org_id: str,
        item_id: str,
        qty_required: float,
        warehouse_id: Optional[str] = None,
        strategy: str = STRATEGY_FIFO,
        skip_expired: bool = True,
        as_of: Optional[datetime] = None,
    ) -> dict:
        """Greedy allocation against available lots.

        Returns: {
          "allocations": [{lot_id, lot_number, qty, unit_cost, expiry_date}],
          "fully_allocated": bool,
          "qty_allocated": float,
          "qty_short": float,
        }
        """
        if qty_required <= 0:
            return {
                "allocations": [],
                "fully_allocated": True,
                "qty_allocated": 0.0,
                "qty_short": 0.0,
            }

        as_of = as_of or datetime.utcnow()
        lots = LotAllocationService.list_available_lots(org_id, item_id, warehouse_id)

        if skip_expired:
            def _not_expired(b):
                exp = _to_dt(b.get("expiry_date"))
                return exp is None or exp >= as_of
            lots = [b for b in lots if _not_expired(b)]

        lots.sort(key=LotAllocationService._sort_key(strategy))

        allocations = []
        remaining = qty_required
        for b in lots:
            if remaining <= ALLOCATION_TOLERANCE:
                break
            available = float(b.get("qty_on_hand", 0) or 0)
            take = min(available, remaining)
            if take <= ALLOCATION_TOLERANCE:
                continue
            allocations.append({
                "lot_id": b.get("id"),
                "lot_number": b.get("lot_number"),
                "qty": round(take, 4),
                "unit_cost": float(b.get("unit_cost", 0) or 0),
                "expiry_date": b.get("expiry_date"),
            })
            remaining -= take

        qty_allocated = round(qty_required - remaining, 4)
        return {
            "allocations": allocations,
            "fully_allocated": remaining <= ALLOCATION_TOLERANCE,
            "qty_allocated": qty_allocated,
            "qty_short": round(max(remaining, 0.0), 4),
        }

    @staticmethod
    def consume(org_id: str, allocations: list[dict]) -> dict:
        """Atomically decrement qty_on_hand on each allocated lot.

        Refuses if any lot would go negative (race protection).
        Returns: {"consumed": [{lot_id, qty, new_qty}], "errors": []}
        """
        if not allocations:
            return {"consumed": [], "errors": []}

        db = get_db()
        repo = BatchRepository(org_id)
        # Pre-flight read (best-effort; full atomicity would need a tx per lot)
        errors = []
        new_states = {}
        for a in allocations:
            lot = repo.get(a["lot_id"])
            if not lot:
                errors.append({"lot_id": a["lot_id"], "error": "lot not found"})
                continue
            current = float(lot.get("qty_on_hand", 0) or 0)
            new_qty = current - float(a["qty"])
            if new_qty < -ALLOCATION_TOLERANCE:
                errors.append({
                    "lot_id": a["lot_id"],
                    "error": f"insufficient: have {current}, need {a['qty']}",
                })
                continue
            new_states[a["lot_id"]] = round(max(new_qty, 0.0), 4)

        if errors:
            return {"consumed": [], "errors": errors}

        batch = db.batch()
        consumed = []
        for a in allocations:
            doc_ref = db.collection(repo.collection_name).document(a["lot_id"])
            batch.update(doc_ref, {
                "qty_on_hand": new_states[a["lot_id"]],
                "updated_at": datetime.utcnow(),
            })
            consumed.append({
                "lot_id": a["lot_id"],
                "qty": a["qty"],
                "new_qty": new_states[a["lot_id"]],
            })
        batch.commit()
        return {"consumed": consumed, "errors": []}

    @staticmethod
    def check_expiring_soon(
        org_id: str,
        days: int = 30,
        as_of: Optional[datetime] = None,
    ) -> list[dict]:
        """Return lots with qty>0 expiring within `days` days from `as_of`."""
        as_of = as_of or datetime.utcnow()
        cutoff = as_of + timedelta(days=days)
        repo = BatchRepository(org_id)
        items, _ = repo.list(limit=10000)
        out = []
        for b in items:
            if float(b.get("qty_on_hand", 0) or 0) <= ALLOCATION_TOLERANCE:
                continue
            exp = _to_dt(b.get("expiry_date"))
            if exp is None:
                continue
            if as_of <= exp <= cutoff:
                days_left = (exp - as_of).days
                out.append({**b, "days_until_expiry": days_left})
        out.sort(key=lambda x: x["days_until_expiry"])
        return out
