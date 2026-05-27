"""Atomic POS sync inventory deduction."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from google.cloud import firestore as fs

from app.cache import cache
from app.firebase_client import get_db
from app.services.pos_inventory import line_quantity


def deduct_inventory_for_order_atomic(
    org_id: str,
    order_id: str,
    user_id: str,
    lines: list[dict] | None = None,
) -> dict:
    from app.firestore.pos import POSOrderLineRepository

    if lines is None:
        line_repo = POSOrderLineRepository(org_id)
        lines, _ = line_repo.list(
            filters=[{"field": "order_id", "op": "==", "value": order_id}],
            limit=1000,
        )

    db = get_db()
    now = datetime.utcnow().isoformat()
    item_reads: list[tuple[Any, str, float]] = []
    for line in lines or []:
        item_id = line.get("item_id") or line.get("product_id")
        qty = line_quantity(line)
        if not item_id or qty <= 0:
            continue
        item_reads.append((db.collection("items").document(item_id), item_id, qty))

    @fs.transactional
    def _deduct(transaction: fs.Transaction) -> dict:
        item_snaps = [item_ref.get(transaction=transaction) for item_ref, _, _ in item_reads]
        touched: list[str] = []
        movement_count = 0

        for (item_ref, item_id, qty), item_snap in zip(item_reads, item_snaps):
            if not item_snap.exists:
                continue
            item = item_snap.to_dict() or {}
            if item.get("org_id") != org_id or not item.get("is_trackable", True):
                continue
            current = float(item.get("stock_on_hand", 0) or 0)
            if current + 1e-9 < qty:
                raise ValueError(f"insufficient_stock:{item_id}:{current}")
            new_qty = current - qty
            transaction.update(item_ref, {"stock_on_hand": new_qty, "updated_at": now})
            movement_ref = db.collection("stock_movements").document(str(uuid.uuid4()))
            transaction.set(
                movement_ref,
                {
                    "org_id": org_id,
                    "item_id": item_id,
                    "quantity": -qty,
                    "type": "pos_sale",
                    "reference_type": "pos_order",
                    "reference_id": order_id,
                    "balance_after": new_qty,
                    "created_at": now,
                    "user_id": user_id,
                },
            )
            touched.append(item_id)
            movement_count += 1

        return {"updated_items": len(set(touched)), "movement_count": movement_count, "touched": touched}

    result = _deduct(db.transaction())
    for item_id in result["touched"]:
        cache.delete(f"items:{item_id}")
    return {"updated_items": result["updated_items"], "movement_count": result["movement_count"]}
