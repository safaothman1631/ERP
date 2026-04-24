"""Smoke test for Phase 3 Period Close Service.

Pure-function tests of preview_year_end_close logic with patched repos.
"""
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from app.firebase_client import init_firebase
from app.services import period_close as pc_mod
from app.services.period_close import PeriodCloseService

init_firebase()

results = []


def _assert(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((status, name, detail))
    print(f"  [{status}] {name}{(' - ' + detail) if detail else ''}")


def _patch(accounts, entries, lines_by_entry, re_account_id="re-1", lock_date=None):
    """Patch all repository constructors used by period_close."""
    class FakeAccRepo:
        def __init__(self, org_id):
            pass
        def list(self, **kw):
            return list(accounts), len(accounts)

    class FakeJERepo:
        def __init__(self, org_id):
            pass
        def list(self, filters=None, **kw):
            # Apply date filter for tests
            out = list(entries)
            for f in filters or []:
                if f["field"] == "date" and f["op"] == ">=":
                    out = [e for e in out if e["date"] >= f["value"]]
                if f["field"] == "date" and f["op"] == "<=":
                    out = [e for e in out if e["date"] <= f["value"]]
            return out, len(out)
        def get_lines(self, eid):
            return list(lines_by_entry.get(eid, []))

    class FakeSettingsRepo:
        def __init__(self, org_id):
            pass
        def get_by_key(self, key, category="general"):
            if key == "retained_earnings_account_id":
                return re_account_id
            return None

    orig = (pc_mod.AccountRepository, pc_mod.JournalEntryRepository,
            pc_mod.SettingsRepository)
    pc_mod.AccountRepository = FakeAccRepo
    pc_mod.JournalEntryRepository = FakeJERepo
    pc_mod.SettingsRepository = FakeSettingsRepo

    # Patch lock check
    orig_lock = PeriodCloseService.check_period_locked
    PeriodCloseService.check_period_locked = staticmethod(
        lambda org_id, on_date: lock_date is not None and on_date <= lock_date
    )
    return orig, orig_lock


def _restore(orig, orig_lock):
    pc_mod.AccountRepository, pc_mod.JournalEntryRepository, pc_mod.SettingsRepository = orig
    PeriodCloseService.check_period_locked = orig_lock


def t1_compute_pnl_simple():
    """Revenue 1000, Expense 600 => Net 400"""
    print("\nT1 - compute period P&L")
    accounts = [
        {"id": "rev1", "account_type": "sales", "code": "4000"},
        {"id": "exp1", "account_type": "expense", "code": "5000"},
        {"id": "re-1", "account_type": "retained_earnings", "code": "3200"},
    ]
    entries = [
        {"id": "j1", "date": datetime(2026, 3, 15), "status": "posted"},
        {"id": "j2", "date": datetime(2026, 6, 10), "status": "posted"},
    ]
    lines_by_entry = {
        "j1": [
            {"account_id": "exp1", "debit": 600.0, "credit": 0},
            {"account_id": "rev1", "debit": 0, "credit": 600.0},
        ],
        "j2": [
            {"account_id": "exp1", "debit": 0, "credit": 0},
            {"account_id": "rev1", "debit": 0, "credit": 400.0},
        ],
    }
    orig, orig_lock = _patch(accounts, entries, lines_by_entry)
    try:
        pnl = PeriodCloseService.compute_period_pnl(
            "o", datetime(2026, 1, 1), datetime(2026, 12, 31)
        )
        _assert("revenue == 1000", abs(pnl["total_revenue"] - 1000.0) < 0.01,
                str(pnl["total_revenue"]))
        _assert("expense == 600", abs(pnl["total_expense"] - 600.0) < 0.01,
                str(pnl["total_expense"]))
        _assert("net_income == 400", abs(pnl["net_income"] - 400.0) < 0.01,
                str(pnl["net_income"]))
    finally:
        _restore(orig, orig_lock)


def t2_period_filter():
    """Entry outside period is excluded"""
    print("\nT2 - date filter excludes out-of-period entries")
    accounts = [
        {"id": "rev1", "account_type": "sales"},
        {"id": "re-1", "account_type": "retained_earnings"},
    ]
    entries = [
        {"id": "in", "date": datetime(2026, 6, 1), "status": "posted"},
        {"id": "out", "date": datetime(2027, 1, 5), "status": "posted"},
    ]
    lines_by_entry = {
        "in": [{"account_id": "rev1", "debit": 0, "credit": 100.0}],
        "out": [{"account_id": "rev1", "debit": 0, "credit": 999.0}],
    }
    orig, orig_lock = _patch(accounts, entries, lines_by_entry)
    try:
        pnl = PeriodCloseService.compute_period_pnl(
            "o", datetime(2026, 1, 1), datetime(2026, 12, 31)
        )
        _assert("revenue == 100 only", abs(pnl["total_revenue"] - 100.0) < 0.01,
                str(pnl["total_revenue"]))
    finally:
        _restore(orig, orig_lock)


def t3_preview_balanced_with_net_income():
    """Preview produces balanced lines, RE credited with net_income."""
    print("\nT3 - preview balances; RE credited net income")
    accounts = [
        {"id": "rev1", "account_type": "sales"},
        {"id": "exp1", "account_type": "expense"},
        {"id": "re-1", "account_type": "retained_earnings"},
    ]
    entries = [{"id": "j1", "date": datetime(2026, 6, 1), "status": "posted"}]
    lines_by_entry = {
        "j1": [
            {"account_id": "exp1", "debit": 300.0, "credit": 0},
            {"account_id": "rev1", "debit": 0, "credit": 1000.0},
            {"account_id": "exp1", "debit": 0, "credit": 0},  # placeholder
        ],
    }
    # Fix lines: a balanced 1000 rev, 300 exp, 700 cash (ignored for P&L)
    lines_by_entry = {
        "j1": [
            {"account_id": "exp1", "debit": 300.0, "credit": 0},
            {"account_id": "rev1", "debit": 0, "credit": 1000.0},
        ],
    }
    orig, orig_lock = _patch(accounts, entries, lines_by_entry, re_account_id="re-1")
    try:
        prev = PeriodCloseService.preview_year_end_close("o", datetime(2026, 12, 31))
        _assert("balanced", prev["balanced"], f"D={prev['total_debit']} C={prev['total_credit']}")
        _assert("3 lines", len(prev["lines"]) == 3, str(len(prev["lines"])))
        # RE should be credited 700 (net income)
        re_lines = [l for l in prev["lines"] if l["account_id"] == "re-1"]
        _assert("RE credited 700", re_lines and abs(re_lines[0]["credit"] - 700.0) < 0.01,
                str(re_lines))
    finally:
        _restore(orig, orig_lock)


def t4_preview_net_loss():
    """Net loss => RE debited."""
    print("\nT4 - net loss debits RE")
    accounts = [
        {"id": "rev1", "account_type": "sales"},
        {"id": "exp1", "account_type": "expense"},
        {"id": "re-1", "account_type": "retained_earnings"},
    ]
    entries = [{"id": "j1", "date": datetime(2026, 6, 1), "status": "posted"}]
    lines_by_entry = {
        "j1": [
            {"account_id": "exp1", "debit": 800.0, "credit": 0},
            {"account_id": "rev1", "debit": 0, "credit": 200.0},
        ],
    }
    orig, orig_lock = _patch(accounts, entries, lines_by_entry, re_account_id="re-1")
    try:
        prev = PeriodCloseService.preview_year_end_close("o", datetime(2026, 12, 31))
        _assert("balanced", prev["balanced"])
        _assert("net loss 600", abs(prev["pnl"]["net_income"] + 600.0) < 0.01,
                str(prev["pnl"]["net_income"]))
        re_lines = [l for l in prev["lines"] if l["account_id"] == "re-1"]
        _assert("RE debited 600", re_lines and abs(re_lines[0]["debit"] - 600.0) < 0.01,
                str(re_lines))
    finally:
        _restore(orig, orig_lock)


def t5_preview_warns_no_re_account():
    """No RE account configured => warning."""
    print("\nT5 - missing RE account warns")
    accounts = [
        {"id": "rev1", "account_type": "sales"},
        {"id": "exp1", "account_type": "expense"},
    ]
    entries = [{"id": "j1", "date": datetime(2026, 6, 1), "status": "posted"}]
    lines_by_entry = {
        "j1": [
            {"account_id": "exp1", "debit": 100.0, "credit": 0},
            {"account_id": "rev1", "debit": 0, "credit": 100.0},
        ],
    }
    orig, orig_lock = _patch(accounts, entries, lines_by_entry, re_account_id=None)
    try:
        prev = PeriodCloseService.preview_year_end_close("o", datetime(2026, 12, 31))
        _assert("has warning", len(prev["warnings"]) > 0)
        _assert("re_account is None", prev["retained_earnings_account_id"] is None)
    finally:
        _restore(orig, orig_lock)


def t6_no_activity_returns_empty_lines():
    """If P&L is zero, no lines."""
    print("\nT6 - no activity = empty lines")
    accounts = [{"id": "re-1", "account_type": "retained_earnings"}]
    entries = []
    orig, orig_lock = _patch(accounts, entries, {})
    try:
        prev = PeriodCloseService.preview_year_end_close("o", datetime(2026, 12, 31))
        _assert("0 lines", len(prev["lines"]) == 0)
        _assert("balanced (trivially)", prev["balanced"])
    finally:
        _restore(orig, orig_lock)


def t7_locked_period_blocks_post():
    """If period_end <= lock_date, post raises 400."""
    print("\nT7 - locked period rejects post")
    accounts = [{"id": "re-1", "account_type": "retained_earnings"}]
    orig, orig_lock = _patch(
        accounts, [], {}, lock_date=datetime(2026, 12, 31)
    )
    try:
        from fastapi import HTTPException
        try:
            PeriodCloseService.post_year_end_close("o", datetime(2026, 12, 31))
            _assert("raises HTTPException 400", False, "no exception")
        except HTTPException as e:
            _assert("raises HTTPException 400", e.status_code == 400, f"status={e.status_code}")
    finally:
        _restore(orig, orig_lock)


def main():
    print("=" * 70)
    print("PHASE 3 SMOKE TEST - Period Close Service")
    print("=" * 70)
    t1_compute_pnl_simple()
    t2_period_filter()
    t3_preview_balanced_with_net_income()
    t4_preview_net_loss()
    t5_preview_warns_no_re_account()
    t6_no_activity_returns_empty_lines()
    t7_locked_period_blocks_post()

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
