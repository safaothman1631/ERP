"""Persistence + atomic updates for perpetual inventory valuation (Pool 3.4).

Stores one valuation state doc per (org, item) in ``inventory_valuation``:
  { org_id, item_id, method, layers:[...] (FIFO) | qty,value (AVERAGE), updated_at }

``record_receipt`` / ``record_issue`` mutate that state inside a Firestore
transaction (load → apply pure engine → save), so concurrent receipts/sales
stay consistent. The method is per item (defaults to moving AVERAGE).

This is gated by ``PERPETUAL_VALUATION_ENABLED`` at the call sites (cogs_gl /
inventory receipts); when the flag is off, standard-cost COGS is used and these
functions are never called — so the live system is unchanged until enabled.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.services import valuation as V


def _ref(db: Any, org_id: str, item_id: str):
    return db.collection("inventory_valuation").document(f"{org_id}_{item_id}")


def get_state(org_id: str, item_id: str) -> dict | None:
    snap = _ref(get_db(), org_id, item_id).get()
    return snap.to_dict() if snap.exists else None


def on_hand(org_id: str, item_id: str) -> float:
    st = get_state(org_id, item_id) or {}
    if st.get("method") == V.FIFO:
        return V.fifo_qty(st.get("layers", []))
    return float(st.get("qty", 0) or 0)


def record_receipt(
    org_id: str,
    item_id: str,
    qty: float,
    unit_cost: float,
    *,
    method: str = V.AVERAGE,
    source_type: str = "",
    source_id: str = "",
) -> dict:
    """Add inventory at ``unit_cost``. Returns the saved state."""
    db = get_db()
    ref = _ref(db, org_id, item_id)

    @fs.transactional
    def _txn(txn: fs.Transaction) -> dict:
        snap = ref.get(transaction=txn)
        data = snap.to_dict() if snap.exists else {
            "org_id": org_id, "item_id": item_id, "method": method,
        }
        m = data.get("method") or method
        if m == V.FIFO:
            data["layers"] = V.fifo_receive(
                data.get("layers", []), qty, unit_cost,
                {"source_type": source_type, "source_id": source_id,
                 "received_at": datetime.utcnow().isoformat()},
            )
        else:
            ns = V.avg_receive(V.avg_state(data.get("qty", 0), data.get("value", 0)), qty, unit_cost)
            data["qty"], data["value"] = ns["qty"], ns["value"]
        data["method"] = m
        data["updated_at"] = datetime.utcnow()
        txn.set(ref, data)
        return data

    return _txn(db.transaction())


def record_issue(
    org_id: str,
    item_id: str,
    qty: float,
    *,
    method: str = V.AVERAGE,
) -> dict:
    """Consume inventory for a sale/goods-out. Returns {cogs, short, method}."""
    db = get_db()
    ref = _ref(db, org_id, item_id)
    out: dict = {"cogs": 0.0, "short": float(qty), "method": method}

    @fs.transactional
    def _txn(txn: fs.Transaction) -> None:
        snap = ref.get(transaction=txn)
        if not snap.exists:
            return  # no valuation state yet → cogs 0, fully short
        data = snap.to_dict() or {}
        m = data.get("method") or method
        if m == V.FIFO:
            cogs, new_layers, short = V.fifo_issue(data.get("layers", []), qty)
            data["layers"] = new_layers
        else:
            cogs, ns, short = V.avg_issue(
                V.avg_state(data.get("qty", 0), data.get("value", 0)), qty)
            data["qty"], data["value"] = ns["qty"], ns["value"]
        data["updated_at"] = datetime.utcnow()
        txn.set(ref, data)
        out["cogs"], out["short"], out["method"] = cogs, short, m

    _txn(db.transaction())
    return out
