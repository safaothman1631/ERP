"""Atomic stock move validation and picking completion."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.services.firestore_tx import TenantMismatchError, assert_org_doc


def _stock_qty(stock: dict | None) -> float:
    if not stock:
        return 0.0
    return float(stock.get("quantity", stock.get("qty", 0)) or 0)


def _find_warehouse_stock_doc(
    transaction: fs.Transaction,
    db: Any,
    org_id: str,
    warehouse_id: str,
    item_id: str,
) -> tuple[Any | None, dict | None]:
    query = (
        db.collection("warehouse_stock")
        .where("org_id", "==", org_id)
        .where("warehouse_id", "==", warehouse_id)
        .where("item_id", "==", item_id)
        .limit(1)
    )
    docs = list(query.stream(transaction=transaction))
    if not docs:
        return None, None
    doc = docs[0]
    return doc.reference, doc.to_dict() or {}


def validate_stock_move_atomic(
    org_id: str,
    move_id: str,
    *,
    validated_by: str | None = None,
) -> dict:
    db = get_db()
    move_ref = db.collection("stock_movements").document(move_id)
    now = datetime.utcnow()

    @fs.transactional
    def _validate(transaction: fs.Transaction) -> dict:
        move_snap = move_ref.get(transaction=transaction)
        if not move_snap.exists:
            raise TenantMismatchError("move_not_found")
        move = assert_org_doc(move_snap.to_dict(), org_id, label="move")

        state = str(move.get("state") or "")
        if state == "done":
            return {"id": move_id, "state": "done", "message": "Already validated"}
        if state == "cancelled":
            raise ValueError("stock_move_cancelled")

        qty = float(move.get("quantity", 0) or 0)
        if qty <= 0:
            raise ValueError("stock_move_invalid_qty")

        item_id = move.get("item_id")
        from_loc = move.get("from_location_id")
        to_loc = move.get("to_location_id")
        if not item_id:
            raise ValueError("stock_move_missing_item")

        if from_loc:
            stock_ref, stock_data = _find_warehouse_stock_doc(
                transaction, db, org_id, from_loc, item_id
            )
            available = _stock_qty(stock_data)
            if stock_ref is None or available + 1e-9 < qty:
                raise ValueError(f"insufficient_stock:{available}")
            new_qty = available - qty
            transaction.update(
                stock_ref,
                {"quantity": new_qty, "qty": new_qty, "updated_at": now},
            )

        if to_loc:
            stock_ref, stock_data = _find_warehouse_stock_doc(
                transaction, db, org_id, to_loc, item_id
            )
            current = _stock_qty(stock_data)
            new_qty = current + qty
            if stock_ref is not None:
                transaction.update(
                    stock_ref,
                    {"quantity": new_qty, "qty": new_qty, "updated_at": now},
                )
            else:
                transaction.set(
                    db.collection("warehouse_stock").document(str(uuid.uuid4())),
                    {
                        "org_id": org_id,
                        "warehouse_id": to_loc,
                        "item_id": item_id,
                        "quantity": new_qty,
                        "qty": new_qty,
                        "created_at": now.isoformat(),
                        "updated_at": now.isoformat(),
                    },
                )

        transaction.update(
            move_ref,
            {
                "state": "done",
                "validated_at": now.isoformat(),
                "validated_by": validated_by,
                "updated_at": now,
            },
        )
        return {
            **move,
            "id": move_id,
            "state": "done",
            "validated_at": now.isoformat(),
            "validated_by": validated_by,
        }

    return _validate(db.transaction())


def done_picking_atomic(
    org_id: str,
    picking_id: str,
    *,
    done_by: str | None = None,
) -> dict:
    db = get_db()
    picking_ref = db.collection("stock_movements").document(picking_id)
    now = datetime.utcnow()

    @fs.transactional
    def _done(transaction: fs.Transaction) -> dict:
        picking_snap = picking_ref.get(transaction=transaction)
        if not picking_snap.exists:
            raise TenantMismatchError("picking_not_found")
        picking = assert_org_doc(picking_snap.to_dict(), org_id, label="picking")
        if picking.get("type") != "picking":
            raise TenantMismatchError("picking_not_found")
        if picking.get("status") not in ("confirmed", "draft"):
            raise ValueError("picking_invalid_status")

        warehouse_id = picking.get("warehouse_id")
        for line in picking.get("lines") or []:
            item_id = line.get("item_id")
            qty = float(line.get("qty") or line.get("quantity") or 0)
            if not item_id or qty <= 0 or not warehouse_id:
                continue
            stock_ref, stock_data = _find_warehouse_stock_doc(
                transaction, db, org_id, warehouse_id, item_id
            )
            if stock_ref is not None:
                current = _stock_qty(stock_data)
                new_qty = current - qty
                transaction.update(
                    stock_ref,
                    {"qty": new_qty, "quantity": new_qty, "updated_at": now},
                )
            else:
                transaction.set(
                    db.collection("warehouse_stock").document(str(uuid.uuid4())),
                    {
                        "org_id": org_id,
                        "item_id": item_id,
                        "warehouse_id": warehouse_id,
                        "qty": -qty,
                        "quantity": -qty,
                        "created_at": now.isoformat(),
                        "updated_at": now.isoformat(),
                    },
                )

        transaction.update(
            picking_ref,
            {
                "status": "done",
                "done_at": now.isoformat(),
                "done_by": done_by,
                "updated_at": now,
            },
        )
        return {
            **picking,
            "id": picking_id,
            "status": "done",
            "done_at": now.isoformat(),
            "done_by": done_by,
        }

    return _done(db.transaction())
