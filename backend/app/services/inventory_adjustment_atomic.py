"""Atomic inventory adjustment post (item stock + movement)."""
from __future__ import annotations

import uuid
from datetime import datetime

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.services.firestore_tx import TenantMismatchError, assert_org_doc


def post_adjustment_atomic(org_id: str, adjustment: dict) -> dict:
    """Apply quantity_adjusted to trackable item and mark adjustment posted."""
    item_id = adjustment.get("item_id")
    if not item_id:
        raise ValueError("item_id_required")
    adj_id = adjustment.get("id") or str(uuid.uuid4())
    qty_delta = float(adjustment.get("quantity_adjusted", 0) or 0)

    db = get_db()
    item_ref = db.collection("items").document(item_id)
    adj_ref = db.collection("inventory_adjustments").document(adj_id)
    now = datetime.utcnow()

    @fs.transactional
    def _post(transaction: fs.Transaction) -> dict:
        item_snap = item_ref.get(transaction=transaction)
        if not item_snap.exists:
            raise TenantMismatchError("item_not_found")
        item = assert_org_doc(item_snap.to_dict(), org_id, label="item")
        if not item.get("is_trackable", True):
            payload = {
                **adjustment,
                "id": adj_id,
                "org_id": org_id,
                "status": "posted",
                "updated_at": now,
                "created_at": adjustment.get("created_at") or now,
            }
            transaction.set(adj_ref, payload)
            return payload

        current = float(item.get("stock_on_hand", 0) or 0)
        new_qty = current + qty_delta
        transaction.update(
            item_ref,
            {"stock_on_hand": new_qty, "updated_at": now},
        )
        payload = {
            **adjustment,
            "id": adj_id,
            "org_id": org_id,
            "status": "posted",
            "balance_after": new_qty,
            "updated_at": now,
            "created_at": adjustment.get("created_at") or now,
        }
        transaction.set(adj_ref, payload)
        mov_ref = db.collection("stock_movements").document(str(uuid.uuid4()))
        transaction.set(
            mov_ref,
            {
                "org_id": org_id,
                "item_id": item_id,
                "quantity": qty_delta,
                "type": "adjustment",
                "reference_type": "inventory_adjustment",
                "reference_id": adj_id,
                "balance_after": new_qty,
                "created_at": now.isoformat(),
                "user_id": adjustment.get("created_by_id"),
            },
        )
        return payload

    result = _post(db.transaction())
    from app.cache import cache

    cache.delete(f"items:{item_id}")
    return result
