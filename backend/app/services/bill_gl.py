"""GL posting + reversal for the supplier-bill lifecycle (AP side).

The AP mirror of app/services/invoice_gl.py. On bill APPROVE (draft -> open) post
``Dr Expense/Inventory / Cr Accounts Payable``; on void/cancel post the reversing
entry. Idempotent (a ``gl_posted`` guard + a deterministic uuid5 entry id) and
soft-skips when the chart of accounts is missing. NEVER raises into the caller.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import HTTPException

from app.services.accounting import AccountingService

logger = logging.getLogger(__name__)


def _deterministic_je_id(bill_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"bill-je:{bill_id}"))


def post_bill_approval_je(
    org_id: str, bill: dict, bill_lines: list, *, created_by: str | None = None
):
    """Post Dr Expense/Inventory / Cr Accounts Payable for an approved bill.

    Idempotent (returns ``{"skipped": "already_posted"}`` once posted) with a
    deterministic entry id. Returns None (logged) when the chart of accounts is
    not configured, so approve does not hard-fail on a fresh tenant.
    """
    if bill.get("gl_posted") and bill.get("journal_entry_id"):
        return {"id": bill["journal_entry_id"], "skipped": "already_posted"}
    if bill.get("status") in ("draft", "void", "cancelled"):
        return None

    entry_id = _deterministic_je_id(bill["id"])
    try:
        return AccountingService.create_bill_journal(
            org_id,
            {**bill, "_je_entry_id": entry_id, "created_by": created_by},
            bill_lines or [],
        )
    except HTTPException as exc:
        logger.warning("Bill JE skipped for %s: %s", bill.get("id"), exc.detail)
        return None


def reverse_bill_je(
    org_id: str, bill: dict, *, reversal_date, user_id: str | None = None
):
    """Reverse the approval JE when a bill is voided/cancelled."""
    je_id = bill.get("journal_entry_id")
    if not je_id:
        return None
    try:
        return AccountingService.reverse_journal_entry(
            org_id,
            je_id,
            reversal_date,
            user_id=user_id,
            description=f"Reverse bill {bill.get('bill_number', bill['id'])}",
        )
    except HTTPException as exc:
        logger.warning("Bill JE reversal skipped for %s: %s", bill.get("id"), exc.detail)
        return None
