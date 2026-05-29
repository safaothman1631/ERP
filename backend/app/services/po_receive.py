"""Atomic PO received status transition."""
from __future__ import annotations

from datetime import datetime

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.services.firestore_tx import TenantMismatchError, assert_org_doc


def mark_po_received_atomic(
    org_id: str,
    purchase_order_id: str,
    *,
    status: str,
    received_by: str | None,
) -> dict:
    db = get_db()
    po_ref = db.collection("purchase_orders").document(purchase_order_id)
    now = datetime.utcnow().isoformat()

    @fs.transactional
    def _receive(transaction: fs.Transaction) -> dict:
        snap = po_ref.get(transaction=transaction)
        if not snap.exists:
            raise TenantMismatchError("po_not_found")
        po = assert_org_doc(snap.to_dict(), org_id, label="po")
        transaction.update(
            po_ref,
            {
                "status": status,
                "received_at": now,
                "received_by": received_by,
                "updated_at": now,
            },
        )
        return {**po, "id": purchase_order_id, "status": status, "received_at": now}

    return _receive(db.transaction())
