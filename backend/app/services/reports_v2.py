"""Reports v2 - Phase 11 Financial Statements Engine

Builds:
- trial_balance(period_end): all accounts with debit/credit balances
- profit_and_loss(period_start, period_end): revenue + expense by account
- balance_sheet(as_of): assets, liabilities, equity
- cash_flow_statement(period_start, period_end): direct method approximation

Pure functions taking pre-fetched accounts + journal entries with their lines.
API layer wires repos.

Account-type taxonomy (must stay in sync with seed/chart_of_accounts.py and
period_close.py):
"""
from typing import Optional
from datetime import datetime


REVENUE_TYPES = {"sales", "income", "other_income", "revenue"}
EXPENSE_TYPES = {
    "expense", "operating_expense", "other_expense", "cost_of_goods_sold",
}
ASSET_TYPES = {
    "cash", "bank", "accounts_receivable", "inventory", "current_asset",
    "fixed_asset", "other_asset", "asset",
}
LIABILITY_TYPES = {
    "accounts_payable", "current_liability", "long_term_liability",
    "credit_card", "other_liability", "liability",
}
EQUITY_TYPES = {"equity", "retained_earnings", "owner_equity"}


def _to_dt(v) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, str):
        try:
            s = v.replace(" ", "T").rstrip("Z")
            if len(s) == 10:
                s += "T00:00:00"
            return datetime.fromisoformat(s)
        except Exception:
            return None
    return None


def _account_normal_side(acc_type: str) -> str:
    """Debit-normal vs credit-normal."""
    if acc_type in ASSET_TYPES or acc_type in EXPENSE_TYPES:
        return "debit"
    return "credit"


def _net_balance(acc_type: str, debit: float, credit: float) -> float:
    """Return signed net balance in the natural direction of the account."""
    if _account_normal_side(acc_type) == "debit":
        return debit - credit
    return credit - debit


