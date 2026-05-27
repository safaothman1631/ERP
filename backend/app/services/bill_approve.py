"""Atomic bill approval (draft -> open)."""
from __future__ import annotations

from datetime import datetime

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.services.firestore_tx import TenantMismatchError, assert_org_doc


def approve_bill_atomic(
    org_id: str,
    bill_id: str,
    *,
    approved_by_id: str,
    approved_by_name: str,
) -> dict:
    db = get_db()
    bill_ref = db.collection("bills").document(bill_id)
    now = datetime.utcnow().isoformat()

    before_bill: dict | None = None
    after_bill: dict | None = None

    @fs.transactional
    def _approve(transaction: fs.Transaction) -> dict:
        nonlocal before_bill, after_bill
        snap = bill_ref.get(transaction=transaction)
        if not snap.exists:
            raise TenantMismatchError("bill_not_found")
        bill = assert_org_doc(snap.to_dict(), org_id, label="bill")
        if bill.get("status") != "draft":
            raise ValueError("bill_not_draft")
        before_bill = bill
        after_bill = {
            **bill,
            "status": "open",
            "approved_at": now,
            "approved_by_id": approved_by_id,
            "approved_by_name": approved_by_name,
        }
        transaction.update(
            bill_ref,
            {
                "status": "open",
                "approved_at": now,
                "approved_by_id": approved_by_id,
                "approved_by_name": approved_by_name,
                "updated_at": datetime.utcnow(),
            },
        )
        return {**after_bill, "id": bill_id}

    result = _approve(db.transaction())
    if before_bill and after_bill:
        from app.cache import cache
        from app.services.org_counters import transition_bill_counters

        cache.delete(f"bills:{bill_id}")
        transition_bill_counters(org_id, before_bill, after_bill)
    return result
