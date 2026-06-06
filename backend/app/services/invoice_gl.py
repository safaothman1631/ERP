"""GL posting + reversal for the standard customer-invoice lifecycle.

P0 finance-correctness Fix 1. Mirrors app/services/pos_accounting.py and
app/services/bill_payments.py: the JE *builder* lives in AccountingService;
this module owns idempotency, the `gl_posted` guard flag, and the void/cancel
reversal. Posting NEVER hard-fails the invoice action — a missing chart of
accounts soft-skips (logged), matching the POS behaviour.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import HTTPException

from app.services.accounting import AccountingService

logger = logging.getLogger(__name__)


def _deterministic_je_id(invoice_id: str) -> str:
    """Stable UUID5 from the invoice id so a retry overwrites, not duplicates."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"invoice-je:{invoice_id}"))


def post_invoice_confirmation_je(
    org_id: str, invoice: dict, *, created_by: str | None = None
) -> dict | None:
    """Post Dr AR / Cr Revenue (/ Cr Tax / discount / shipping / adjustment).

    Idempotent: returns ``{"skipped": "already_posted"}`` if already posted, and
    uses a deterministic entry id so a transaction retry cannot double-post.
    Returns None (logged) when the chart of accounts is not configured yet, so
    confirm does not hard-fail on a fresh tenant.
    """
    if invoice.get("gl_posted") and invoice.get("journal_entry_id"):
        return {"id": invoice["journal_entry_id"], "skipped": "already_posted"}

    # Drafts and already-reversed states never post.
    if invoice.get("status") in ("draft", "void", "cancelled"):
        return None

    entry_id = _deterministic_je_id(invoice["id"])
    try:
        je = AccountingService.create_invoice_journal(
            org_id,
            {**invoice, "_je_entry_id": entry_id, "created_by": created_by},
        )
    except HTTPException as exc:
        # 404 = chart of accounts missing -> soft-skip (do not 500 the confirm).
        logger.warning("Invoice JE skipped for %s: %s", invoice.get("id"), exc.detail)
        return None
    return je


def reverse_invoice_je(
    org_id: str, invoice: dict, *, reversal_date, user_id: str | None = None
) -> dict | None:
    """Reverse the confirmation JE when an invoice is voided/cancelled."""
    je_id = invoice.get("journal_entry_id")
    if not je_id:
        return None
    try:
        return AccountingService.reverse_journal_entry(
            org_id,
            je_id,
            reversal_date,
            user_id=user_id,
            description=f"Reverse invoice {invoice.get('invoice_number', invoice['id'])}",
        )
    except HTTPException as exc:
        # 409 = already reversed (idempotent), 404 = JE gone -> both safe to swallow.
        logger.warning("Invoice JE reversal skipped for %s: %s", invoice.get("id"), exc.detail)
        return None
