"""Atomic stock transfer completion (warehouse_stock + movements)."""
from __future__ import annotations

import uuid
from datetime import datetime

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.services.firestore_tx import TenantMismatchError, assert_org_doc
from app.services.warehouse_move_atomic import _find_warehouse_stock_doc, _stock_qty


def complete_transfer_atomic(
    org_id: str,
    transfer_id: str,
    *,
    lines: list[dict],
    user_id: str | None = None,
) -> dict:
    """Complete transfer: decrement source warehouse, increment destination."""
    db = get_db()
    transfer_ref = db.collection("stock_transfers").document(transfer_id)
    now = datetime.utcnow()

    @fs.transactional
    def _complete(transaction: fs.Transaction) -> dict:
        snap = transfer_ref.get(transaction=transaction)
        if not snap.exists:
            raise TenantMismatchError("transfer_not_found")
        transfer = assert_org_doc(snap.to_dict(), org_id, label="transfer")
        status = transfer.get("status")
        if status in ("completed", "cancelled", "rejected"):
            raise ValueError(f"transfer_invalid_status:{status}")

        from_wh = transfer.get("from_warehouse_id")
        to_wh = transfer.get("to_warehouse_id")
        if not from_wh or not to_wh:
            raise ValueError("transfer_missing_warehouses")

        for line in lines or []:
            item_id = line.get("item_id")
            qty = float(line.get("quantity", 0) or 0)
            if not item_id or qty <= 0:
                continue
            item_ref = db.collection("items").document(item_id)
            item_snap = item_ref.get(transaction=transaction)
            if not item_snap.exists:
                raise TenantMismatchError("item_not_found")
            item = assert_org_doc(item_snap.to_dict(), org_id, label="item")
            if not item.get("is_trackable", True):
                continue

            src_ref, src_data = _find_warehouse_stock_doc(
                transaction, db, org_id, from_wh, item_id
            )
            available = _stock_qty(src_data)
            if src_ref is None or available + 1e-9 < qty:
                raise ValueError(f"insufficient_stock:{available}")
            src_new = round(available - qty, 3)
            transaction.update(
                src_ref,
                {"quantity": src_new, "qty": src_new, "updated_at": now},
            )

            dst_ref, dst_data = _find_warehouse_stock_doc(
                transaction, db, org_id, to_wh, item_id
            )
            dst_current = _stock_qty(dst_data)
            dst_new = round(dst_current + qty, 3)
            if dst_ref is not None:
                transaction.update(
                    dst_ref,
                    {"quantity": dst_new, "qty": dst_new, "updated_at": now},
                )
            else:
                transaction.set(
                    db.collection("warehouse_stock").document(str(uuid.uuid4())),
                    {
                        "org_id": org_id,
                        "warehouse_id": to_wh,
                        "item_id": item_id,
                        "quantity": dst_new,
                        "qty": dst_new,
                        "created_at": now.isoformat(),
                        "updated_at": now.isoformat(),
                    },
                )

            mov_out = db.collection("stock_movements").document(str(uuid.uuid4()))
            transaction.set(
                mov_out,
                {
                    "org_id": org_id,
                    "item_id": item_id,
                    "quantity": -qty,
                    "type": "transfer_out",
                    "reference_type": "stock_transfer",
                    "reference_id": transfer_id,
                    "from_location_id": from_wh,
                    "to_location_id": to_wh,
                    "balance_after": src_new,
                    "created_at": now.isoformat(),
                    "user_id": user_id,
                },
            )
            mov_in = db.collection("stock_movements").document(str(uuid.uuid4()))
            transaction.set(
                mov_in,
                {
                    "org_id": org_id,
                    "item_id": item_id,
                    "quantity": qty,
                    "type": "transfer_in",
                    "reference_type": "stock_transfer",
                    "reference_id": transfer_id,
                    "from_location_id": from_wh,
                    "to_location_id": to_wh,
                    "balance_after": dst_new,
                    "created_at": now.isoformat(),
                    "user_id": user_id,
                },
            )

        transaction.update(
            transfer_ref,
            {
                "status": "completed",
                "completed_at": now.isoformat(),
                "completed_by": user_id,
                "updated_at": now,
            },
        )
        return {**transfer, "id": transfer_id, "status": "completed"}

    return _complete(db.transaction())
