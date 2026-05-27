"""Atomic payment made + bill balance updates (AP)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.cache import cache


def _bill_balance_after(bill: dict, amount: float) -> tuple[float, str]:
    current = float(bill.get("balance_due") or bill.get("total") or 0)
    new_balance = current - float(amount or 0)
    if new_balance <= 0.01:
        return 0.0, "paid"
    return max(0.0, round(new_balance, 2)), "partially_paid"


def apply_bill_payment_atomic(org_id: str, bill_id: str, amount: float) -> dict | None:
    """Update bill balance_due/status in a transaction."""
    db = get_db()
    bill_ref = db.collection("bills").document(bill_id)

    before_bill: dict | None = None
    after_bill: dict | None = None

    @fs.transactional
    def _apply(transaction: fs.Transaction) -> dict | None:
        nonlocal before_bill, after_bill
        snap = bill_ref.get(transaction=transaction)
        if not snap.exists:
            return None
        bill = snap.to_dict() or {}
        if bill.get("org_id") != org_id:
            return None
        before_bill = bill
        new_balance, status = _bill_balance_after(bill, amount)
        after_bill = {**bill, "balance_due": new_balance, "status": status}
        transaction.update(
            bill_ref,
            {
                "balance_due": new_balance,
                "status": status,
                "updated_at": datetime.utcnow(),
            },
        )
        return {"id": bill_id, "balance_due": new_balance, "status": status}

    result = _apply(db.transaction())
    cache.delete(f"bills:{bill_id}")
    if result and before_bill and after_bill:
        from app.services.org_counters import transition_bill_counters

        transition_bill_counters(org_id, before_bill, after_bill)
    return result


def create_payment_made_atomic(org_id: str, payment_id: str, payment_data: dict) -> dict:
    """Create payments_made doc and apply bill balance in one transaction."""
    db = get_db()
    pay_ref = db.collection("payments_made").document(payment_id)
    bill_id = payment_data.get("bill_id")
    amount = float(payment_data.get("amount") or 0)
    now = datetime.utcnow()
    payload = {**payment_data, "org_id": org_id, "created_at": now, "updated_at": now}

    if not bill_id:
        raise ValueError("bill_id_required")

    bill_ref = db.collection("bills").document(bill_id)

    before_bill: dict | None = None
    after_bill: dict | None = None

    @fs.transactional
    def _create(transaction: fs.Transaction) -> dict:
        nonlocal before_bill, after_bill
        bill_snap = bill_ref.get(transaction=transaction)
        if not bill_snap.exists:
            raise ValueError(f"bill_not_found:{bill_id}")
        bill = bill_snap.to_dict() or {}
        if bill.get("org_id") != org_id:
            raise ValueError(f"bill_not_found:{bill_id}")
        before_bill = bill
        new_balance, status = _bill_balance_after(bill, amount)
        after_bill = {**bill, "balance_due": new_balance, "status": status}
        transaction.set(pay_ref, payload)
        transaction.update(
            bill_ref,
            {
                "balance_due": new_balance,
                "status": status,
                "updated_at": now,
            },
        )
        cache.delete(f"bills:{bill_id}")
        return {"id": payment_id, **payload, "bill_status": status, "bill_balance_due": new_balance}

    result = _create(db.transaction())
    if before_bill and after_bill:
        from app.services.org_counters import transition_bill_counters

        transition_bill_counters(org_id, before_bill, after_bill)
    return result


def create_payment_made_with_je_atomic(
    org_id: str,
    payment_id: str,
    payment_data: dict,
    *,
    je_lines: list[dict],
    je_description: str = "",
    je_date: datetime | str | None = None,
    created_by: str | None = None,
    currency_code: str = "IQD",
    exchange_rate: float = 1.0,
) -> dict:
    """Create payment + bill balance + journal entry in one Firestore transaction."""
    bill_id = payment_data.get("bill_id")
    if not bill_id:
        raise ValueError("bill_id_required")
    if not je_lines:
        raise ValueError("je_lines_required")

    from app.services.journal_entry_atomic import create_journal_entry_in_transaction

    db = get_db()
    pay_ref = db.collection("payments_made").document(payment_id)
    amount = float(payment_data.get("amount") or 0)
    now = datetime.utcnow()
    payload = {**payment_data, "org_id": org_id, "created_at": now, "updated_at": now}

    bill_ref = db.collection("bills").document(bill_id)
    before_bill: dict | None = None
    after_bill: dict | None = None

    @fs.transactional
    def _create(transaction: fs.Transaction) -> dict:
        nonlocal before_bill, after_bill
        bill_snap = bill_ref.get(transaction=transaction)
        if not bill_snap.exists:
            raise ValueError(f"bill_not_found:{bill_id}")
        bill = bill_snap.to_dict() or {}
        if bill.get("org_id") != org_id:
            raise ValueError(f"bill_not_found:{bill_id}")
        before_bill = bill
        new_balance, status = _bill_balance_after(bill, amount)
        after_bill = {**bill, "balance_due": new_balance, "status": status}

        journal, _ = create_journal_entry_in_transaction(
            transaction,
            db,
            org_id,
            date=je_date or payment_data.get("date") or now,
            lines=je_lines,
            description=je_description,
            source_type="payment_made",
            source_id=payment_id,
            currency_code=currency_code,
            exchange_rate=exchange_rate,
            created_by=created_by,
        )
        payload["journal_entry_id"] = journal["id"]
        transaction.set(pay_ref, payload)
        transaction.update(
            bill_ref,
            {
                "balance_due": new_balance,
                "status": status,
                "updated_at": now,
            },
        )
        return {
            "id": payment_id,
            **payload,
            "journal_entry_id": journal["id"],
            "bill_status": status,
            "bill_balance_due": new_balance,
        }

    result = _create(db.transaction())
    cache.delete(f"bills:{bill_id}")
    cache.delete(f"payments_made:{payment_id}")
    if before_bill and after_bill:
        from app.services.org_counters import transition_bill_counters

        transition_bill_counters(org_id, before_bill, after_bill)
    return result


def void_payment_made_atomic(org_id: str, payment_id: str) -> dict:
    """Void payment and restore bill balance atomically."""
    db = get_db()
    pay_ref = db.collection("payments_made").document(payment_id)
    now = datetime.utcnow()
    before_bill: dict | None = None
    after_bill: dict | None = None

    @fs.transactional
    def _void(transaction: fs.Transaction) -> dict:
        nonlocal before_bill, after_bill
        pay_snap = pay_ref.get(transaction=transaction)
        if not pay_snap.exists:
            raise ValueError("payment_not_found")
        payment = pay_snap.to_dict() or {}
        if payment.get("org_id") != org_id:
            raise ValueError("payment_not_found")
        if payment.get("status") == "void":
            return {"id": payment_id, "status": "void", "already_void": True}

        bill_id = payment.get("bill_id")
        amount = float(payment.get("amount") or 0)
        if bill_id:
            bill_ref = db.collection("bills").document(bill_id)
            bill_snap = bill_ref.get(transaction=transaction)
            if bill_snap.exists:
                bill = bill_snap.to_dict() or {}
                if bill.get("org_id") == org_id:
                    before_bill = bill
                    restored = float(bill.get("balance_due") or 0) + amount
                    total = float(bill.get("total") or restored)
                    new_balance = round(min(restored, total), 2)
                    new_status = "open" if new_balance >= total - 0.01 else "partially_paid"
                    after_bill = {**bill, "balance_due": new_balance, "status": new_status}
                    transaction.update(
                        bill_ref,
                        {
                            "balance_due": new_balance,
                            "status": new_status,
                            "updated_at": now,
                        },
                    )

        transaction.update(
            pay_ref,
            {"status": "void", "voided_at": now, "updated_at": now},
        )
        return {"id": payment_id, "status": "void"}

    result = _void(db.transaction())
    if before_bill and after_bill:
        from app.services.org_counters import transition_bill_counters

        transition_bill_counters(org_id, before_bill, after_bill)
        cache.delete(f"bills:{before_bill.get('id')}")
    cache.delete(f"payments_made:{payment_id}")
    return result
