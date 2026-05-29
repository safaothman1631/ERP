"""Atomic purchase-order to bill conversion."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.services.firestore_tx import TenantMismatchError, assert_org_doc


def _allocate_bill_number(transaction: fs.Transaction, db: Any, org_id: str) -> str:
    seq_doc_id = f"{org_id}_bill"
    seq_ref = db.collection("sequences").document(seq_doc_id)
    seq_snap = seq_ref.get(transaction=transaction)
    if seq_snap.exists:
        seq_data = seq_snap.to_dict() or {}
        next_num = int(seq_data.get("next_number", 1))
        prefix = seq_data.get("prefix", "BIL-")
        padding = int(seq_data.get("padding", 6))
        transaction.update(seq_ref, {"next_number": next_num + 1})
    else:
        next_num = 1
        prefix = "BIL-"
        padding = 6
        transaction.set(
            seq_ref,
            {
                "org_id": org_id,
                "entity_type": "bill",
                "prefix": prefix,
                "next_number": 2,
                "padding": padding,
            },
        )
    return f"{prefix}{str(next_num).zfill(padding)}"


def convert_purchase_order_to_bill_atomic(
    org_id: str,
    purchase_order_id: str,
    *,
    status: str,
) -> dict:
    db = get_db()
    po_ref = db.collection("purchase_orders").document(purchase_order_id)
    now = datetime.utcnow()
    today = now.isoformat()[:10]

    @fs.transactional
    def _convert(transaction: fs.Transaction) -> dict:
        po_snap = po_ref.get(transaction=transaction)
        if not po_snap.exists:
            raise TenantMismatchError("po_not_found")
        po = assert_org_doc(po_snap.to_dict(), org_id, label="po")

        lines = po.get("lines") or [
            {"id": doc.id, **(doc.to_dict() or {})}
            for doc in po_ref.collection("lines").stream(transaction=transaction)
        ]

        bill_id = str(uuid.uuid4())
        bill_number = _allocate_bill_number(transaction, db, org_id)
        bill_ref = db.collection("bills").document(bill_id)

        total = float(po.get("total", 0) or 0)
        bill_payload = {
            "org_id": org_id,
            "bill_number": bill_number,
            "contact_id": po.get("contact_id"),
            "date": today,
            "due_date": today,
            "currency_code": po.get("currency_code") or po.get("currency", "IQD"),
            "subtotal": po.get("subtotal", 0),
            "tax_amount": po.get("tax_amount", 0),
            "total": total,
            "balance_due": total,
            "status": "draft",
            "purchase_order_id": purchase_order_id,
            "notes": po.get("notes", ""),
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }
        transaction.set(bill_ref, bill_payload)

        for idx, line in enumerate(lines):
            payload = {k: v for k, v in (line or {}).items() if k != "id"}
            payload["sort_order"] = idx
            transaction.set(
                bill_ref.collection("lines").document(str(uuid.uuid4())),
                payload,
            )

        transaction.update(
            po_ref,
            {
                "status": status,
                "bill_id": bill_id,
                "updated_at": now,
            },
        )
        return {
            "id": bill_id,
            "bill_number": bill_number,
            "purchase_order_id": purchase_order_id,
        }

    return _convert(db.transaction())
