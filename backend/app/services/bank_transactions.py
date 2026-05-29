"""Atomic bank transaction + account balance updates."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.firestore.banking import BankAccountRepository, BankTransactionRepository


def create_bank_transaction_atomic(
    org_id: str,
    user_id: str,
    *,
    bank_account_id: str,
    date: Any,
    transaction_type: str,
    amount: float,
    description: str = "",
    reference: str = "",
    category: str = "",
    matched: bool = False,
    reconciled: bool = False,
) -> dict:
    """Create transaction and update account balance in one Firestore transaction."""
    db = get_db()
    transaction_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    tx_ref = db.collection("bank_transactions").document(transaction_id)
    account_ref = db.collection("bank_accounts").document(bank_account_id)

    @fs.transactional
    def _create(transaction: fs.Transaction) -> dict:
        account_snap = account_ref.get(transaction=transaction)
        if not account_snap.exists:
            raise ValueError("bank_account_not_found")
        account = account_snap.to_dict() or {}
        if account.get("org_id") != org_id:
            raise ValueError("bank_account_not_found")

        current = float(account.get("current_balance", 0) or 0)
        if transaction_type == "credit":
            new_balance = current + float(amount)
        else:
            new_balance = current - float(amount)

        tx_data = {
            "org_id": org_id,
            "bank_account_id": bank_account_id,
            "date": date,
            "transaction_type": transaction_type,
            "amount": amount,
            "description": description,
            "reference": reference,
            "category": category,
            "matched": matched,
            "reconciled": reconciled,
            "created_at": now,
            "updated_at": now,
            "created_by_id": user_id,
        }
        transaction.set(tx_ref, tx_data)
        transaction.update(
            account_ref,
            {"current_balance": new_balance, "updated_at": now},
        )
        return {"id": transaction_id, **tx_data}

    result = _create(db.transaction())
    from app.cache import cache

    cache.delete(f"bank_accounts:{bank_account_id}")
    return result


def create_bank_transaction_via_repo(
    org_id: str,
    user_id: str,
    payload: dict,
) -> Optional[dict]:
    """Wrapper used by API; raises ValueError on missing account."""
    try:
        return create_bank_transaction_atomic(
            org_id,
            user_id,
            bank_account_id=payload["bank_account_id"],
            date=payload.get("date"),
            transaction_type=payload["transaction_type"],
            amount=float(payload["amount"]),
            description=payload.get("description") or "",
            reference=payload.get("reference") or "",
            category=payload.get("category") or "",
            matched=bool(payload.get("matched")),
            reconciled=bool(payload.get("reconciled")),
        )
    except ValueError:
        return None
