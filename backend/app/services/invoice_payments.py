"""Atomic payment received + invoice balance updates."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.cache import cache


def _money(value) -> Decimal:
    """Quantize to 2-dp money with deterministic half-up rounding."""
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _invoice_balance_after(inv: dict, amount: float) -> tuple[float, str]:
    # Decimal math so sub-cent float drift can't leave an invoice un-closable
    # (the previous float subtraction could yield 0.0000001 → never "paid").
    current = _money(inv.get("balance_due") or inv.get("total") or 0)
    new_balance = current - _money(amount)
    # Close at <= 0.01 (1 fils), mirroring the AP side, to absorb rounding residue.
    status = "paid" if new_balance <= Decimal("0.01") else "partially_paid"
    return float(max(Decimal("0"), new_balance)), status


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


def create_payment_received_with_je_atomic(
    org_id: str,
    payment_id: str,
    payment_data: dict,
    *,
    deposit_account_id: str,
    ar_account_id: str,
    je_description: str = "",
    created_by: str | None = None,
    currency_code: str = "IQD",
    exchange_rate: float = 1.0,
) -> dict:
    """P0 Fix 2 — create payments_received doc + invoice balances + a
    ``Dr Cash/Bank / Cr Accounts Receivable`` journal entry, all in ONE Firestore
    transaction. The AR mirror of bill_payments.create_payment_made_with_je_atomic.

    The JE uses a deterministic uuid5 entry id (``receipt-je:{payment_id}``) so a
    transaction retry overwrites rather than double-posts. One JE pair covers the
    whole receipt (Cash debited once, AR credited once); the per-invoice
    balance_due decrements still happen individually in the same transaction.
    """
    from app.services.journal_entry_atomic import create_journal_entry_in_transaction

    db = get_db()
    pay_ref = db.collection("payments_received").document(payment_id)
    now = datetime.utcnow()

    total_amount = _money(payment_data.get("amount") or 0)
    payload = {**payment_data, "org_id": org_id, "created_at": now, "updated_at": now}

    legacy_invoice_id = payment_data.get("invoice_id")
    allocations = payment_data.get("allocations") or []
    invoice_updates: list[tuple[str, Decimal]] = []
    if legacy_invoice_id:
        invoice_updates.append((legacy_invoice_id, total_amount))
    for alloc in allocations:
        inv_id = alloc.get("invoice_id") if isinstance(alloc, dict) else getattr(alloc, "invoice_id", None)
        amt = alloc.get("amount", 0) if isinstance(alloc, dict) else getattr(alloc, "amount", 0)
        if inv_id and amt:
            invoice_updates.append((inv_id, _money(amt)))

    je_lines = [
        {"account_id": deposit_account_id, "debit": float(total_amount), "credit": 0,
         "description": je_description or f"Payment {payment_data.get('payment_number', '')}"},
        {"account_id": ar_account_id, "debit": 0, "credit": float(total_amount),
         "description": je_description or "Receipt from customer",
         "contact_id": payment_data.get("contact_id")},
    ]

    counter_transitions: list[tuple[dict, dict]] = []

    @fs.transactional
    def _create(transaction: fs.Transaction) -> dict:
        inv_refs = []
        inv_snaps = []
        for inv_id, _amt in invoice_updates:
            ref = db.collection("invoices").document(inv_id)
            inv_refs.append((ref, inv_id))
            inv_snaps.append(ref.get(transaction=transaction))

        journal, _touched = create_journal_entry_in_transaction(
            transaction, db, org_id,
            date=payment_data.get("date") or now,
            lines=je_lines,
            description=je_description or f"Receipt {payment_data.get('payment_number', '')}",
            source_type="payment_received",
            source_id=payment_id,
            currency_code=currency_code,
            exchange_rate=exchange_rate,
            created_by=created_by,
            entry_id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"receipt-je:{payment_id}")),
        )
        payload["journal_entry_id"] = journal["id"]
        transaction.set(pay_ref, payload)

        for (ref, inv_id), snap, (_inv_id, amt) in zip(inv_refs, inv_snaps, invoice_updates):
            if not snap.exists:
                raise ValueError(f"invoice_not_found:{inv_id}")
            inv = snap.to_dict() or {}
            if inv.get("org_id") != org_id:
                raise ValueError(f"invoice_not_found:{inv_id}")
            new_balance, status = _invoice_balance_after(inv, amt)
            transaction.update(ref, {"balance_due": new_balance, "status": status, "updated_at": now})
            cache.delete(f"invoices:{inv_id}")
            counter_transitions.append((inv, {**inv, "balance_due": new_balance, "status": status}))

        return {"id": payment_id, **payload, "journal_entry_id": journal["id"]}

    result = _create(db.transaction())
    cache.delete(f"payments_received:{payment_id}")
    if counter_transitions:
        from app.services.org_counters import transition_invoice_counters

        for before, after in counter_transitions:
            transition_invoice_counters(org_id, before, after)
    return result
