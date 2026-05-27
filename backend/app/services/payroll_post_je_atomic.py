"""Atomic payroll JE posting (journal + payroll run link)."""
from __future__ import annotations

from datetime import datetime

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.services.firestore_tx import TenantMismatchError, assert_org_doc
from app.services.journal_entry_atomic import create_journal_entry_in_transaction


def post_payroll_journal_atomic(
    org_id: str,
    run_id: str,
    *,
    posting_date: datetime | str,
    lines: list[dict],
    created_by: str | None,
    reference: str,
    notes: str,
) -> dict:
    db = get_db()
    run_ref = db.collection("payroll_runs").document(run_id)
    now = datetime.utcnow()

    @fs.transactional
    def _post(transaction: fs.Transaction) -> dict:
        run_snap = run_ref.get(transaction=transaction)
        if not run_snap.exists:
            raise TenantMismatchError("run_not_found")
        run = assert_org_doc(run_snap.to_dict(), org_id, label="run")
        if run.get("status") != "confirmed":
            raise ValueError("run_not_confirmed")
        if run.get("journal_entry_id"):
            raise ValueError("run_already_posted")

        journal, _touched = create_journal_entry_in_transaction(
            transaction,
            db,
            org_id,
            date=posting_date,
            lines=lines,
            description=notes,
            reference=reference,
            source_type="payroll_run",
            source_id=run_id,
            currency_code=str(run.get("currency_code") or "IQD"),
            exchange_rate=float(run.get("exchange_rate") or 1.0),
            created_by=created_by,
            status="posted",
            extra_header={
                "entry_type": "payroll",
                "notes": notes,
            },
        )

        transaction.update(
            run_ref,
            {"journal_entry_id": journal["id"], "updated_at": now},
        )

        return {
            "run_id": run_id,
            "journal_entry_id": journal["id"],
            "entry_number": journal.get("entry_number"),
        }

    return _post(db.transaction())
