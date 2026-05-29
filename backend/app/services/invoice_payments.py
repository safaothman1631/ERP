"""Atomic payment received + invoice balance updates."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.cache import cache


def _invoice_balance_after(inv: dict, amount: float) -> tuple[float, str]:
    current = float(inv.get("balance_due") or inv.get("total") or 0)
    new_balance = current - float(amount or 0)
    status = "paid" if new_balance <= 0 else "partially_paid"
    return max(0.0, new_balance), status


def apply_invoice_payment_atomic(org_id: str, invoice_id: str, amount: float) -> dict | None:
    """Update invoice balance_due/status in a transaction (read-then-write)."""
    db = get_db()
    inv_ref = db.collection("invoices").document(invoice_id)

    @fs.transactional
    def _apply(transaction: fs.Transaction) -> dict | None:
        snap = inv_ref.get(transaction=transaction)
        if not snap.exists:
            return None
        inv = snap.to_dict() or {}
        if inv.get("org_id") != org_id:
            return None
        new_balance, status = _invoice_balance_after(inv, amount)
        transaction.update(
            inv_ref,
            {
                "balance_due": new_balance,
                "status": status,
                "updated_at": datetime.utcnow(),
            },
        )
        return {"id": invoice_id, "balance_due": new_balance, "status": status}

    result = _apply(db.transaction())
    cache.delete(f"invoices:{invoice_id}")
    return result


def create_payment_received_atomic(org_id: str, payment_id: str, payment_data: dict) -> dict:
    """Create payment doc; apply legacy invoice or allocations atomically per invoice."""
    db = get_db()
    pay_ref = db.collection("payments_received").document(payment_id)
    now = datetime.utcnow()
    payload = {**payment_data, "org_id": org_id, "created_at": now, "updated_at": now}

    legacy_invoice_id = payment_data.get("invoice_id")
    allocations = payment_data.get("allocations") or []

    invoice_updates: list[tuple[str, float]] = []
    if legacy_invoice_id:
        invoice_updates.append((legacy_invoice_id, float(payment_data.get("amount") or 0)))
    for alloc in allocations:
        if isinstance(alloc, dict):
            inv_id = alloc.get("invoice_id")
            amt = alloc.get("amount", 0)
        else:
            inv_id = getattr(alloc, "invoice_id", None)
            amt = getattr(alloc, "amount", 0)
        if inv_id and amt:
            invoice_updates.append((inv_id, float(amt)))

    counter_transitions: list[tuple[dict, dict]] = []

    @fs.transactional
    def _create(transaction: fs.Transaction) -> dict:
        inv_refs = []
        inv_snaps = []
        for inv_id, _amt in invoice_updates:
            ref = db.collection("invoices").document(inv_id)
            snap = ref.get(transaction=transaction)
            inv_refs.append((ref, inv_id))
            inv_snaps.append(snap)

        transaction.set(pay_ref, payload)

        for (ref, inv_id), snap, (_inv_id, amt) in zip(
            inv_refs, inv_snaps, invoice_updates
        ):
            if not snap.exists:
                raise ValueError(f"invoice_not_found:{inv_id}")
            inv = snap.to_dict() or {}
            if inv.get("org_id") != org_id:
                raise ValueError(f"invoice_not_found:{inv_id}")
            new_balance, status = _invoice_balance_after(inv, amt)
            transaction.update(
                ref,
                {
                    "balance_due": new_balance,
                    "status": status,
                    "updated_at": now,
                },
            )
            cache.delete(f"invoices:{inv_id}")
            counter_transitions.append(
                (
                    inv,
                    {**inv, "balance_due": new_balance, "status": status},
                )
            )

        return {"id": payment_id, **payload}

    result = _create(db.transaction())
    if counter_transitions:
        from app.services.org_counters import transition_invoice_counters

        for before, after in counter_transitions:
            transition_invoice_counters(org_id, before, after)
    return result
