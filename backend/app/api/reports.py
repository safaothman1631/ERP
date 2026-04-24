import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime
from app.firestore.journals import JournalEntryRepository
from app.firestore.accounts import AccountRepository
from app.firestore.invoices import InvoiceRepository
from app.firestore.expenses import ExpenseRepository
from app.firestore.bills import BillRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/reports", tags=["Reports"])

# Account type classifications
_ASSET_TYPES = {"asset", "cash", "bank", "accounts_receivable", "inventory",
                "other_current_asset", "fixed_asset"}
_LIABILITY_TYPES = {"liability", "accounts_payable", "other_current_liability",
                    "long_term_liability"}
_EQUITY_TYPES = {"equity", "owner_equity", "retained_earnings"}
_INCOME_TYPES = {"income", "sales", "other_income"}
_EXPENSE_TYPES = {"expense", "cost_of_goods_sold", "operating_expense", "other_expense"}


def _parse_date(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        # Normalize to naive UTC so comparisons against parsed-string dates never
        # raise "can't compare offset-naive and offset-aware datetimes" (FIX-541).
        if val.tzinfo is not None:
            return val.replace(tzinfo=None)
        return val
    if isinstance(val, str):
        try:
            s = val.replace(" ", "T").rstrip("Z")
            if len(s) == 10:
                s += "T00:00:00"
            d = datetime.fromisoformat(s)
            if d.tzinfo is not None:
                d = d.replace(tzinfo=None)
            return d
        except Exception:
            return None
    return None


def _get_journal_balances(org_id: str, start_date: datetime = None, end_date: datetime = None):
    """Get debit/credit totals per account from journal entries in date range.

    Optimized: filters entries by date BEFORE fetching line sub-collections,
    then fetches lines in parallel via a thread pool to mitigate N+1 round-trips.
    """
    je_repo = JournalEntryRepository(org_id)
    entries, _ = je_repo.list(limit=10000)

    # Pre-filter entries by date + status to avoid loading lines we will discard.
    eligible = []
    for entry in entries:
        if entry.get("status") == "void":
            continue
        entry_date = _parse_date(entry.get("date"))
        if start_date and entry_date and entry_date < start_date:
            continue
        if end_date and entry_date and entry_date > end_date:
            continue
        eligible.append(entry)

    balances = defaultdict(lambda: {"debit": 0.0, "credit": 0.0})
    if not eligible:
        return balances

    # Parallel-fetch sub-collection 'lines' per entry. Capped pool keeps load bounded.
    max_workers = min(16, max(4, len(eligible)))
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        results = pool.map(lambda e: (e["id"], je_repo.get_lines(e["id"])), eligible)
        for _entry_id, lines in results:
            for line in lines:
                acc_id = line.get("account_id", "")
                balances[acc_id]["debit"] += float(line.get("debit", 0) or 0)
                balances[acc_id]["credit"] += float(line.get("credit", 0) or 0)

    return balances


def _build_account_map(org_id: str):
    """Return dict of account_id -> account data."""
    acc_repo = AccountRepository(org_id)
    accounts, _ = acc_repo.list(order_by="code", order_dir="ASCENDING", limit=500)
    return {a["id"]: a for a in accounts}


# ===================== TRIAL BALANCE =====================

@router.get("/trial-balance", dependencies=[Depends(require_perm("reports.read"))])
def trial_balance(start_date: str = Query(...), end_date: str = Query(...),
                  user: dict = Depends(get_current_user)):
    sd = _parse_date(start_date)
    ed = _parse_date(end_date)
    balances = _get_journal_balances(user["org_id"], sd, ed)
    accounts = _build_account_map(user["org_id"])

    rows = []
    total_debit = 0.0
    total_credit = 0.0
    for acc_id, totals in balances.items():
        acc = accounts.get(acc_id, {})
        net = totals["debit"] - totals["credit"]
        debit_bal = net if net > 0 else 0
        credit_bal = -net if net < 0 else 0
        total_debit += debit_bal
        total_credit += credit_bal
        rows.append({
            "account_id": acc_id,
            "account_code": acc.get("code", ""),
            "account_name": acc.get("name", "Unknown"),
            "account_name_ku": acc.get("name_ku", ""),
            "debit": round(debit_bal, 2),
            "credit": round(credit_bal, 2),
        })

    rows.sort(key=lambda x: x["account_code"])
    return {
        "accounts": rows,
        "total_debit": round(total_debit, 2),
        "total_credit": round(total_credit, 2),
        "start_date": start_date,
        "end_date": end_date,
    }


# ===================== PROFIT & LOSS =====================

@router.get("/profit-loss", dependencies=[Depends(require_perm("reports.read"))])
def profit_loss(start_date: str = Query(...), end_date: str = Query(...),
                user: dict = Depends(get_current_user)):
    sd = _parse_date(start_date)
    ed = _parse_date(end_date)
    balances = _get_journal_balances(user["org_id"], sd, ed)
    accounts = _build_account_map(user["org_id"])

    revenue_rows = []
    expense_rows = []
    total_revenue = 0.0
    total_expenses = 0.0

    for acc_id, totals in balances.items():
        acc = accounts.get(acc_id, {})
        acc_type = acc.get("account_type", "")

        if acc_type in _INCOME_TYPES:
            amount = totals["credit"] - totals["debit"]
            total_revenue += amount
            revenue_rows.append({
                "account_id": acc_id,
                "account_code": acc.get("code", ""),
                "account_name": acc.get("name", ""),
                "account_name_ku": acc.get("name_ku", ""),
                "amount": round(amount, 2),
            })
        elif acc_type in _EXPENSE_TYPES:
            amount = totals["debit"] - totals["credit"]
            total_expenses += amount
            expense_rows.append({
                "account_id": acc_id,
                "account_code": acc.get("code", ""),
                "account_name": acc.get("name", ""),
                "account_name_ku": acc.get("name_ku", ""),
                "amount": round(amount, 2),
            })

    revenue_rows.sort(key=lambda x: x["account_code"])
    expense_rows.sort(key=lambda x: x["account_code"])

    return {
        "revenue": revenue_rows,
        "expenses": expense_rows,
        "total_revenue": round(total_revenue, 2),
        "total_expenses": round(total_expenses, 2),
        "net_profit": round(total_revenue - total_expenses, 2),
        "start_date": start_date,
        "end_date": end_date,
    }


# ===================== BALANCE SHEET =====================

@router.get("/balance-sheet", dependencies=[Depends(require_perm("reports.read"))])
def balance_sheet(as_of_date: str = Query(...), user: dict = Depends(get_current_user)):
    ed = _parse_date(as_of_date)
    balances = _get_journal_balances(user["org_id"], end_date=ed)
    accounts = _build_account_map(user["org_id"])

    asset_rows = []
    liability_rows = []
    equity_rows = []
    total_assets = 0.0
    total_liabilities = 0.0
    total_equity = 0.0
    net_profit = 0.0

    for acc_id, totals in balances.items():
        acc = accounts.get(acc_id, {})
        acc_type = acc.get("account_type", "")
        row = {
            "account_id": acc_id,
            "account_code": acc.get("code", ""),
            "account_name": acc.get("name", ""),
            "account_name_ku": acc.get("name_ku", ""),
        }

        if acc_type in _ASSET_TYPES:
            amount = totals["debit"] - totals["credit"]
            row["amount"] = round(amount, 2)
            total_assets += amount
            asset_rows.append(row)
        elif acc_type in _LIABILITY_TYPES:
            amount = totals["credit"] - totals["debit"]
            row["amount"] = round(amount, 2)
            total_liabilities += amount
            liability_rows.append(row)
        elif acc_type in _EQUITY_TYPES:
            amount = totals["credit"] - totals["debit"]
            row["amount"] = round(amount, 2)
            total_equity += amount
            equity_rows.append(row)
        elif acc_type in _INCOME_TYPES:
            net_profit += totals["credit"] - totals["debit"]
        elif acc_type in _EXPENSE_TYPES:
            net_profit -= totals["debit"] - totals["credit"]

    asset_rows.sort(key=lambda x: x["account_code"])
    liability_rows.sort(key=lambda x: x["account_code"])
    equity_rows.sort(key=lambda x: x["account_code"])

    # Add retained earnings / net profit to equity
    total_equity += net_profit

    return {
        "assets": asset_rows,
        "liabilities": liability_rows,
        "equity": equity_rows,
        "total_assets": round(total_assets, 2),
        "total_liabilities": round(total_liabilities, 2),
        "total_equity": round(total_equity, 2),
        "net_profit": round(net_profit, 2),
        "as_of_date": as_of_date,
    }


# ===================== RECEIVABLE AGING =====================

@router.get("/receivable-aging", dependencies=[Depends(require_perm("reports.read"))])
def receivable_aging(user: dict = Depends(get_current_user)):
    repo = InvoiceRepository(user["org_id"])
    invoices, _ = repo.list(
        filters=[{"field": "status", "op": "in",
                  "value": ["sent", "partially_paid", "overdue"]}],
        limit=5000
    )
    now = datetime.utcnow()
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    details = []

    for inv in invoices:
        due = _parse_date(inv.get("due_date"))
        balance = float(inv.get("balance_due", 0))
        if not due or balance <= 0:
            continue
        days = (now - due).days
        if days <= 0:
            buckets["current"] += balance
            bucket = "current"
        elif days <= 30:
            buckets["1_30"] += balance
            bucket = "1_30"
        elif days <= 60:
            buckets["31_60"] += balance
            bucket = "31_60"
        elif days <= 90:
            buckets["61_90"] += balance
            bucket = "61_90"
        else:
            buckets["over_90"] += balance
            bucket = "over_90"

        details.append({
            "invoice_id": inv["id"],
            "invoice_number": inv.get("invoice_number", ""),
            "contact_name": inv.get("contact_name", ""),
            "due_date": str(due.date()) if due else "",
            "days_overdue": max(days, 0),
            "balance_due": round(balance, 2),
            "bucket": bucket,
        })

    return {
        "buckets": {k: round(v, 2) for k, v in buckets.items()},
        "total": round(sum(buckets.values()), 2),
        "details": details,
    }


# ===================== PAYABLE AGING =====================

@router.get("/payable-aging", dependencies=[Depends(require_perm("reports.read"))])
def payable_aging(user: dict = Depends(get_current_user)):
    repo = BillRepository(user["org_id"])
    bills, _ = repo.list(
        filters=[{"field": "status", "op": "in",
                  "value": ["open", "partially_paid", "overdue"]}],
        limit=5000
    )
    now = datetime.utcnow()
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    details = []

    for bill in bills:
        due = _parse_date(bill.get("due_date"))
        balance = float(bill.get("balance_due", 0))
        if not due or balance <= 0:
            continue
        days = (now - due).days
        if days <= 0:
            buckets["current"] += balance
            bucket = "current"
        elif days <= 30:
            buckets["1_30"] += balance
            bucket = "1_30"
        elif days <= 60:
            buckets["31_60"] += balance
            bucket = "31_60"
        elif days <= 90:
            buckets["61_90"] += balance
            bucket = "61_90"
        else:
            buckets["over_90"] += balance
            bucket = "over_90"

        details.append({
            "bill_id": bill["id"],
            "bill_number": bill.get("bill_number", ""),
            "vendor_name": bill.get("vendor_name", ""),
            "due_date": str(due.date()) if due else "",
            "days_overdue": max(days, 0),
            "balance_due": round(balance, 2),
            "bucket": bucket,
        })

    return {
        "buckets": {k: round(v, 2) for k, v in buckets.items()},
        "total": round(sum(buckets.values()), 2),
        "details": details,
    }


# ===================== GENERAL LEDGER =====================

@router.get("/general-ledger", dependencies=[Depends(require_perm("reports.read"))])
def general_ledger(account_id: str = Query(None),
                   start_date: str = Query(...), end_date: str = Query(...),
                   user: dict = Depends(get_current_user)):
    sd = _parse_date(start_date)
    ed = _parse_date(end_date)
    je_repo = JournalEntryRepository(user["org_id"])
    accounts = _build_account_map(user["org_id"])
    entries, _ = je_repo.list(limit=10000)

    ledger = defaultdict(list)
    for entry in entries:
        entry_date = _parse_date(entry.get("date"))
        if sd and entry_date and entry_date < sd:
            continue
        if ed and entry_date and entry_date > ed:
            continue
        if entry.get("status") == "void":
            continue

        lines = je_repo.get_lines(entry["id"])
        for line in lines:
            aid = line.get("account_id", "")
            if account_id and aid != account_id:
                continue
            ledger[aid].append({
                "date": str(entry_date.date()) if entry_date else "",
                "journal_id": entry["id"],
                "journal_number": entry.get("journal_number", ""),
                "description": line.get("description", entry.get("notes", "")),
                "debit": round(float(line.get("debit", 0) or 0), 2),
                "credit": round(float(line.get("credit", 0) or 0), 2),
            })

    result = []
    for aid, txns in ledger.items():
        acc = accounts.get(aid, {})
        txns.sort(key=lambda x: x["date"])
        running = 0.0
        for t in txns:
            running += t["debit"] - t["credit"]
            t["balance"] = round(running, 2)
        result.append({
            "account_id": aid,
            "account_code": acc.get("code", ""),
            "account_name": acc.get("name", ""),
            "account_name_ku": acc.get("name_ku", ""),
            "transactions": txns,
            "total_debit": round(sum(t["debit"] for t in txns), 2),
            "total_credit": round(sum(t["credit"] for t in txns), 2),
        })
    result.sort(key=lambda x: x["account_code"])
    return {"accounts": result, "start_date": start_date, "end_date": end_date}


# ===================== ACCOUNT TRANSACTIONS =====================

@router.get("/account-transactions", dependencies=[Depends(require_perm("reports.read"))])
def account_transactions(account_id: str = Query(...),
                         start_date: str = Query(None), end_date: str = Query(None),
                         user: dict = Depends(get_current_user)):
    return general_ledger(account_id=account_id, start_date=start_date or "2000-01-01",
                          end_date=end_date or "2099-12-31", user=user)


# ===================== TAX SUMMARY =====================

@router.get("/tax-summary", dependencies=[Depends(require_perm("reports.read"))])
def tax_summary(start_date: str = Query(...), end_date: str = Query(...),
                user: dict = Depends(get_current_user)):
    sd = _parse_date(start_date)
    ed = _parse_date(end_date)

    inv_repo = InvoiceRepository(user["org_id"])
    bill_repo = BillRepository(user["org_id"])

    invoices, _ = inv_repo.list(limit=10000)
    bills, _ = bill_repo.list(limit=10000)

    output_tax = 0.0  # Tax on sales
    input_tax = 0.0   # Tax on purchases

    for inv in invoices:
        inv_date = _parse_date(inv.get("date"))
        if sd and inv_date and inv_date < sd:
            continue
        if ed and inv_date and inv_date > ed:
            continue
        if inv.get("status") == "void":
            continue
        output_tax += float(inv.get("tax_amount", 0) or 0)

    for bill in bills:
        bill_date = _parse_date(bill.get("date"))
        if sd and bill_date and bill_date < sd:
            continue
        if ed and bill_date and bill_date > ed:
            continue
        if bill.get("status") == "void":
            continue
        input_tax += float(bill.get("tax_amount", 0) or 0)

    return {
        "output_tax": round(output_tax, 2),
        "input_tax": round(input_tax, 2),
        "net_tax": round(output_tax - input_tax, 2),
        "start_date": start_date,
        "end_date": end_date,
    }


# ===================== SALES BY CUSTOMER =====================

@router.get("/sales-by-customer", dependencies=[Depends(require_perm("reports.read"))])
def sales_by_customer(start_date: str = Query(...), end_date: str = Query(...),
                      user: dict = Depends(get_current_user)):
    sd = _parse_date(start_date)
    ed = _parse_date(end_date)
    inv_repo = InvoiceRepository(user["org_id"])
    invoices, _ = inv_repo.list(limit=10000)

    by_customer = defaultdict(lambda: {"total": 0, "paid": 0, "outstanding": 0, "count": 0})

    for inv in invoices:
        inv_date = _parse_date(inv.get("date"))
        if sd and inv_date and inv_date < sd:
            continue
        if ed and inv_date and inv_date > ed:
            continue
        if inv.get("status") == "void":
            continue

        name = inv.get("contact_name", "Unknown")
        total = float(inv.get("total", 0) or 0)
        balance = float(inv.get("balance_due", 0) or 0)
        by_customer[name]["total"] += total
        by_customer[name]["paid"] += total - balance
        by_customer[name]["outstanding"] += balance
        by_customer[name]["count"] += 1

    rows = [
        {"customer": k, **{kk: round(vv, 2) for kk, vv in v.items()}}
        for k, v in by_customer.items()
    ]
    rows.sort(key=lambda x: x["total"], reverse=True)
    return {"customers": rows, "start_date": start_date, "end_date": end_date}


# ===================== SALES BY ITEM =====================

@router.get("/sales-by-item", dependencies=[Depends(require_perm("reports.read"))])
def sales_by_item(start_date: str = Query(...), end_date: str = Query(...),
                  user: dict = Depends(get_current_user)):
    sd = _parse_date(start_date)
    ed = _parse_date(end_date)
    inv_repo = InvoiceRepository(user["org_id"])
    invoices, _ = inv_repo.list(limit=10000)

    by_item = defaultdict(lambda: {"quantity": 0, "revenue": 0, "count": 0})

    for inv in invoices:
        inv_date = _parse_date(inv.get("date"))
        if sd and inv_date and inv_date < sd:
            continue
        if ed and inv_date and inv_date > ed:
            continue
        if inv.get("status") == "void":
            continue

        lines = inv_repo.get_lines(inv["id"])
        for line in lines:
            name = line.get("item_name", line.get("description", "Unknown"))
            by_item[name]["quantity"] += float(line.get("quantity", 0) or 0)
            by_item[name]["revenue"] += float(line.get("amount", 0) or 0)
            by_item[name]["count"] += 1

    rows = [
        {"item": k, **{kk: round(vv, 2) for kk, vv in v.items()}}
        for k, v in by_item.items()
    ]
    rows.sort(key=lambda x: x["revenue"], reverse=True)
    return {"items": rows, "start_date": start_date, "end_date": end_date}


# ===================== EXPENSE BY CATEGORY =====================

@router.get("/expense-by-category", dependencies=[Depends(require_perm("reports.read"))])
def expense_by_category(start_date: str = Query(...), end_date: str = Query(...),
                        user: dict = Depends(get_current_user)):
    sd = _parse_date(start_date)
    ed = _parse_date(end_date)
    exp_repo = ExpenseRepository(user["org_id"])
    expenses, _ = exp_repo.list(limit=10000)

    by_cat = defaultdict(lambda: {"total": 0, "count": 0})

    for exp in expenses:
        exp_date = _parse_date(exp.get("date"))
        if sd and exp_date and exp_date < sd:
            continue
        if ed and exp_date and exp_date > ed:
            continue
        if exp.get("status") == "void":
            continue

        cat = exp.get("account_name", exp.get("category", "Uncategorized"))
        amount = float(exp.get("amount", 0) or 0)
        by_cat[cat]["total"] += amount
        by_cat[cat]["count"] += 1

    rows = [
        {"category": k, **{kk: round(vv, 2) for kk, vv in v.items()}}
        for k, v in by_cat.items()
    ]
    rows.sort(key=lambda x: x["total"], reverse=True)
    return {"categories": rows, "start_date": start_date, "end_date": end_date}


# ===================== CASH FLOW =====================

@router.get("/cash-flow", dependencies=[Depends(require_perm("reports.read"))])
def cash_flow_report(start_date: str = Query(...), end_date: str = Query(...),
                     user: dict = Depends(get_current_user)):
    """Cash flow report: inflows vs outflows by month"""
    sd = _parse_date(start_date)
    ed = _parse_date(end_date)
    
    from app.firestore.invoices import PaymentReceivedRepository
    from app.firestore.bills import PaymentMadeRepository
    
    payment_received_repo = PaymentReceivedRepository(user["org_id"])
    payment_made_repo = PaymentMadeRepository(user["org_id"])
    expense_repo = ExpenseRepository(user["org_id"])
    
    # Get all payment transactions
    payments_received, _ = payment_received_repo.list(limit=10000)
    payments_made, _ = payment_made_repo.list(limit=10000)
    expenses, _ = expense_repo.list(limit=10000)
    
    # Group by month
    from collections import defaultdict
    periods = defaultdict(lambda: {"inflows": 0.0, "outflows": 0.0})
    
    for payment in payments_received:
        pdate = _parse_date(payment.get("date"))
        if not pdate:
            continue
        if sd and pdate < sd:
            continue
        if ed and pdate > ed:
            continue
        if payment.get("status") == "void":
            continue
        month_key = pdate.strftime("%Y-%m")
        periods[month_key]["inflows"] += float(payment.get("amount", 0) or 0)
    
    for payment in payments_made:
        pdate = _parse_date(payment.get("date"))
        if not pdate:
            continue
        if sd and pdate < sd:
            continue
        if ed and pdate > ed:
            continue
        if payment.get("status") == "void":
            continue
        month_key = pdate.strftime("%Y-%m")
        periods[month_key]["outflows"] += float(payment.get("amount", 0) or 0)
    
    for expense in expenses:
        edate = _parse_date(expense.get("date"))
        if not edate:
            continue
        if sd and edate < sd:
            continue
        if ed and edate > ed:
            continue
        if expense.get("status") == "void":
            continue
        month_key = edate.strftime("%Y-%m")
        periods[month_key]["outflows"] += float(expense.get("amount", 0) or 0)
    
    # Build period list
    period_list = []
    total_inflows = 0.0
    total_outflows = 0.0
    for month, data in sorted(periods.items()):
        inflows = round(data["inflows"], 2)
        outflows = round(data["outflows"], 2)
        net = round(inflows - outflows, 2)
        period_list.append({
            "month": month,
            "inflows": inflows,
            "outflows": outflows,
            "net": net
        })
        total_inflows += inflows
        total_outflows += outflows
    
    return {
        "periods": period_list,
        "total_inflows": round(total_inflows, 2),
        "total_outflows": round(total_outflows, 2),
        "net_cash_flow": round(total_inflows - total_outflows, 2),
        "start_date": start_date,
        "end_date": end_date,
    }


# ===================== BUDGET VS ACTUAL =====================

@router.get("/budget-vs-actual", dependencies=[Depends(require_perm("reports.read"))])
def budget_vs_actual_report(user: dict = Depends(get_current_user)):
    """Budget vs actual comparison by account"""
    from app.firestore.base import BaseRepository
    
    # Get budgets
    class BudgetRepository(BaseRepository):
        collection_name = "budgets"
    
    budget_repo = BudgetRepository(user["org_id"])
    budgets, _ = budget_repo.list(limit=1000)
    
    # Get actual balances from journal entries
    balances = _get_journal_balances(user["org_id"])
    accounts = _build_account_map(user["org_id"])
    
    items = []
    for budget in budgets:
        acc_id = budget.get("account_id")
        if not acc_id:
            continue
        acc = accounts.get(acc_id, {})
        budgeted = float(budget.get("amount", 0) or 0)
        
        # Calculate actual
        acc_balance = balances.get(acc_id, {"debit": 0, "credit": 0})
        acc_type = acc.get("account_type", "")
        
        if acc_type in _EXPENSE_TYPES:
            actual = acc_balance["debit"] - acc_balance["credit"]
        elif acc_type in _INCOME_TYPES:
            actual = acc_balance["credit"] - acc_balance["debit"]
        else:
            actual = acc_balance["debit"] - acc_balance["credit"]
        
        variance = actual - budgeted
        variance_pct = (variance / budgeted * 100) if budgeted != 0 else 0
        
        items.append({
            "account_id": acc_id,
            "account_name": acc.get("name", "Unknown"),
            "account_name_ku": acc.get("name_ku", ""),
            "budgeted": round(budgeted, 2),
            "actual": round(actual, 2),
            "variance": round(variance, 2),
            "variance_pct": round(variance_pct, 2),
        })
    
    items.sort(key=lambda x: abs(x["variance"]), reverse=True)
    return {"items": items}


# ===================== PROJECT PROFITABILITY =====================

@router.get("/project-profitability", dependencies=[Depends(require_perm("reports.read"))])
def project_profitability_report(user: dict = Depends(get_current_user)):
    """Project profitability: revenue vs costs per project"""
    from app.firestore.projects import ProjectRepository
    
    project_repo = ProjectRepository(user["org_id"])
    projects, _ = project_repo.list(limit=1000)
    
    inv_repo = InvoiceRepository(user["org_id"])
    exp_repo = ExpenseRepository(user["org_id"])
    
    items = []
    for project in projects:
        project_id = project["id"]
        project_name = project.get("name", "Unknown")
        
        # Get invoices for this project
        invoices, _ = inv_repo.list(
            filters=[{"field": "project_id", "op": "==", "value": project_id}],
            limit=5000
        )
        revenue = sum(float(inv.get("total", 0) or 0) for inv in invoices if inv.get("status") != "void")
        
        # Get expenses for this project
        expenses, _ = exp_repo.list(
            filters=[{"field": "project_id", "op": "==", "value": project_id}],
            limit=5000
        )
        costs = sum(float(exp.get("amount", 0) or 0) for exp in expenses if exp.get("status") != "void")
        
        profit = revenue - costs
        margin_pct = (profit / revenue * 100) if revenue > 0 else 0
        
        items.append({
            "project_id": project_id,
            "project_name": project_name,
            "revenue": round(revenue, 2),
            "costs": round(costs, 2),
            "profit": round(profit, 2),
            "margin_pct": round(margin_pct, 2),
        })
    
    items.sort(key=lambda x: x["profit"], reverse=True)
    return {"items": items}


# ===================== PARTNER LEDGER (FIX-51) =====================

@router.get("/partner-ledger", dependencies=[Depends(require_perm("reports.read"))])
def partner_ledger(
    contact_id: str = Query(..., description="Customer or vendor contact id"),
    start_date: str = Query(...),
    end_date: str = Query(...),
    user: dict = Depends(get_current_user),
):
    """Partner ledger: chronological list of all transactions for one contact
    (customer or vendor) with running balance. Includes invoices، payments، bills،
    payments-made، and credit notes.
    """
    from app.firestore.contacts import ContactRepository
    from app.firestore.payments import PaymentReceivedRepository, PaymentMadeRepository
    try:
        from app.firestore.invoices import CreditNoteRepository
    except Exception:
        CreditNoteRepository = None  # optional

    org_id = user["org_id"]
    contact = ContactRepository(org_id).get(contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="هاوبەش نەدۆزرایەوە")

    sd = _parse_date(start_date)
    ed = _parse_date(end_date)
    if not sd or not ed:
        raise HTTPException(status_code=400, detail="بەرواری دەستپێک یان کۆتایی نادروستە")

    def _in_range(date_str: str) -> bool:
        d = _parse_date(date_str)
        if not d:
            return False
        # Normalise tz-aware datetimes to naive for comparison
        if d.tzinfo is not None:
            d = d.replace(tzinfo=None)
        return sd <= d <= ed

    rows: list = []

    # Invoices (debits — money owed by customer)
    invoices, _ = InvoiceRepository(org_id).list(
        filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
        limit=5000,
    )
    for inv in invoices:
        if inv.get("status") == "void" or not _in_range(inv.get("date", "")):
            continue
        rows.append({
            "date": inv.get("date", ""),
            "type": "invoice",
            "reference": inv.get("invoice_number", ""),
            "document_id": inv["id"],
            "debit": float(inv.get("total", 0) or 0),
            "credit": 0.0,
            "description": inv.get("subject") or inv.get("notes", ""),
        })

    # Customer payments received (credits — reduces customer balance)
    try:
        payments, _ = PaymentReceivedRepository(org_id).list(
            filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
            limit=5000,
        )
        for p in payments:
            if not _in_range(p.get("date", "")):
                continue
            rows.append({
                "date": p.get("date", ""),
                "type": "payment_received",
                "reference": p.get("payment_number", ""),
                "document_id": p["id"],
                "debit": 0.0,
                "credit": float(p.get("amount", 0) or 0),
                "description": p.get("notes", ""),
            })
    except Exception:
        pass

    # Bills (credits — money owed to vendor)
    bills, _ = BillRepository(org_id).list(
        filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
        limit=5000,
    )
    for b in bills:
        if b.get("status") == "void" or not _in_range(b.get("date", "")):
            continue
        rows.append({
            "date": b.get("date", ""),
            "type": "bill",
            "reference": b.get("bill_number", ""),
            "document_id": b["id"],
            "debit": 0.0,
            "credit": float(b.get("total", 0) or 0),
            "description": b.get("notes", ""),
        })

    # Vendor payments made (debits — reduces vendor balance owed)
    try:
        pms, _ = PaymentMadeRepository(org_id).list(
            filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
            limit=5000,
        )
        for p in pms:
            if not _in_range(p.get("date", "")):
                continue
            rows.append({
                "date": p.get("date", ""),
                "type": "payment_made",
                "reference": p.get("payment_number", ""),
                "document_id": p["id"],
                "debit": float(p.get("amount", 0) or 0),
                "credit": 0.0,
                "description": p.get("notes", ""),
            })
    except Exception:
        pass

    # Credit notes (credits)
    if CreditNoteRepository is not None:
        try:
            cns, _ = CreditNoteRepository(org_id).list(
                filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
                limit=5000,
            )
            for cn in cns:
                if cn.get("status") == "void" or not _in_range(cn.get("date", "")):
                    continue
                rows.append({
                    "date": cn.get("date", ""),
                    "type": "credit_note",
                    "reference": cn.get("credit_note_number", ""),
                    "document_id": cn["id"],
                    "debit": 0.0,
                    "credit": float(cn.get("total", 0) or 0),
                    "description": cn.get("reason", ""),
                })
        except Exception:
            pass

    # Sort chronologically and compute running balance
    rows.sort(key=lambda r: (str(r["date"]), r["type"]))
    running = 0.0
    for r in rows:
        running += r["debit"] - r["credit"]
        r["balance"] = round(running, 2)
        r["debit"] = round(r["debit"], 2)
        r["credit"] = round(r["credit"], 2)
        r["date"] = str(r["date"])[:10] if r["date"] else ""

    total_debit = round(sum(r["debit"] for r in rows), 2)
    total_credit = round(sum(r["credit"] for r in rows), 2)

    return {
        "contact_id": contact_id,
        "contact_name": contact.get("name", ""),
        "contact_type": contact.get("contact_type") or contact.get("type", ""),
        "start_date": start_date,
        "end_date": end_date,
        "rows": rows,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "ending_balance": round(running, 2),
    }


# ---------------- Sprint 34: Reports Library Expansion (FIX-521..525) ----------------

@router.get("/top-customers", dependencies=[Depends(require_perm("reports.read"))])
def top_customers(limit: int = 10, user: dict = Depends(get_current_user)):
    """Sprint 34: top N customers by total invoiced amount (excludes draft/void)."""
    from app.firestore.invoices import InvoiceRepository
    from app.firestore.contacts import ContactRepository
    inv_repo = InvoiceRepository(user["org_id"])
    invs, _ = inv_repo.list(limit=10000)
    totals: dict = {}
    for inv in invs:
        if (inv.get("status") or "").lower() in {"draft", "void", "cancelled"}:
            continue
        cid = inv.get("contact_id")
        if not cid:
            continue
        totals[cid] = totals.get(cid, 0.0) + float(inv.get("total") or 0)
    contacts = ContactRepository(user["org_id"])
    rows = []
    for cid, amt in sorted(totals.items(), key=lambda kv: kv[1], reverse=True)[: max(1, limit)]:
        c = contacts.get(cid) or {}
        rows.append({"contact_id": cid, "name": c.get("display_name") or c.get("name"), "total": round(amt, 2)})
    return {"items": rows, "total": len(rows)}


@router.get("/top-items", dependencies=[Depends(require_perm("reports.read"))])
def top_items(limit: int = 10, user: dict = Depends(get_current_user)):
    """Sprint 34: top N items by quantity sold across all non-void invoices."""
    from app.firestore.invoices import InvoiceRepository
    from app.firestore.items import ItemRepository
    inv_repo = InvoiceRepository(user["org_id"])
    invs, _ = inv_repo.list(limit=10000)
    qtys: dict = {}
    revenue: dict = {}
    for inv in invs:
        if (inv.get("status") or "").lower() in {"draft", "void", "cancelled"}:
            continue
        for ln in inv.get("lines", []) or []:
            iid = ln.get("item_id")
            if not iid:
                continue
            q = float(ln.get("quantity") or 0)
            qtys[iid] = qtys.get(iid, 0.0) + q
            revenue[iid] = revenue.get(iid, 0.0) + q * float(ln.get("unit_price") or 0)
    items_repo = ItemRepository(user["org_id"])
    rows = []
    for iid, q in sorted(qtys.items(), key=lambda kv: kv[1], reverse=True)[: max(1, limit)]:
        it = items_repo.get(iid) or {}
        rows.append({
            "item_id": iid, "name": it.get("name"), "sku": it.get("sku"),
            "quantity": round(q, 3), "revenue": round(revenue.get(iid, 0.0), 2),
        })
    return {"items": rows, "total": len(rows)}


@router.get("/inventory-valuation", dependencies=[Depends(require_perm("reports.read"))])
def inventory_valuation(user: dict = Depends(get_current_user)):
    """Sprint 34: snapshot inventory value = on-hand qty * cost_price for each item."""
    from app.firestore.items import ItemRepository
    items, _ = ItemRepository(user["org_id"]).list(limit=10000)
    rows = []
    grand = 0.0
    for it in items:
        if (it.get("type") or "").lower() not in {"goods", "product", "inventory", "stockable", ""}:
            continue
        qty = float(it.get("on_hand") or it.get("stock_on_hand") or 0)
        cost = float(it.get("cost_price") or it.get("cost") or 0)
        val = round(qty * cost, 2)
        if qty == 0 and cost == 0:
            continue
        grand += val
        rows.append({
            "item_id": it.get("id"), "name": it.get("name"), "sku": it.get("sku"),
            "quantity": qty, "cost_price": cost, "value": val,
        })
    rows.sort(key=lambda r: r["value"], reverse=True)
    return {"items": rows, "total": len(rows), "total_value": round(grand, 2)}
