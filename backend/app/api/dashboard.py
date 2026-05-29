from fastapi import APIRouter, Depends
from datetime import datetime, timedelta
from app.firestore.invoices import InvoiceRepository, PaymentReceivedRepository
from app.firestore.expenses import ExpenseRepository
from app.firestore.bills import BillRepository
from app.firestore.contacts import ContactRepository
from app.services.auth import get_current_user
from app.schemas.schemas import DashboardResponse


def _parse_date(val):
    """Parse a value that may be a datetime or an ISO string into a naive UTC datetime."""
    if val is None:
        return None
    if isinstance(val, datetime):
        # Strip timezone info so comparisons are always naive
        return val.replace(tzinfo=None)
    if isinstance(val, str):
        try:
            s = val.replace(" ", "T").rstrip("Z")
            if len(s) == 10:
                s += "T00:00:00"
            dt = datetime.fromisoformat(s)
            return dt.replace(tzinfo=None)
        except Exception:
            return None
    return None

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("")
def get_dashboard(user: dict = Depends(get_current_user)):
    org_id = user["org_id"]

    # ── Cache: serve stale data for up to 60 s to reduce Firestore reads ──
    from app.cache import cache as _cache
    _cache_key = f"dashboard:{org_id}"
    cached = _cache.get(_cache_key)
    if cached is not None:
        return cached
    from app.services.org_counters import get_counters, refresh_counters_from_stream

    counters = get_counters(org_id)
    if not counters.get("updated_at"):
        try:
            counters = refresh_counters_from_stream(org_id)
        except Exception:
            counters = get_counters(org_id)

    inv_repo = InvoiceRepository(org_id)
    bill_repo = BillRepository(org_id)
    payment_repo = PaymentReceivedRepository(org_id)
    expense_repo = ExpenseRepository(org_id)
    contact_repo = ContactRepository(org_id)

    total_receivable = float(counters.get("invoices_open_balance") or 0)

    total_payable = float(counters.get("bills_open_balance") or 0)

    # This month income (payments received)
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    payments, _ = payment_repo.list(
        filters=[
            {"field": "date", "op": ">=", "value": month_start}
        ],
        limit=1000
    )
    income_this_month = sum(p.get("amount", 0) for p in payments)

    # This month expenses (filter void in Python to avoid Firestore composite index requirement)
    expenses_month, _ = expense_repo.list(
        filters=[
            {"field": "date", "op": ">=", "value": month_start},
        ],
        limit=1000
    )
    expenses_this_month = sum(e.get("amount", 0) for e in expenses_month if e.get("status") != "void")

    # Total contacts (avoid != composite index — filter in Python)
    all_contacts, _ = contact_repo.list(limit=500)
    total_contacts = sum(1 for c in all_contacts if c.get("is_active", True) is not False)

    from app.services.report_streams import stream_org_filtered

    overdue_invoices = 0
    for inv in stream_org_filtered(
        inv_repo, status_in={"sent", "partially_paid", "overdue"}
    ):
        due = _parse_date(inv.get("due_date"))
        if due and due < now and float(inv.get("balance_due", 0) or 0) > 0:
            overdue_invoices += 1

    # Recent invoices and expenses
    recent_invoices, _ = inv_repo.list(order_by="created_at", order_dir="DESCENDING", limit=5)
    recent_expenses, _ = expense_repo.list(order_by="created_at", order_dir="DESCENDING", limit=5)

    # Monthly income chart (last 6 months)
    income_chart = []
    for i in range(5, -1, -1):
        m_date = now - timedelta(days=30 * i)
        m_start = datetime(m_date.year, m_date.month, 1)
        if m_date.month == 12:
            m_end = datetime(m_date.year + 1, 1, 1)
        else:
            m_end = datetime(m_date.year, m_date.month + 1, 1)

        month_payments, _ = payment_repo.list(
            filters=[
                {"field": "date", "op": ">=", "value": m_start},
                {"field": "date", "op": "<", "value": m_end}
            ],
            limit=500
        )
        month_income = sum(p.get("amount", 0) for p in month_payments)

        month_exp, _ = expense_repo.list(
            filters=[
                {"field": "date", "op": ">=", "value": m_start},
                {"field": "date", "op": "<", "value": m_end},
            ],
            limit=500
        )
        month_expense = sum(e.get("amount", 0) for e in month_exp if e.get("status") != "void")

        income_chart.append({
            "month": m_start.strftime("%Y-%m"),
            "income": float(month_income),
            "expense": float(month_expense),
        })

    result = DashboardResponse(
        total_receivable=float(total_receivable),
        total_payable=float(total_payable),
        income_this_month=float(income_this_month),
        expenses_this_month=float(expenses_this_month),
        total_contacts=total_contacts,
        overdue_invoices=overdue_invoices,
        recent_invoices=[
            {"id": inv["id"], "invoice_number": inv.get("invoice_number"),
             "date": str(inv.get("date", ""))[:10] if inv.get("date") else "",
             "total": float(inv.get("total", 0)), "balance_due": float(inv.get("balance_due", 0)),
             "status": inv.get("status")}
            for inv in recent_invoices
        ],
        recent_expenses=[
            {"id": exp["id"], "expense_number": exp.get("expense_number"),
             "date": str(exp.get("date", ""))[:10] if exp.get("date") else "",
             "amount": float(exp.get("amount", 0)), "status": exp.get("status")}
            for exp in recent_expenses
        ],
        income_expense_chart=income_chart,
    )
    _cache.set(_cache_key, result)
    return result
