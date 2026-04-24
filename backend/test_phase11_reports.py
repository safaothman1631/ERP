"""Smoke test for Phase 11 Reports v2."""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from app.firebase_client import init_firebase
from app.services.reports_v2 import ReportsService

init_firebase()
results = []


def _assert(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((status, name, detail))
    print(f"  [{status}] {name}{(' - ' + detail) if detail else ''}")


# ===== Fixture: simple chart with 6 accounts =====
ACCOUNTS = [
    {"id": "cash", "code": "1010", "name": "Cash", "account_type": "cash"},
    {"id": "ar", "code": "1200", "name": "AR", "account_type": "accounts_receivable"},
    {"id": "ap", "code": "2010", "name": "AP", "account_type": "accounts_payable"},
    {"id": "eq", "code": "3000", "name": "Capital", "account_type": "equity"},
    {"id": "rev", "code": "4000", "name": "Sales", "account_type": "sales"},
    {"id": "exp", "code": "5000", "name": "Office Exp", "account_type": "expense"},
]

# Two journal entries:
# JE1 (Mar 15): Sale on credit - DR AR 1000, CR Sales 1000
# JE2 (Apr 10): Expense paid cash - DR Exp 300, CR Cash 300
# JE3 (Jan 1): Owner contribution - DR Cash 5000, CR Equity 5000
ENTRIES = [
    {"id": "JE0", "date": datetime(2026, 1, 1), "status": "posted"},
    {"id": "JE1", "date": datetime(2026, 3, 15), "status": "posted"},
    {"id": "JE2", "date": datetime(2026, 4, 10), "status": "posted"},
    {"id": "JE_DRAFT", "date": datetime(2026, 5, 1), "status": "draft"},  # excluded
]
LINES = {
    "JE0": [
        {"account_id": "cash", "debit": 5000, "credit": 0},
        {"account_id": "eq", "debit": 0, "credit": 5000},
    ],
    "JE1": [
        {"account_id": "ar", "debit": 1000, "credit": 0},
        {"account_id": "rev", "debit": 0, "credit": 1000},
    ],
    "JE2": [
        {"account_id": "exp", "debit": 300, "credit": 0},
        {"account_id": "cash", "debit": 0, "credit": 300},
    ],
    "JE_DRAFT": [
        {"account_id": "cash", "debit": 99999, "credit": 0},
        {"account_id": "rev", "debit": 0, "credit": 99999},
    ],
}


def get_lines(eid):
    return LINES.get(eid, [])


def t1_trial_balance_balanced():
    print("\nT1 - trial balance is balanced")
    tb = ReportsService.trial_balance(ACCOUNTS, ENTRIES, get_lines,
                                      as_of=datetime(2026, 12, 31))
    _assert("balanced", tb["balanced"], f"D={tb['total_debit']} C={tb['total_credit']}")
    # cash 4700 + AR 1000 + exp 300 = 6000 D; equity 5000 + rev 1000 = 6000 C
    _assert("total_debit == 6000",
            tb["total_debit"] == 6000.0, str(tb["total_debit"]))
    _assert("total_credit == 6000", tb["total_credit"] == 6000.0)


def t2_trial_balance_excludes_draft():
    print("\nT2 - draft entries excluded from TB")
    tb = ReportsService.trial_balance(ACCOUNTS, ENTRIES, get_lines)
    rows_by_acc = {r["account_id"]: r for r in tb["rows"]}
    # cash should be 5000 - 300 = 4700 debit (NOT 99999 from draft)
    _assert("cash debit 4700",
            rows_by_acc["cash"]["debit"] == 4700.0,
            str(rows_by_acc["cash"]))


def t3_pnl_period_filter():
    """P&L Mar-Apr 2026 includes JE1 (rev 1000) + JE2 (exp 300). Net = 700."""
    print("\nT3 - P&L period filter")
    pnl = ReportsService.profit_and_loss(
        ACCOUNTS, ENTRIES, get_lines,
        period_start=datetime(2026, 3, 1),
        period_end=datetime(2026, 4, 30),
    )
    _assert("revenue 1000", pnl["total_revenue"] == 1000.0)
    _assert("expense 300", pnl["total_expense"] == 300.0)
    _assert("net_income 700", pnl["net_income"] == 700.0)


def t4_pnl_excludes_january():
    """Equity contribution in Jan should not appear in March-onwards P&L."""
    print("\nT4 - P&L excludes equity entry")
    pnl = ReportsService.profit_and_loss(
        ACCOUNTS, ENTRIES, get_lines,
        period_start=datetime(2026, 3, 1),
        period_end=datetime(2026, 12, 31),
    )
    # Should still be 1000 rev / 300 exp / 700 net
    _assert("net_income 700 unchanged", pnl["net_income"] == 700.0,
            str(pnl["net_income"]))


def t5_balance_sheet_assets_eq_liab_plus_equity():
    """At April 30:
       Assets: Cash 4700 + AR 1000 = 5700
       Liab:   AP 0 (no entries)
       Equity: Capital 5000 + Current Year Earnings 700 = 5700
       Balanced!"""
    print("\nT5 - balance sheet equality A = L + E")
    bs = ReportsService.balance_sheet(ACCOUNTS, ENTRIES, get_lines,
                                      as_of=datetime(2026, 4, 30))
    _assert("balanced", bs["balanced"],
            f"A={bs['total_assets']} L+E={bs['total_liabilities_equity']}")
    _assert("total_assets 5700", bs["total_assets"] == 5700.0,
            str(bs["total_assets"]))
    _assert("total_equity 5700", bs["total_equity"] == 5700.0,
            str(bs["total_equity"]))
    cye = [e for e in bs["equity"] if e["account_id"] == "_cye"]
    _assert("CYE = 700", cye and cye[0]["amount"] == 700.0, str(cye))


def t6_cash_flow():
    """Cash net change Jan-Apr: +5000 (capital) - 300 (expense) = 4700"""
    print("\nT6 - cash flow direct")
    cf = ReportsService.cash_flow_direct(
        ACCOUNTS, ENTRIES, get_lines,
        period_start=datetime(2026, 1, 1),
        period_end=datetime(2026, 12, 31),
    )
    _assert("net change cash 4700",
            cf["net_change_in_cash"] == 4700.0,
            str(cf["net_change_in_cash"]))


def t7_pnl_zero_in_empty_period():
    print("\nT7 - empty period => zero P&L")
    pnl = ReportsService.profit_and_loss(
        ACCOUNTS, ENTRIES, get_lines,
        period_start=datetime(2027, 1, 1),
        period_end=datetime(2027, 12, 31),
    )
    _assert("revenue 0", pnl["total_revenue"] == 0.0)
    _assert("expense 0", pnl["total_expense"] == 0.0)
    _assert("net 0", pnl["net_income"] == 0.0)


def t8_trial_balance_excludes_zero_accounts():
    """Account 'ap' has no activity => excluded from TB rows."""
    print("\nT8 - TB excludes zero-balance accounts")
    tb = ReportsService.trial_balance(ACCOUNTS, ENTRIES, get_lines)
    ap_rows = [r for r in tb["rows"] if r["account_id"] == "ap"]
    _assert("AP not in rows", len(ap_rows) == 0)


def t9_balance_sheet_no_cye_when_zero():
    """If no P&L activity, no Current Year Earnings row."""
    print("\nT9 - no P&L activity => no CYE row")
    entries_only_capital = [{"id": "JE0", "date": datetime(2026, 1, 1), "status": "posted"}]
    bs = ReportsService.balance_sheet(ACCOUNTS, entries_only_capital, get_lines,
                                      as_of=datetime(2026, 4, 30))
    cye = [e for e in bs["equity"] if e["account_id"] == "_cye"]
    _assert("no CYE row", len(cye) == 0)


def t10_pnl_breakdown_per_account():
    print("\nT10 - P&L lists individual accounts")
    pnl = ReportsService.profit_and_loss(
        ACCOUNTS, ENTRIES, get_lines,
        period_start=datetime(2026, 1, 1),
        period_end=datetime(2026, 12, 31),
    )
    rev_codes = [r["code"] for r in pnl["revenue"]]
    exp_codes = [e["code"] for e in pnl["expense"]]
    _assert("revenue has 4000", "4000" in rev_codes, str(rev_codes))
    _assert("expense has 5000", "5000" in exp_codes, str(exp_codes))


def main():
    print("=" * 70)
    print("PHASE 11 SMOKE TEST - Reports v2 (TB / P&L / BS / Cash Flow)")
    print("=" * 70)
    t1_trial_balance_balanced()
    t2_trial_balance_excludes_draft()
    t3_pnl_period_filter()
    t4_pnl_excludes_january()
    t5_balance_sheet_assets_eq_liab_plus_equity()
    t6_cash_flow()
    t7_pnl_zero_in_empty_period()
    t8_trial_balance_excludes_zero_accounts()
    t9_balance_sheet_no_cye_when_zero()
    t10_pnl_breakdown_per_account()

    print("\n" + "=" * 70)
    p = sum(1 for r in results if r[0] == "PASS")
    f = sum(1 for r in results if r[0] == "FAIL")
    print(f"RESULT: {p} PASS, {f} FAIL")
    print("=" * 70)
    if f:
        for s, n, d in results:
            if s == "FAIL":
                print(f"  FAIL: {n} - {d}")
    return 0 if f == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
