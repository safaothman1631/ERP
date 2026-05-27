"""Atomic GRN receive with lot updates and PO aggregation."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.services.firestore_tx import TenantMismatchError, assert_org_doc


def _query_first(
    transaction: fs.Transaction,
    query: Any,
) -> tuple[Any | None, dict | None]:
    docs = list(query.limit(1).stream(transaction=transaction))
    if not docs:
        return None, None
    doc = docs[0]
    return doc.reference, doc.to_dict() or {}


def create_goods_receipt_atomic(
    org_id: str,
    purchase_order_id: str,
    *,
    warehouse_id: str | None,
    lines: list[dict],
    user_id: str,
    user_name: str = "",
    notes: str | None = None,
) -> dict:
    db = get_db()
    po_ref = db.collection("purchase_orders").document(purchase_order_id)
    now = datetime.utcnow()
    now_iso = now.isoformat()

    @fs.transactional
    def _receive(transaction: fs.Transaction) -> dict:
        po_snap = po_ref.get(transaction=transaction)
        if not po_snap.exists:
            raise TenantMismatchError("po_not_found")
        po = assert_org_doc(po_snap.to_dict(), org_id, label="po")
        if po.get("status") in ("cancelled", "billed"):
            raise ValueError(f"po_invalid_status:{po.get('status')}")

        grn_id = str(uuid.uuid4())
        grn = {
            "id": grn_id,
            "purchase_order_id": purchase_order_id,
            "warehouse_id": warehouse_id,
            "lines": lines,
            "status": "received",
            "received_at": now_iso,
            "received_by_id": user_id,
            "received_by_name": user_name,
            "notes": notes,
            "org_id": org_id,
        }

        goods_receipts = list(po.get("goods_receipts") or [])
        goods_receipts.append(grn)

        received_by_line: dict[str, float] = {}
        for receipt in goods_receipts:
            for ln in receipt.get("lines") or []:
                key = ln.get("po_line_id") or ln.get("item_id")
                if not key:
                    continue
                received_by_line[key] = received_by_line.get(key, 0.0) + float(
                    ln.get("qty_received") or 0
                )

        po_lines = po.get("lines") or [
            {"id": doc.id, **(doc.to_dict() or {})}
            for doc in po_ref.collection("lines").stream(transaction=transaction)
        ]
        ordered_total = sum(
            float(ln.get("qty") or ln.get("quantity") or 0) for ln in po_lines
        )
        received_total = sum(received_by_line.values())

        new_status = po.get("status")
        if ordered_total > 0:
            if received_total >= ordered_total:
                new_status = "received"
            elif received_total > 0:
                new_status = "partially_received"

        transaction.update(
            po_ref,
            {
                "goods_receipts": goods_receipts,
                "received_qty_by_line": received_by_line,
                "status": new_status,
                "updated_at": now,
            },
        )

        item_snapshots: dict[str, dict] = {}
        lot_increments: dict[tuple[str, str], float] = {}
        item_increments: dict[str, float] = {}
        for ln in lines:
            item_id = ln.get("item_id")
            qty = float(ln.get("qty_received") or ln.get("qty") or 0)
            if not item_id or qty <= 0:
                continue
            if item_id not in item_snapshots:
                item_ref = db.collection("items").document(item_id)
                item_snap = item_ref.get(transaction=transaction)
                if not item_snap.exists:
                    continue
                item_data = item_snap.to_dict() or {}
                if item_data.get("org_id") != org_id:
                    continue
                item_snapshots[item_id] = item_data
            item = item_snapshots.get(item_id)
            if not item:
                continue
            tracking = item.get("tracking") or ("lot" if item.get("is_trackable") else "none")
            if tracking not in ("lot", "serial"):
                continue
            effective_qty = 1.0 if tracking == "serial" else qty
            lot_number = (
                ln.get("lot_no")
                or ln.get("lot_number")
                or f"GRN-{str(item_id)[:8]}-{now_iso[:10]}"
            )
            lot_increments[(item_id, str(lot_number))] = lot_increments.get(
                (item_id, str(lot_number)), 0.0
            ) + effective_qty
            item_increments[item_id] = item_increments.get(item_id, 0.0) + effective_qty

        for (item_id, lot_number), qty_delta in lot_increments.items():
            query = (
                db.collection("batches")
                .where("org_id", "==", org_id)
                .where("item_id", "==", item_id)
                .where("batch_number", "==", lot_number)
            )
            batch_ref, batch_data = _query_first(transaction, query)
            if batch_ref is not None:
                current_qty = float(
                    (batch_data or {}).get(
                        "qty_on_hand",
                        (batch_data or {}).get("quantity", 0),
                    )
                    or 0
                )
                new_qty = current_qty + qty_delta
                transaction.update(
                    batch_ref,
                    {
                        "qty_on_hand": new_qty,
                        "quantity": new_qty,
                        "updated_at": now_iso,
                    },
                )
            else:
                transaction.set(
                    db.collection("batches").document(str(uuid.uuid4())),
                    {
                        "org_id": org_id,
                        "item_id": item_id,
                        "warehouse_id": warehouse_id,
                        "batch_number": lot_number,
                        "lot_number": lot_number,
                        "received_date": now_iso,
                        "qty_received": qty_delta,
                        "qty_on_hand": qty_delta,
                        "quantity": qty_delta,
                        "status": "active",
                        "created_at": now_iso,
                        "updated_at": now_iso,
                        "created_by_id": user_id,
                    },
                )

        for item_id, qty_delta in item_increments.items():
            item_ref = db.collection("items").document(item_id)
            current_qty = float(item_snapshots.get(item_id, {}).get("stock_on_hand", 0) or 0)
            transaction.update(
                item_ref,
                {
                    "stock_on_hand": current_qty + qty_delta,
                    "updated_at": now_iso,
                },
            )

        return {"grn": grn, "purchase_order_status": new_status}

    return _receive(db.transaction())
