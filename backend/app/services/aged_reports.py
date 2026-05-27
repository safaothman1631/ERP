"""Pure helpers for aged AR/AP bucket reports."""
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional


def _parse_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")[:10]).date()
        except ValueError:
            try:
                return datetime.strptime(value[:10], "%Y-%m-%d").date()
            except ValueError:
                return None
    return None


def _days_overdue(due: Optional[date], as_of: date) -> int:
    if due is None:
        return 9999
    return (as_of - due).days


def _bucket(days: int) -> str:
    if days <= 30:
        return "b_0_30"
    if days <= 60:
        return "b_31_60"
    if days <= 90:
        return "b_61_90"
    return "b_90_plus"


def build_aged_buckets(
    open_docs: list[dict],
    as_of: date,
    *,
    contact_id_field: str = "contact_id",
    contact_name_field: str = "contact_name",
    balance_field: str = "balance_due",
    due_date_field: str = "due_date",
) -> dict[str, dict]:
    """Group open documents into aged buckets per contact."""
    result: dict[str, dict] = {}

    for doc in open_docs:
        balance = Decimal(str(doc.get(balance_field) or doc.get("total") or 0))
        if balance <= 0:
            continue

        cid = doc.get(contact_id_field) or "_unknown"
        cname = doc.get(contact_name_field) or doc.get("customer_name") or doc.get("vendor_name") or cid

        if cid not in result:
            result[cid] = {
                "contact_id": cid,
                "contact_name": cname,
                "total": Decimal("0"),
                "b_0_30": Decimal("0"),
                "b_31_60": Decimal("0"),
                "b_61_90": Decimal("0"),
                "b_90_plus": Decimal("0"),
            }

        days = _days_overdue(_parse_date(doc.get(due_date_field)), as_of)
        key = _bucket(days)
        amt = float(balance)
        result[cid][key] += balance
        result[cid]["total"] += balance

    # Convert Decimals to float for JSON
    for row in result.values():
        for k in ("total", "b_0_30", "b_31_60", "b_61_90", "b_90_plus"):
            row[k] = float(row[k])

    return result


def build_partner_ledger(
    lines: list[dict],
    opening_balance: Decimal,
) -> dict:
    """Build partner ledger with running balance from sorted JE lines."""
    sorted_lines = sorted(lines, key=lambda x: (x.get("date", ""), x.get("doc_number", "")))
    running = opening_balance
    out_lines = []

    for ln in sorted_lines:
        debit = Decimal(str(ln.get("debit", 0) or 0))
        credit = Decimal(str(ln.get("credit", 0) or 0))
        running += debit - credit
        out_lines.append({
            **ln,
            "debit": float(debit),
            "credit": float(credit),
            "running_balance": float(running),
        })

    return {
        "opening_balance": float(opening_balance),
        "lines": out_lines,
        "closing_balance": float(running),
    }
