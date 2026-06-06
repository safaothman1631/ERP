from fastapi import APIRouter, Depends
from datetime import datetime, timedelta
from app.firestore.invoices import InvoiceRepository, PaymentReceivedRepository
from app.firestore.expenses import ExpenseRepository
from app.firestore.bills import BillRepository, PaymentMadeRepository
from app.firestore.contacts import ContactRepository
from app.firestore.banking import BankAccountRepository
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


def _last_12_month_keys(now: datetime) -> list[str]:
    """Return the last 12 calendar-month keys (oldest→newest) as ``YYYY-MM``."""
    keys: list[str] = []
    y, m = now.year, now.month
    for _ in range(12):
        keys.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    keys.reverse()
    return keys


def _month_key_of(val) -> str | None:
    """Bucket key (``YYYY-MM``) for a datetime/ISO-string value, or ``None``."""
    dt = _parse_date(val)
    if dt is None:
        return None
    return f"{dt.year:04d}-{dt.month:02d}"


def _num(val) -> float:
    """Best-effort float coercion that never raises."""
    try:
        if val is None:
            return 0.0
        return float(val)
    except (TypeError, ValueError):
        return 0.0

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

    # ──────────────────────────────────────────────────────────────────────
    #  Additive analytics (purely optional). Each block is independently
    #  wrapped in try/except and defaults to [] on ANY error so a new field
    #  can never break the endpoint or the existing fields/response shape.
    #  Reads are streamed once per collection (not N queries per month).
    # ──────────────────────────────────────────────────────────────────────
    month_keys = _last_12_month_keys(now)

    # Stream each source collection a single time, bucketing in Python.
    # Wrapped so a streaming failure degrades to empty maps rather than 500.
    inv_by_month: dict[str, float] = {k: 0.0 for k in month_keys}
    exp_by_month: dict[str, float] = {k: 0.0 for k in month_keys}
    pay_in_by_month: dict[str, float] = {k: 0.0 for k in month_keys}
    pay_out_by_month: dict[str, float] = {k: 0.0 for k in month_keys}
    customer_totals: dict[str, float] = {}
    open_invoices: list[dict] = []

    try:
        for inv in inv_repo.stream_org_docs():
            if inv.get("status") == "void":
                continue
            total = _num(inv.get("total"))
            mk = _month_key_of(inv.get("date"))
            if mk in inv_by_month:
                inv_by_month[mk] += total
            # Top-customer aggregation (by invoiced amount).
            cid = inv.get("contact_id")
            if cid:
                customer_totals[cid] = customer_totals.get(cid, 0.0) + total
            # Aging needs every still-open invoice.
            if _num(inv.get("balance_due")) > 0 and inv.get("status") not in ("paid", "void", "cancelled"):
                open_invoices.append(inv)
    except Exception:
        inv_by_month = {k: 0.0 for k in month_keys}
        customer_totals = {}
        open_invoices = []

    try:
        for exp in expense_repo.stream_org_docs():
            if exp.get("status") == "void":
                continue
            mk = _month_key_of(exp.get("date"))
            if mk in exp_by_month:
                exp_by_month[mk] += _num(exp.get("amount"))
    except Exception:
        exp_by_month = {k: 0.0 for k in month_keys}

    try:
        for pmt in payment_repo.stream_org_docs():
            mk = _month_key_of(pmt.get("date"))
            if mk in pay_in_by_month:
                pay_in_by_month[mk] += _num(pmt.get("amount"))
    except Exception:
        pay_in_by_month = {k: 0.0 for k in month_keys}

    try:
        pay_made_repo = PaymentMadeRepository(org_id)
        for pmt in pay_made_repo.stream_org_docs():
            mk = _month_key_of(pmt.get("date"))
            if mk in pay_out_by_month:
                pay_out_by_month[mk] += _num(pmt.get("amount"))
    except Exception:
        pay_out_by_month = {k: 0.0 for k in month_keys}

    # revenue_trend: last ~12 months of invoiced revenue vs expense.
    try:
        revenue_trend = [
            {
                "month": k,
                "revenue": round(inv_by_month.get(k, 0.0), 2),
                "expense": round(exp_by_month.get(k, 0.0), 2),
            }
            for k in month_keys
        ]
    except Exception:
        revenue_trend = []

    # cash_flow: last ~12 months of cash in vs cash out (payments + expenses).
    try:
        cash_flow = []
        for k in month_keys:
            inflow = round(pay_in_by_month.get(k, 0.0), 2)
            outflow = round(pay_out_by_month.get(k, 0.0) + exp_by_month.get(k, 0.0), 2)
            cash_flow.append({
                "month": k,
                "inflow": inflow,
                "outflow": outflow,
                "net": round(inflow - outflow, 2),
            })
    except Exception:
        cash_flow = []

    # top_customers: top 5 contacts by invoiced amount (names resolved once).
    try:
        top_pairs = sorted(customer_totals.items(), key=lambda kv: kv[1], reverse=True)[:5]
        name_by_id: dict[str, str] = {}
        try:
            for cid, _amt in top_pairs:
                c = contact_repo.get(cid)
                if c:
                    name_by_id[cid] = (
                        c.get("display_name")
                        or c.get("company_name")
                        or c.get("name")
                        or cid
                    )
        except Exception:
            name_by_id = {}
        top_customers = [
            {"name": name_by_id.get(cid, cid), "amount": round(amt, 2)}
            for cid, amt in top_pairs
        ]
    except Exception:
        top_customers = []

    # aging: receivables aging buckets (0-30 / 31-60 / 61-90 / 90+) by balance.
    try:
        buckets = {"0-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
        for inv in open_invoices:
            bal = _num(inv.get("balance_due"))
            if bal <= 0:
                continue
            due = _parse_date(inv.get("due_date")) or _parse_date(inv.get("date"))
            days = (now - due).days if due else 0
            if days <= 30:
                buckets["0-30"] += bal
            elif days <= 60:
                buckets["31-60"] += bal
            elif days <= 90:
                buckets["61-90"] += bal
            else:
                buckets["90+"] += bal
        aging = [{"range": r, "amount": round(v, 2)} for r, v in buckets.items()]
    except Exception:
        aging = []

    # Sparklines: ~12-point series derived from the buckets computed above.
    try:
        income_sparkline = [round(pay_in_by_month.get(k, 0.0), 2) for k in month_keys]
    except Exception:
        income_sparkline = []
    try:
        expense_sparkline = [round(exp_by_month.get(k, 0.0), 2) for k in month_keys]
    except Exception:
        expense_sparkline = []
    # Receivable sparkline: running open-receivable proxy = cumulative
    # (invoiced − collected) per month, clamped at 0.
    try:
        receivable_sparkline = []
        running = 0.0
        for k in month_keys:
            running += inv_by_month.get(k, 0.0) - pay_in_by_month.get(k, 0.0)
            receivable_sparkline.append(round(max(running, 0.0), 2))
    except Exception:
        receivable_sparkline = []
    # Payable sparkline: cumulative (expenses − payments made) per month.
    try:
        payable_sparkline = []
        running = 0.0
        for k in month_keys:
            running += exp_by_month.get(k, 0.0) - pay_out_by_month.get(k, 0.0)
            payable_sparkline.append(round(max(running, 0.0), 2))
    except Exception:
        payable_sparkline = []

    # cash_breakdown: share of balance per bank account (+ Cash), ~100%.
    try:
        cash_breakdown = []
        bank_repo = BankAccountRepository(org_id)
        accounts = list(bank_repo.stream_org_docs())
        slices: list[tuple[str, float]] = []
        for acc in accounts:
            name = (
                acc.get("account_name")
                or acc.get("name")
                or acc.get("bank_name")
                or "Account"
            )
            bal = _num(acc.get("current_balance"))
            if acc.get("balance") is not None and not acc.get("current_balance"):
                bal = _num(acc.get("balance"))
            if bal > 0:
                slices.append((name, bal))
        total_bal = sum(b for _n, b in slices)
        if total_bal > 0:
            cash_breakdown = [
                {"name": n, "percent": round(b / total_bal * 100, 1)}
                for n, b in slices
            ]
    except Exception:
        cash_breakdown = []

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
        revenue_trend=revenue_trend,
        cash_flow=cash_flow,
        top_customers=top_customers,
        aging=aging,
        receivable_sparkline=receivable_sparkline,
        payable_sparkline=payable_sparkline,
        income_sparkline=income_sparkline,
        expense_sparkline=expense_sparkline,
        cash_breakdown=cash_breakdown,
    )
    _cache.set(_cache_key, result)
    return result