class ReportsService:

    @staticmethod
    def _aggregate_lines(
        accounts: dict,
        journal_entries: list[dict],
        get_lines,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
    ) -> dict:
        """Sum debit/credit per account_id from posted entries within the period.

        Returns: {account_id: {"debit": float, "credit": float}}
        """
        sums: dict = {}
        for e in journal_entries:
            if e.get("status") != "posted":
                continue
            edate = _to_dt(e.get("date"))
            if period_start and edate and edate < period_start:
                continue
            if period_end and edate and edate > period_end:
                continue
            for ln in get_lines(e["id"]):
                aid = ln.get("account_id")
                if not aid or aid not in accounts:
                    continue
                d = sums.setdefault(aid, {"debit": 0.0, "credit": 0.0})
                d["debit"] += float(ln.get("debit", 0) or 0)
                d["credit"] += float(ln.get("credit", 0) or 0)
        return sums

    @staticmethod
    def trial_balance(
        accounts: list[dict],
        journal_entries: list[dict],
        get_lines,
        as_of: Optional[datetime] = None,
    ) -> dict:
        """Trial Balance up to `as_of` (or all-time if None)."""
        acc_map = {a["id"]: a for a in accounts}
        sums = ReportsService._aggregate_lines(
            acc_map, journal_entries, get_lines,
            period_start=None, period_end=as_of,
        )

        rows = []
        total_debit = 0.0
        total_credit = 0.0
        for aid, acc in acc_map.items():
            d = sums.get(aid, {"debit": 0.0, "credit": 0.0})
            net = _net_balance(acc.get("account_type", ""), d["debit"], d["credit"])
            normal = _account_normal_side(acc.get("account_type", ""))
            # Present as debit/credit columns
            if net >= 0:
                debit_col = net if normal == "debit" else 0.0
                credit_col = net if normal == "credit" else 0.0
            else:
                # Negative balance flips column
                debit_col = -net if normal == "credit" else 0.0
                credit_col = -net if normal == "debit" else 0.0
            if abs(debit_col) < 0.01 and abs(credit_col) < 0.01:
                continue
            rows.append({
                "account_id": aid,
                "code": acc.get("code"),
                "name": acc.get("name"),
                "account_type": acc.get("account_type"),
                "debit": round(debit_col, 2),
                "credit": round(credit_col, 2),
            })
            total_debit += debit_col
            total_credit += credit_col

        rows.sort(key=lambda r: r.get("code") or "")
        return {
            "as_of": as_of.isoformat() if as_of else None,
            "rows": rows,
            "total_debit": round(total_debit, 2),
            "total_credit": round(total_credit, 2),
            "balanced": abs(total_debit - total_credit) < 0.01,
        }

    @staticmethod
    def profit_and_loss(
        accounts: list[dict],
        journal_entries: list[dict],
        get_lines,
        period_start: datetime,
        period_end: datetime,
    ) -> dict:
        """P&L for the period."""
        acc_map = {a["id"]: a for a in accounts}
        sums = ReportsService._aggregate_lines(
            acc_map, journal_entries, get_lines, period_start, period_end,
        )

        revenue_rows = []
        expense_rows = []
        total_revenue = 0.0
        total_expense = 0.0

        for aid, acc in acc_map.items():
            atype = acc.get("account_type", "")
            d = sums.get(aid, {"debit": 0.0, "credit": 0.0})
            if atype in REVENUE_TYPES:
                amt = d["credit"] - d["debit"]
                if abs(amt) < 0.01:
                    continue
                revenue_rows.append({"account_id": aid, "code": acc.get("code"),
                                     "name": acc.get("name"),
                                     "amount": round(amt, 2)})
                total_revenue += amt
            elif atype in EXPENSE_TYPES:
                amt = d["debit"] - d["credit"]
                if abs(amt) < 0.01:
                    continue
                expense_rows.append({"account_id": aid, "code": acc.get("code"),
                                     "name": acc.get("name"),
                                     "amount": round(amt, 2)})
                total_expense += amt

        revenue_rows.sort(key=lambda r: r.get("code") or "")
        expense_rows.sort(key=lambda r: r.get("code") or "")
        net_income = round(total_revenue - total_expense, 2)
        return {
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "revenue": revenue_rows,
            "expense": expense_rows,
            "total_revenue": round(total_revenue, 2),
            "total_expense": round(total_expense, 2),
            "net_income": net_income,
        }

    @staticmethod
    def balance_sheet(
        accounts: list[dict],
        journal_entries: list[dict],
        get_lines,
        as_of: datetime,
    ) -> dict:
        """Balance Sheet at `as_of`. Net income (P&L from start of FY) flows
        into equity (current-year earnings)."""
        acc_map = {a["id"]: a for a in accounts}
        sums = ReportsService._aggregate_lines(
            acc_map, journal_entries, get_lines, period_end=as_of,
        )

        assets, liabilities, equity = [], [], []
        total_assets = 0.0
        total_liab = 0.0
        total_eq = 0.0
        net_income_running = 0.0

        for aid, acc in acc_map.items():
            atype = acc.get("account_type", "")
            d = sums.get(aid, {"debit": 0.0, "credit": 0.0})
            net = _net_balance(atype, d["debit"], d["credit"])
            row = {"account_id": aid, "code": acc.get("code"),
                   "name": acc.get("name"), "amount": round(net, 2)}
            if atype in ASSET_TYPES:
                if abs(net) < 0.01:
                    continue
                assets.append(row); total_assets += net
            elif atype in LIABILITY_TYPES:
                if abs(net) < 0.01:
                    continue
                liabilities.append(row); total_liab += net
            elif atype in EQUITY_TYPES:
                if abs(net) < 0.01:
                    continue
                equity.append(row); total_eq += net
            elif atype in REVENUE_TYPES:
                net_income_running += (d["credit"] - d["debit"])
            elif atype in EXPENSE_TYPES:
                net_income_running -= (d["debit"] - d["credit"])

        assets.sort(key=lambda r: r.get("code") or "")
        liabilities.sort(key=lambda r: r.get("code") or "")
        equity.sort(key=lambda r: r.get("code") or "")

        current_year_earnings = round(net_income_running, 2)
        if abs(current_year_earnings) >= 0.01:
            equity.append({
                "account_id": "_cye",
                "code": "_CYE",
                "name": "Current Year Earnings",
                "amount": current_year_earnings,
            })
            total_eq += current_year_earnings

        total_liab_eq = total_liab + total_eq
        return {
            "as_of": as_of.isoformat(),
            "assets": assets,
            "liabilities": liabilities,
            "equity": equity,
            "total_assets": round(total_assets, 2),
            "total_liabilities": round(total_liab, 2),
            "total_equity": round(total_eq, 2),
            "total_liabilities_equity": round(total_liab_eq, 2),
            "balanced": abs(total_assets - total_liab_eq) < 0.01,
        }

    @staticmethod
    def cash_flow_direct(
        accounts: list[dict],
        journal_entries: list[dict],
        get_lines,
        period_start: datetime,
        period_end: datetime,
    ) -> dict:
        """Simplified direct cash-flow: net change in cash/bank accounts within
        the period."""
        acc_map = {a["id"]: a for a in accounts}
        sums = ReportsService._aggregate_lines(
            acc_map, journal_entries, get_lines, period_start, period_end,
        )

        cash_rows = []
        net_change = 0.0
        for aid, acc in acc_map.items():
            atype = acc.get("account_type", "")
            if atype not in {"cash", "bank"}:
                continue
            d = sums.get(aid, {"debit": 0.0, "credit": 0.0})
            net = d["debit"] - d["credit"]
            if abs(net) < 0.01:
                continue
            cash_rows.append({"account_id": aid, "code": acc.get("code"),
                              "name": acc.get("name"), "net_change": round(net, 2)})
            net_change += net

        return {
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "cash_accounts": cash_rows,
            "net_change_in_cash": round(net_change, 2),
        }
