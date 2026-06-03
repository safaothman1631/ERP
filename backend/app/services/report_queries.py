"""Shared Firestore reads for accounting reports (stream-first)."""
from __future__ import annotations

from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Iterator

from app.services.firestore_resilience import LIST_HARD_CAP
from app.services.report_streams import collect_stream, stream_org_filtered


def parse_report_date(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, str):
        try:
            normalized = value.replace(" ", "T").rstrip("Z")
            if len(normalized) == 10:
                normalized += "T00:00:00"
            parsed = datetime.fromisoformat(normalized)
            return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        except Exception:
            return None
    return None


def parse_date_range(start, end) -> tuple[datetime | None, datetime | None]:
    return parse_report_date(start), parse_report_date(end)


def in_date_range(
    doc: dict,
    field: str,
    start: datetime | None,
    end: datetime | None,
) -> bool:
    parsed = parse_report_date(doc.get(field))
    if start and parsed and parsed < start:
        return False
    if end and parsed and parsed > end:
        return False
    return True


def collect_journal_entries(
    org_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
    *,
    max_docs: int = LIST_HARD_CAP,
) -> list[dict]:
    from app.firestore.journals import JournalEntryRepository

    repo = JournalEntryRepository(org_id)
    entries: list[dict] = []
    for entry in repo.stream_org_docs():
        if entry.get("status") == "void":
            continue
        if not in_date_range(entry, "date", start, end):
            continue
        entries.append(entry)
        if len(entries) >= max_docs:
            break
    return entries


def stream_journal_entries(
    org_id: str,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    max_docs: int = LIST_HARD_CAP,
) -> Iterator[dict]:
    yield from collect_journal_entries(org_id, start=start, end=end, max_docs=max_docs)


def _journal_balances_legacy(
    org_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
) -> dict[str, dict[str, float]]:
    """Legacy aggregation: stream JE headers + read each entry's lines
    subcollection (1 + N reads). Kept as the correctness oracle and the
    automatic fallback for ``journal_balances``."""
    from app.firestore.journals import JournalEntryRepository

    repo = JournalEntryRepository(org_id)
    entries = collect_journal_entries(org_id, start=start, end=end)
    balances: dict[str, dict[str, float]] = defaultdict(
        lambda: {"debit": 0.0, "credit": 0.0}
    )
    if not entries:
        return balances

    max_workers = min(16, max(4, len(entries)))
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        for lines in pool.map(lambda e: repo.get_lines(e["id"]), entries):
            for line in lines:
                account_id = line.get("account_id", "")
                balances[account_id]["debit"] += float(line.get("debit", 0) or 0)
                balances[account_id]["credit"] += float(line.get("credit", 0) or 0)
    return balances


def journal_balances_cg(
    org_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
) -> dict[str, dict[str, float]]:
    """Fast aggregation via a SINGLE ``collection_group('lines')`` query over the
    denormalized ``(org_id, je_date)`` index — replaces the legacy 1 + N read
    pattern. ``order_by('je_date')`` scopes the collection-group to journal-entry
    lines only (bill/PO/cart 'lines' subcollections carry no ``je_date``). Lines
    of voided entries are excluded so the result equals
    ``_journal_balances_legacy`` exactly."""
    import logging

    from app.firebase_client import get_db

    db = get_db()

    # Voided JE ids (rare) — excluded to match the legacy skip of status=="void".
    # Queried directly (indexed) rather than streaming every header.
    void_ids: set[str] = set()
    try:
        vq = (
            db.collection("journal_entries")
            .where("org_id", "==", org_id)
            .where("status", "==", "void")
        )
        void_ids = {snap.id for snap in vq.stream()}
    except Exception:
        logging.getLogger(__name__).warning(
            "void-header query failed; scanning headers", exc_info=True
        )
        from app.firestore.journals import JournalEntryRepository

        for entry in JournalEntryRepository(org_id).stream_org_docs():
            if entry.get("status") == "void":
                void_ids.add(entry.get("id"))

    query = db.collection_group("lines").where("org_id", "==", org_id).order_by("je_date")
    if start is not None:
        query = query.where("je_date", ">=", start)
    if end is not None:
        query = query.where("je_date", "<=", end)

    balances: dict[str, dict[str, float]] = defaultdict(
        lambda: {"debit": 0.0, "credit": 0.0}
    )
    for snap in query.stream():
        parent_doc = snap.reference.parent.parent  # journal_entries/{id}
        if parent_doc is not None and parent_doc.id in void_ids:
            continue
        line = snap.to_dict() or {}
        account_id = line.get("account_id", "")
        balances[account_id]["debit"] += float(line.get("debit", 0) or 0)
        balances[account_id]["credit"] += float(line.get("credit", 0) or 0)
    return balances


