"""Drift detection helpers for denormalized ERP fields."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


TOLERANCE = 0.01


@dataclass
class DriftRow:
    kind: str
    entity_id: str
    field: str
    stored: float
    computed: float
    delta: float

    def to_dict(self) -> dict:
        return {
            "kind": self.kind,
            "entity_id": self.entity_id,
            "field": self.field,
            "stored": self.stored,
            "computed": self.computed,
            "delta": self.delta,
        }


def compute_bill_balance_drift(
    bill: dict,
    payment_amounts: Iterable[float],
) -> DriftRow | None:
    total = float(bill.get("total") or 0)
    stored = float(bill.get("balance_due") if bill.get("balance_due") is not None else total)
    paid = sum(float(a) for a in payment_amounts)
    computed = max(0.0, total - paid)
    delta = abs(stored - computed)
    if delta > TOLERANCE:
        return DriftRow(
            kind="bill",
            entity_id=bill.get("id", ""),
            field="balance_due",
            stored=stored,
            computed=computed,
            delta=delta,
        )
    return None


def compute_invoice_balance_drift(
    invoice: dict,
    payment_amounts: Iterable[float],
) -> DriftRow | None:
    total = float(invoice.get("total") or 0)
    stored = float(invoice.get("balance_due") if invoice.get("balance_due") is not None else total)
    paid = sum(float(a) for a in payment_amounts)
    computed = max(0.0, total - paid)
    delta = abs(stored - computed)
    if delta > TOLERANCE:
        return DriftRow(
            kind="invoice",
            entity_id=invoice.get("id", ""),
            field="balance_due",
            stored=stored,
            computed=computed,
            delta=delta,
        )
    return None


def compute_stock_drift(
    item: dict,
    movement_qtys: Iterable[float],
    *,
    opening_stock: float | None = None,
) -> DriftRow | None:
    if not item.get("is_trackable", True):
        return None
    stored = float(item.get("stock_on_hand", 0) or 0)
    opening = (
        float(opening_stock)
        if opening_stock is not None
        else float(item.get("opening_stock", 0) or 0)
    )
    computed = opening + sum(float(q) for q in movement_qtys)
    delta = abs(stored - computed)
    if delta > TOLERANCE:
        return DriftRow(
            kind="item",
            entity_id=item.get("id", ""),
            field="stock_on_hand",
            stored=stored,
            computed=computed,
            delta=delta,
        )
    return None


def compute_bank_drift(
    account: dict,
    transactions: Iterable[dict],
    *,
    reconciled_only: bool = False,
) -> DriftRow | None:
    opening = float(account.get("opening_balance", 0) or 0)
    stored = float(account.get("current_balance", 0) or 0)
    computed = opening
    for tx in transactions:
        if reconciled_only and not tx.get("reconciled"):
            continue
        amt = float(tx.get("amount") or 0)
        if tx.get("transaction_type") == "credit":
            computed += amt
        else:
            computed -= amt
    delta = abs(stored - computed)
    if delta > TOLERANCE:
        return DriftRow(
            kind="bank_account",
            entity_id=account.get("id", ""),
            field="current_balance",
            stored=stored,
            computed=computed,
            delta=delta,
        )
    return None


def run_reconcile_for_org(
    org_id: str,
    *,
    fix: bool = False,
    reconciled_only: bool = False,
) -> dict:
    """Scan one org for denormalized field drift; optional --fix writes computed values."""
    from collections import defaultdict

    from app.firebase_client import init_firebase, is_firebase_available
    from app.firestore.banking import BankAccountRepository, BankTransactionRepository
    from app.firestore.bills import BillRepository, PaymentMadeRepository
    from app.firestore.invoices import InvoiceRepository, PaymentReceivedRepository
    from app.firestore.inventory import ItemRepository, StockMovementRepository

    init_firebase()
    if not is_firebase_available():
        raise RuntimeError(
            "Firebase is not configured. Add backend/serviceAccountKey.json or set "
            "GOOGLE_APPLICATION_CREDENTIALS."
        )

    drifts: list[DriftRow] = []

    def _collect(repo) -> list[dict]:
        return list(repo.stream_org_docs())

    inv_repo = InvoiceRepository(org_id)
    pay_repo = PaymentReceivedRepository(org_id)
    invoices = _collect(inv_repo)
    payments = _collect(pay_repo)

    paid_by_invoice: dict[str, list[float]] = defaultdict(list)
    for p in payments:
        inv_id = p.get("invoice_id")
        if inv_id:
            paid_by_invoice[inv_id].append(float(p.get("amount") or 0))
        for alloc in p.get("allocations") or []:
            if isinstance(alloc, dict) and alloc.get("invoice_id"):
                paid_by_invoice[alloc["invoice_id"]].append(float(alloc.get("amount") or 0))

    for inv in invoices:
        inv_id = inv.get("id")
        row = compute_invoice_balance_drift(inv, paid_by_invoice.get(inv_id, []))
        if row:
            drifts.append(row)
            if fix:
                fix_drift_row(org_id, row)

    bill_repo = BillRepository(org_id)
    pm_repo = PaymentMadeRepository(org_id)
    bills = _collect(bill_repo)
    payments_made = _collect(pm_repo)
    paid_by_bill: dict[str, list[float]] = defaultdict(list)
    for p in payments_made:
        bid = p.get("bill_id")
        if bid:
            paid_by_bill[bid].append(float(p.get("amount") or 0))

    for bill in bills:
        bid = bill.get("id")
        row = compute_bill_balance_drift(bill, paid_by_bill.get(bid, []))
        if row:
            drifts.append(row)
            if fix:
                fix_drift_row(org_id, row)

    item_repo = ItemRepository(org_id)
    mov_repo = StockMovementRepository(org_id)
    items = _collect(item_repo)
    movements = _collect(mov_repo)
    qty_by_item: dict[str, list[float]] = defaultdict(list)
    for m in movements:
        iid = m.get("item_id")
        if iid:
            qty_by_item[iid].append(float(m.get("quantity") or 0))

    for item in items:
        iid = item.get("id")
        row = compute_stock_drift(item, qty_by_item.get(iid, []))
        if row:
            drifts.append(row)
            if fix:
                fix_drift_row(org_id, row)

    acct_repo = BankAccountRepository(org_id)
    tx_repo = BankTransactionRepository(org_id)
    accounts = _collect(acct_repo)
    all_tx = _collect(tx_repo)
    tx_by_account: dict[str, list] = defaultdict(list)
    for tx in all_tx:
        tx_by_account[tx.get("bank_account_id", "")].append(tx)

    for account in accounts:
        aid = account.get("id")
        row = compute_bank_drift(
            account,
            tx_by_account.get(aid, []),
            reconciled_only=reconciled_only,
        )
        if row:
            drifts.append(row)
            if fix:
                fix_drift_row(org_id, row)

    summary = {
        "org_id": org_id,
        "drift_count": len(drifts),
        "fixed": fix,
        "reconciled_only": reconciled_only,
        "drifts": [d.to_dict() for d in drifts],
    }
    _save_reconcile_run(org_id, summary)
    return summary


def _save_reconcile_run(org_id: str, summary: dict) -> None:
    """Persist reconcile summary for platform audit (best-effort)."""
    try:
        from datetime import datetime
        import uuid
        from app.firebase_client import get_db

        db = get_db()
        run_id = str(uuid.uuid4())
        db.collection("reconcile_runs").document(run_id).set({
            "id": run_id,
            "org_id": org_id,
            "drift_count": summary.get("drift_count", 0),
            "fixed": summary.get("fixed", False),
            "reconciled_only": summary.get("reconciled_only", False),
            "drifts": summary.get("drifts", [])[:50],
            "created_at": datetime.utcnow(),
        })
    except Exception:
        pass


def fix_drift_row(org_id: str, row: DriftRow) -> bool:
    """Update denormalized field to computed value. Returns True if fixed."""
    from app.firestore.invoices import InvoiceRepository
    from app.firestore.bills import BillRepository
    from app.firestore.inventory import ItemRepository
    from app.firestore.banking import BankAccountRepository

    if row.kind == "bill":
        BillRepository(org_id).update(row.entity_id, {"balance_due": row.computed})
        return True
    if row.kind == "invoice":
        InvoiceRepository(org_id).update(row.entity_id, {"balance_due": row.computed})
        return True
    if row.kind == "item":
        ItemRepository(org_id).update(row.entity_id, {"stock_on_hand": row.computed})
        return True
    if row.kind == "bank_account":
        BankAccountRepository(org_id).update(
            row.entity_id, {"current_balance": row.computed}
        )
        return True
    return False
