"""Denormalized per-org counters for dashboard (avoids full list scans)."""
from __future__ import annotations

from datetime import datetime

from google.cloud import firestore as fs

from app.firebase_client import get_db


def _doc_ref(org_id: str):
    return get_db().collection("org_counters").document(org_id)


def get_counters(org_id: str) -> dict:
    snap = _doc_ref(org_id).get()
    if not snap.exists:
        return _default_counters(org_id)
    data = snap.to_dict() or {}
    return {**_default_counters(org_id), **data, "org_id": org_id}


def _default_counters(org_id: str) -> dict:
    return {
        "org_id": org_id,
        "invoices_open_balance": 0.0,
        "bills_open_balance": 0.0,
        "invoices_open_count": 0,
        "bills_open_count": 0,
        "updated_at": None,
    }


OPEN_INVOICE_STATUSES = frozenset({"sent", "partially_paid", "overdue"})
OPEN_BILL_STATUSES = frozenset({"open", "partially_paid", "overdue", "approved"})


def _open_invoice_metrics(doc: dict | None) -> tuple[float, int]:
    if not doc or doc.get("status") not in OPEN_INVOICE_STATUSES:
        return 0.0, 0
    return float(doc.get("balance_due") or doc.get("total") or 0), 1


def _open_bill_metrics(doc: dict | None) -> tuple[float, int]:
    if not doc or doc.get("status") not in OPEN_BILL_STATUSES:
        return 0.0, 0
    return float(doc.get("balance_due") or doc.get("total") or 0), 1


def transition_invoice_counters(
    org_id: str, before: dict | None, after: dict | None
) -> None:
    """Adjust denormalized AR counters when invoice open status/balance changes."""
    b_bal, b_cnt = _open_invoice_metrics(before)
    a_bal, a_cnt = _open_invoice_metrics(after)
    d_bal = a_bal - b_bal
    d_cnt = a_cnt - b_cnt
    if d_bal:
        bump_counter(org_id, "invoices_open_balance", d_bal)
    if d_cnt:
        bump_counter(org_id, "invoices_open_count", d_cnt)


def transition_bill_counters(org_id: str, before: dict | None, after: dict | None) -> None:
    b_bal, b_cnt = _open_bill_metrics(before)
    a_bal, a_cnt = _open_bill_metrics(after)
    d_bal = a_bal - b_bal
    d_cnt = a_cnt - b_cnt
    if d_bal:
        bump_counter(org_id, "bills_open_balance", d_bal)
    if d_cnt:
        bump_counter(org_id, "bills_open_count", d_cnt)


def bump_counter(org_id: str, field: str, delta: float) -> None:
    ref = _doc_ref(org_id)
    ref.set(
        {
            "org_id": org_id,
            field: fs.Increment(delta),
            "updated_at": datetime.utcnow(),
        },
        merge=True,
    )


def refresh_counters_from_stream(org_id: str) -> dict:
    """Full recompute from streamed collections (maintenance job)."""
    from app.firestore.invoices import InvoiceRepository
    from app.firestore.bills import BillRepository

    inv_repo = InvoiceRepository(org_id)
    bill_repo = BillRepository(org_id)
    open_inv_status = {"sent", "partially_paid", "overdue"}
    open_bill_status = {"open", "partially_paid", "overdue", "approved"}

    inv_balance = 0.0
    inv_count = 0
    for inv in inv_repo.stream_org_docs():
        if inv.get("status") in open_inv_status:
            inv_balance += float(inv.get("balance_due") or 0)
            inv_count += 1

    bill_balance = 0.0
    bill_count = 0
    for bill in bill_repo.stream_org_docs():
        if bill.get("status") in open_bill_status:
            bill_balance += float(bill.get("balance_due") or 0)
            bill_count += 1

    payload = {
        "org_id": org_id,
        "invoices_open_balance": round(inv_balance, 2),
        "bills_open_balance": round(bill_balance, 2),
        "invoices_open_count": inv_count,
        "bills_open_count": bill_count,
        "updated_at": datetime.utcnow(),
    }
    _doc_ref(org_id).set(payload, merge=True)
    return payload