def journal_balances(
    org_id: str,
    start: datetime | None = None,
    end: datetime | None = None,
) -> dict[str, dict[str, float]]:
    """Account debit/credit totals from posted journal entries in ``[start, end]``.

    Dispatches to the fast collection-group path when
    ``REPORTS_USE_COLLECTION_GROUP`` is enabled, with an automatic fallback to
    the legacy 1 + N implementation on any error — so a missing index or
    un-backfilled line can never break a report."""
    from app.config import settings

    if getattr(settings, "REPORTS_USE_COLLECTION_GROUP", False):
        try:
            return journal_balances_cg(org_id, start=start, end=end)
        except Exception:
            import logging

            logging.getLogger(__name__).exception(
                "journal_balances_cg failed; falling back to legacy"
            )
    return _journal_balances_legacy(org_id, start=start, end=end)


def journal_balances_for_range(
    org_id: str,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
) -> dict[str, dict[str, float]]:
    return journal_balances(org_id, start=start, end=end)


def stream_accounts(org_id: str) -> Iterator[dict]:
    from app.firestore.accounts import AccountRepository

    return AccountRepository(org_id).stream_org_docs()


def build_account_map(org_id: str) -> dict[str, dict]:
    return {account["id"]: account for account in stream_accounts(org_id)}


def collect_invoices(
    org_id: str,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    status_in: set[str] | None = None,
    max_docs: int = LIST_HARD_CAP,
) -> list[dict]:
    from app.firestore.invoices import InvoiceRepository

    repo = InvoiceRepository(org_id)
    docs: list[dict] = []
    for invoice in stream_org_filtered(repo, status_in=status_in, max_docs=max_docs):
        if invoice.get("status") == "void":
            continue
        if not in_date_range(invoice, "date", start, end):
            continue
        docs.append(invoice)
    return docs


def collect_bills(
    org_id: str,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    status_in: set[str] | None = None,
    max_docs: int = LIST_HARD_CAP,
) -> list[dict]:
    from app.firestore.bills import BillRepository

    repo = BillRepository(org_id)
    docs: list[dict] = []
    for bill in stream_org_filtered(repo, status_in=status_in, max_docs=max_docs):
        if bill.get("status") == "void":
            continue
        if not in_date_range(bill, "date", start, end):
            continue
        docs.append(bill)
    return docs


def collect_expenses(
    org_id: str,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    status_in: set[str] | None = None,
    max_docs: int = LIST_HARD_CAP,
) -> list[dict]:
    from app.firestore.expenses import ExpenseRepository

    repo = ExpenseRepository(org_id)
    return [
        expense
        for expense in collect_stream(repo, status_in=status_in, max_docs=max_docs)
        if expense.get("status") != "void"
        and in_date_range(expense, "date", start, end)
    ]


def collect_expenses_in_range(
    org_id: str,
    start: datetime | None,
    end: datetime | None,
) -> list[dict]:
    return collect_expenses(org_id, start=start, end=end)


def collect_payments_received(
    org_id: str,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    status_in: set[str] | None = None,
    max_docs: int = LIST_HARD_CAP,
) -> list[dict]:
    from app.firestore.invoices import PaymentReceivedRepository

    repo = PaymentReceivedRepository(org_id)
    return [
        payment
        for payment in collect_stream(repo, status_in=status_in, max_docs=max_docs)
        if payment.get("status") != "void" and in_date_range(payment, "date", start, end)
    ]


def collect_payments_received_in_range(
    org_id: str,
    start: datetime | None,
    end: datetime | None,
) -> list[dict]:
    return collect_payments_received(org_id, start=start, end=end)


def collect_payments_made(
    org_id: str,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    status_in: set[str] | None = None,
    max_docs: int = LIST_HARD_CAP,
) -> list[dict]:
    from app.firestore.bills import PaymentMadeRepository

    repo = PaymentMadeRepository(org_id)
    return [
        payment
        for payment in collect_stream(repo, status_in=status_in, max_docs=max_docs)
        if payment.get("status") != "void" and in_date_range(payment, "date", start, end)
    ]


def collect_payments_made_in_range(
    org_id: str,
    start: datetime | None,
    end: datetime | None,
) -> list[dict]:
    return collect_payments_made(org_id, start=start, end=end)


def open_invoices_for_aging(org_id: str) -> list[dict]:
    open_docs: list[dict] = []
    status_in = {"sent", "partially_paid", "overdue"}
    for invoice in collect_invoices(org_id, status_in=status_in):
        total = float(invoice.get("total") or 0)
        paid = float(invoice.get("amount_paid") or invoice.get("paid_amount") or 0)
        balance = float(invoice.get("balance_due") or (total - paid))
        if balance <= 0:
            continue
        open_docs.append(
            {
                **invoice,
                "balance_due": balance,
                "contact_name": invoice.get("customer_name")
                or invoice.get("contact_name"),
            }
        )
    return open_docs


def open_bills_for_aging(org_id: str) -> list[dict]:
    open_docs: list[dict] = []
    status_in = {"open", "partially_paid", "overdue", "approved"}
    for bill in collect_bills(org_id, status_in=status_in):
        total = float(bill.get("total") or 0)
        paid = float(bill.get("amount_paid") or bill.get("paid_amount") or 0)
        balance = float(bill.get("balance_due") or (total - paid))
        if balance <= 0:
            continue
        open_docs.append(
            {
                **bill,
                "balance_due": balance,
                "contact_name": bill.get("vendor_name") or bill.get("contact_name"),
            }
        )
    return open_docs
