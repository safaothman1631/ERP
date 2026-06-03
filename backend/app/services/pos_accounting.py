"""POS → Invoice and session GL posting for shopkeeper flows."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime

from fastapi import HTTPException

from app.services.accounting import AccountingService

logger = logging.getLogger(__name__)


def create_invoice_from_pos_order(org_id: str, order: dict, lines: list[dict], user_id: str) -> dict:
    """Create a customer invoice from a paid POS order."""
    from app.firestore.invoices import InvoiceRepository
    from app.firestore.system import SequenceRepository
    from app.services.settings_service import get_pos_settings

    contact_id = order.get("partner_id")
    if not contact_id:
        pos_cfg = get_pos_settings(org_id)
        contact_id = pos_cfg.get("walk_in_contact_id")
    if not contact_id:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "pos_invoice_no_contact",
                "message": "Set partner on order or configure pos.walk_in_contact_id",
            },
        )

    inv_repo = InvoiceRepository(org_id)
    seq_repo = SequenceRepository(org_id)
    inv_number = seq_repo.get_next("invoice")
    today = datetime.utcnow().isoformat()[:10]
    subtotal = int(order.get("subtotal", 0) or 0)
    tax_amount = int(order.get("tax_total", 0) or 0)
    total = int(order.get("total", 0) or 0)

    inv_lines = []
    for ln in lines:
        qty = float(ln.get("qty") or ln.get("quantity") or 0)
        unit = int(ln.get("unit_price", 0) or 0)
        line_total = int(ln.get("total") or ln.get("subtotal") or qty * unit)
        inv_lines.append({
            "item_id": ln.get("item_id"),
            "description": ln.get("item_name") or ln.get("description") or "",
            "quantity": qty,
            "unit_price": unit,
            "discount_percent": float(ln.get("discount_percent", 0) or 0),
            "tax_rate": float(ln.get("tax_rate", 0) or 0),
            "tax_amount": int(ln.get("tax_amount", 0) or 0),
            "line_total": line_total,
        })

    invoice = inv_repo.create({
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        # Pool 3.2: tag the entity so the auto-posted JE rolls up to the right
        # company in consolidation. POS is single-entity per shop -> the order's
        # company_id if present, else the org's primary (head) entity.
        "company_id": order.get("company_id") or org_id,
        "contact_id": contact_id,
        "invoice_number": inv_number,
        "date": today,
        "due_date": today,
        "reference": order.get("order_number") or order.get("id"),
        "currency_code": order.get("currency", "IQD"),
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "total": total,
        "balance_due": 0,
        "paid_amount": total,
        "status": "paid",
        "payment_status": "paid",
        "pos_order_id": order.get("id"),
        "notes": f"POS {order.get('order_number', '')}",
        "created_by": user_id,
    })
    if inv_lines:
        inv_repo.set_lines(invoice["id"], inv_lines)

    try:
        AccountingService.create_invoice_journal(org_id, invoice)
    except Exception as exc:
        logger.warning("POS invoice JE skipped for %s: %s", invoice["id"], exc)

    # P0 COGS: Dr COGS / Cr Inventory at standard cost for the sold stocked items.
    # POS sales never go through pickings, so this is the POS goods-out hook
    # (disjoint from done_picking — no double-post). Deterministic id + never
    # breaks the sale.
    try:
        import uuid as _uuid
        from app.services.cogs_gl import _total_standard_cost
        _total = _total_standard_cost(org_id, {"lines": lines})
        if _total > 0:
            AccountingService.create_cogs_journal(
                org_id,
                {
                    "id": invoice["id"],
                    "reference": invoice.get("invoice_number") or invoice["id"],
                    "date": invoice.get("date"),
                    "company_id": invoice.get("company_id") or org_id,
                    "_je_entry_id": str(_uuid.uuid5(_uuid.NAMESPACE_URL, f"pos-cogs:{invoice['id']}")),
                    "created_by": user_id,
                },
                _total,
            )
    except Exception as exc:
        logger.warning("POS COGS JE skipped for %s: %s", invoice["id"], exc)

    return invoice


def post_session_sales_journal(
    org_id: str,
    session: dict,
    total_sales: int,
    total_tax: int,
    cash_total: int,
    non_cash_total: int,
    user_id: str | None = None,
) -> dict | None:
    """Post session sales: Dr cash/card clearing, Cr revenue + tax."""
    if total_sales <= 0:
        return None

    try:
        cash_account = AccountingService._get_account_by_type(org_id, "cash")
        sales_account = AccountingService._get_account_by_type(org_id, "sales")
        tax_account = AccountingService._get_account_by_code(org_id, "2140")
    except HTTPException:
        logger.warning("POS session JE skipped — chart accounts missing for org %s", org_id)
        return None

    revenue = max(0, int(total_sales) - int(total_tax))
    lines: list[dict] = []

    if cash_total > 0:
        lines.append({
            "account_id": cash_account,
            "debit": int(cash_total),
            "credit": 0,
            "description": f"POS session {session.get('id', '')} cash",
        })
    if non_cash_total > 0:
        lines.append({
            "account_id": cash_account,
            "debit": int(non_cash_total),
            "credit": 0,
            "description": f"POS session {session.get('id', '')} card/mobile",
        })
    if revenue > 0:
        lines.append({
            "account_id": sales_account,
            "debit": 0,
            "credit": revenue,
            "description": "POS daily sales",
        })
    if total_tax > 0 and tax_account:
        lines.append({
            "account_id": tax_account,
            "debit": 0,
            "credit": int(total_tax),
            "description": "POS sales tax",
        })

    if len(lines) < 2:
        return None

    return AccountingService.create_journal_entry(
        org_id=org_id,
        date=datetime.utcnow(),
        lines=lines,
        description=f"POS session close {session.get('id', '')}",
        reference=session.get("id", ""),
        source_type="pos_session",
        source_id=session.get("id"),
        created_by=user_id,
    )
