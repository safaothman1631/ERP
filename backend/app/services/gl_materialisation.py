"""Materialised GL balances per account/period (Wave A)."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from google.cloud import firestore as fs

from app.config import settings


def _period_key(date_val: datetime | str) -> str:
    if isinstance(date_val, datetime):
        return date_val.strftime("%Y%m")
    s = str(date_val).replace(" ", "T")[:10]
    return s[:4] + s[5:7] if len(s) >= 7 else datetime.utcnow().strftime("%Y%m")


def update_gl_balance_in_transaction(
    transaction: fs.Transaction,
    db: Any,
    org_id: str,
    account_id: str,
    period: str,
    debit_delta: float,
    credit_delta: float,
) -> None:
    if not getattr(settings, "GL_MATERIALISATION_ENABLED", False):
        return
    doc_id = f"{org_id}_{period}_{account_id}"
    ref = db.collection("gl_account_balances").document(doc_id)
    snap = ref.get(transaction=transaction)
    if snap.exists:
        transaction.update(
            ref,
            {
                "debit_total": fs.Increment(debit_delta),
                "credit_total": fs.Increment(credit_delta),
                "updated_at": datetime.utcnow(),
            },
        )
    else:
        transaction.set(
            ref,
            {
                "org_id": org_id,
                "account_id": account_id,
                "period": period,
                "debit_total": debit_delta,
                "credit_total": credit_delta,
                "balance": debit_delta - credit_delta,
                "updated_at": datetime.utcnow(),
            },
        )


def apply_je_lines_to_gl(
    transaction: fs.Transaction,
    db: Any,
    org_id: str,
    je_date: datetime | str,
    lines: list[dict],
) -> None:
    period = _period_key(je_date)
    for line in lines or []:
        aid = line.get("account_id")
        if not aid:
            continue
        update_gl_balance_in_transaction(
            transaction,
            db,
            org_id,
            aid,
            period,
            float(line.get("debit", 0) or 0),
            float(line.get("credit", 0) or 0),
        )
