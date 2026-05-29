"""Atomic manufacturing order completion with optional warehouse stock posting."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.services.firestore_tx import TenantMismatchError, assert_org_doc
from app.services.warehouse_move_atomic import _find_warehouse_stock_doc, _stock_qty


def _adjust_warehouse_stock(
    transaction: fs.Transaction,
    db: Any,
    org_id: str,
    warehouse_id: str,
    item_id: str,
    delta: float,
    now: datetime,
) -> None:
    stock_ref, stock_data = _find_warehouse_stock_doc(
        transaction, db, org_id, warehouse_id, item_id
    )
    current = _stock_qty(stock_data)
    new_qty = round(current + delta, 3)
    if delta < 0 and stock_ref is None:
        raise ValueError(f"insufficient_stock:{item_id}")
    if delta < 0 and new_qty < -1e-9:
        raise ValueError(f"insufficient_stock:{item_id}")
    if stock_ref is not None:
        transaction.update(
            stock_ref,
            {"quantity": max(0.0, new_qty), "qty": max(0.0, new_qty), "updated_at": now},
        )
    elif delta > 0:
        transaction.set(
            db.collection("warehouse_stock").document(str(uuid.uuid4())),
            {
                "org_id": org_id,
                "warehouse_id": warehouse_id,
                "item_id": item_id,
                "quantity": new_qty,
                "qty": new_qty,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            },
        )


def complete_manufacturing_order_atomic(
    org_id: str,
    mo_id: str,
    *,
    produced_qty: float,
    warehouse_id: str | None = None,
    backorder_payload: dict | None = None,
) -> dict:
    """Mark MO done; optionally consume components and receive finished goods."""
    db = get_db()
    mo_ref = db.collection("manufacturing_orders").document(mo_id)
    now = datetime.utcnow()

    @fs.transactional
    def _complete(transaction: fs.Transaction) -> dict:
        snap = mo_ref.get(transaction=transaction)
        if not snap.exists:
            raise TenantMismatchError("mo_not_found")
        mo = assert_org_doc(snap.to_dict(), org_id, label="mo")
        if mo.get("status") == "done":
            raise ValueError("mo_already_done")

        planned = float(mo.get("quantity", 0) or 0)
        qty = float(produced_qty)
        if qty < 0:
            raise ValueError("produced_qty_invalid")

        wh = warehouse_id or mo.get("warehouse_id")
        product_id = mo.get("product_id")
        components = mo.get("components") or []
        scale = (qty / planned) if planned > 0 else 1.0

        if wh and components:
            for comp in components:
                item_id = comp.get("item_id")
                if not item_id:
                    continue
                req = float(comp.get("required_qty", comp.get("quantity", 0)) or 0)
                consume = round(req * scale, 3)
                if consume <= 0:
                    continue
                _adjust_warehouse_stock(
                    transaction, db, org_id, wh, item_id, -consume, now
                )

        if wh and product_id and qty > 0:
            _adjust_warehouse_stock(
                transaction, db, org_id, wh, product_id, qty, now
            )

        update: dict[str, Any] = {
            "status": "done",
            "produced_qty": qty,
            "done_at": now.isoformat(),
            "updated_at": now,
        }
        if backorder_payload:
            bo_ref = db.collection("manufacturing_orders").document(
                str(backorder_payload["id"])
            )
            transaction.set(bo_ref, backorder_payload)
            update["backorder_id"] = backorder_payload["id"]
            update["backorder_qty"] = backorder_payload.get("quantity")

        transaction.update(mo_ref, update)
        return {**mo, "id": mo_id, **update}

    return _complete(db.transaction())
