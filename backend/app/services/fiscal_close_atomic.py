"""Atomic fiscal close finalization (year + lock)."""
from __future__ import annotations

from datetime import datetime

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.services.firestore_tx import TenantMismatchError, assert_org_doc


def finalize_fiscal_year_close_atomic(
    org_id: str,
    year_id: str,
    *,
    lock_date: str,
    closing_journal_id: str | None,
    closed_by: str | None,
) -> dict:
    db = get_db()
    year_ref = db.collection("fiscal_years").document(year_id)
    lock_ref = db.collection("transaction_locks").document(org_id)
    now = datetime.utcnow()
    now_iso = now.isoformat()

    @fs.transactional
    def _finalize(transaction: fs.Transaction) -> dict:
        year_snap = year_ref.get(transaction=transaction)
        if not year_snap.exists:
            raise TenantMismatchError("fiscal_year_not_found")
        fiscal_year = assert_org_doc(year_snap.to_dict(), org_id, label="fiscal_year")

        updates = {
            "is_closed": True,
            "is_current": False,
            "closed_at": now_iso,
            "closing_journal_id": closing_journal_id,
            "updated_at": now,
        }
        if closed_by:
            updates["closed_by"] = closed_by
        transaction.update(year_ref, updates)

        lock_payload = {
            "org_id": org_id,
            "lock_date": str(lock_date)[:10],
            "updated_at": now_iso,
            "updated_by": closed_by,
        }
        transaction.set(lock_ref, lock_payload, merge=True)
        return {**fiscal_year, "id": year_id, **updates}

    return _finalize(db.transaction())
