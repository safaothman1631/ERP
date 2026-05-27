"""Period Close Service - Phase 3 Year-End

Provides:
- compute_period_pnl(): sum of revenue - expense activity in a date range
- preview_year_end_close(): dry-run preview of retained earnings posting
- post_year_end_close(): create the closing journal entry (atomic)
- check_period_locked(): respect transaction_locks (existing API)

Design:
- Closing entry zeroes Income & Expense accounts and posts net P&L to Retained
  Earnings (account designated by settings key `retained_earnings_account_id`).
- Reopen = simply post the reverse entry; the closing entry stays for audit.
"""
from datetime import datetime
from typing import Optional

from app.firebase_client import get_db
from app.firestore.accounts import AccountRepository
from app.firestore.journals import JournalEntryRepository
from app.firestore.system import SettingsRepository
from app.services.accounting import AccountingService
from app.services.report_streams import collect_stream

# Account types treated as Revenue (credit-normal)
REVENUE_TYPES = {"sales", "income", "other_income", "revenue"}
# Account types treated as Expense (debit-normal)
EXPENSE_TYPES = {
    "expense", "operating_expense", "other_expense",
    "cost_of_goods_sold",
}


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


class PeriodCloseService:

    @staticmethod
    def check_period_locked(org_id: str, on_date: datetime) -> bool:
        """Return True if `on_date` is on or before the configured lock date."""
        db = get_db()
        doc = db.collection("transaction_locks").document(org_id).get()
        if not doc.exists:
            return False
        lock_date = _to_dt(doc.to_dict().get("lock_date"))
        if not lock_date:
            return False
        on = on_date if on_date.tzinfo is None else on_date.replace(tzinfo=None)
        if lock_date.tzinfo is not None:
            lock_date = lock_date.replace(tzinfo=None)
        return on <= lock_date

    @staticmethod
    def get_lock_status(org_id: str, on_date: datetime) -> dict:
        """Return lock metadata for a given date."""
        locked = PeriodCloseService.check_period_locked(org_id, on_date)
        db = get_db()
        doc = db.collection("transaction_locks").document(org_id).get()
        lock_date_raw = doc.to_dict().get("lock_date") if doc.exists else None
        lock_dt = _to_dt(lock_date_raw)
        return {
            "locked": locked,
            "lock_date": lock_dt.isoformat() if lock_dt else None,
            "reason": "transaction_lock" if locked else None,
        }

    @staticmethod
    def assert_not_locked(org_id: str, on_date: datetime) -> None:
        """Raise HTTP 409 if the date falls in a locked period."""
        if PeriodCloseService.check_period_locked(org_id, on_date):
            from fastapi import HTTPException
            status = PeriodCloseService.get_lock_status(org_id, on_date)
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "period_locked",
                    "message": "Period locked: cannot post on or before lock date",
                    "lock_date": status.get("lock_date"),
                },
            )

    @staticmethod
    def compute_period_pnl(
        org_id: str,
        period_start: datetime,
        period_end: datetime,
    ) -> dict:
        """Sum revenue and expense activity in the period, per account.

        Iterates posted journal entries in [period_start, period_end].

        Returns: {
          "revenue_by_account": {account_id: net_credit_amount},
          "expense_by_account": {account_id: net_debit_amount},
          "total_revenue": float,
          "total_expense": float,
          "net_income": revenue - expense,
        }
        """
        je_repo = JournalEntryRepository(org_id)
        acc_repo = AccountRepository(org_id)
        accounts = {a["id"]: a for a in collect_stream(acc_repo)}

        entries, _ = je_repo.list(
            filters=[
                {"field": "date", "op": ">=", "value": period_start},
                {"field": "date", "op": "<=", "value": period_end},
                {"field": "status", "op": "==", "value": "posted"},
            ],
            limit=100000,
        )

        revenue_by = {}
        expense_by = {}

        for e in entries:
            lines = je_repo.get_lines(e["id"])
            for ln in lines:
                aid = ln.get("account_id")
                if not aid or aid not in accounts:
                    continue
                acc_type = accounts[aid].get("account_type", "")
                debit = float(ln.get("debit", 0) or 0)
                credit = float(ln.get("credit", 0) or 0)

                if acc_type in REVENUE_TYPES:
                    # Revenue: credits increase, debits decrease
                    revenue_by[aid] = revenue_by.get(aid, 0.0) + (credit - debit)
                elif acc_type in EXPENSE_TYPES:
                    # Expense: debits increase, credits decrease
                    expense_by[aid] = expense_by.get(aid, 0.0) + (debit - credit)

        total_revenue = sum(revenue_by.values())
        total_expense = sum(expense_by.values())

        return {
            "revenue_by_account": revenue_by,
            "expense_by_account": expense_by,
            "total_revenue": round(total_revenue, 2),
            "total_expense": round(total_expense, 2),
            "net_income": round(total_revenue - total_expense, 2),
        }

    @staticmethod
    def _resolve_retained_earnings_account(org_id: str) -> Optional[str]:
        """Find the configured retained earnings account.

        Priority:
          1. Settings key `retained_earnings_account_id`
          2. Account by type == "retained_earnings"
          3. Account by code == "3200" (common default)
        """
        try:
            s = SettingsRepository(org_id)
            cfg = s.get_by_key("retained_earnings_account_id", category="accounting")
            if cfg:
                return cfg
        except Exception:
            pass

        acc_repo = AccountRepository(org_id)
        accs = collect_stream(acc_repo)
        for a in accs:
            if a.get("account_type") == "retained_earnings":
                return a["id"]
        for a in accs:
            if a.get("code") == "3200":
                return a["id"]
        return None

    @staticmethod
    def preview_year_end_close(
        org_id: str,
        fiscal_year_end: datetime,
        period_start: Optional[datetime] = None,
    ) -> dict:
        """Build (without posting) the closing journal entry.

        Returns: {
          "period_start": iso, "period_end": iso,
          "pnl": <compute_period_pnl output>,
          "retained_earnings_account_id": str | None,
          "lines": [<journal lines>],
          "balanced": bool,
          "warnings": [str],
        }
        """
        if period_start is None:
            period_start = datetime(fiscal_year_end.year, 1, 1)

        warnings = []
        pnl = PeriodCloseService.compute_period_pnl(org_id, period_start, fiscal_year_end)
        re_account = PeriodCloseService._resolve_retained_earnings_account(org_id)

        if re_account is None:
            warnings.append(
                "Retained earnings account not configured. Set `retained_earnings_account_id` in settings or create an account with type=retained_earnings."
            )

        # Build lines:
        # For each revenue account with positive net credit balance: DR revenue (close it)
        # For each expense account with positive net debit balance: CR expense (close it)
        # Plug to retained earnings: net_income > 0 -> CR RE; net_income < 0 -> DR RE
        lines = []
        for aid, amt in pnl["revenue_by_account"].items():
            if abs(amt) < 0.01:
                continue
            # amt is net credit; to close, we debit the same amount
            lines.append({
                "account_id": aid,
                "debit": round(amt, 2) if amt > 0 else 0.0,
                "credit": round(-amt, 2) if amt < 0 else 0.0,
                "description": "Year-end close - revenue",
            })

        for aid, amt in pnl["expense_by_account"].items():
            if abs(amt) < 0.01:
                continue
            # amt is net debit; to close, we credit the same amount
            lines.append({
                "account_id": aid,
                "debit": round(-amt, 2) if amt < 0 else 0.0,
                "credit": round(amt, 2) if amt > 0 else 0.0,
                "description": "Year-end close - expense",
            })

        # Plug retained earnings
        net = pnl["net_income"]
        if re_account and abs(net) >= 0.01:
            if net > 0:
                lines.append({
                    "account_id": re_account,
                    "debit": 0.0,
                    "credit": round(net, 2),
                    "description": "Year-end close - net income to retained earnings",
                })
            else:
                lines.append({
                    "account_id": re_account,
                    "debit": round(-net, 2),
                    "credit": 0.0,
                    "description": "Year-end close - net loss to retained earnings",
                })

        total_d = round(sum(float(l["debit"]) for l in lines), 2)
        total_c = round(sum(float(l["credit"]) for l in lines), 2)
        balanced = abs(total_d - total_c) < 0.01

        return {
            "period_start": period_start.isoformat(),
            "period_end": fiscal_year_end.isoformat(),
            "pnl": pnl,
            "retained_earnings_account_id": re_account,
            "lines": lines,
            "total_debit": total_d,
            "total_credit": total_c,
            "balanced": balanced,
            "warnings": warnings,
        }

    @staticmethod
    def post_year_end_close(
        org_id: str,
        fiscal_year_end: datetime,
        period_start: Optional[datetime] = None,
        created_by: Optional[str] = None,
    ) -> dict:
        """Post the closing journal entry. Refuses if period is locked or
        preview is unbalanced/missing accounts.
        """
        if PeriodCloseService.check_period_locked(org_id, fiscal_year_end):
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Period is locked")

        preview = PeriodCloseService.preview_year_end_close(
            org_id, fiscal_year_end, period_start
        )
        if preview["warnings"]:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="; ".join(preview["warnings"]))
        if not preview["lines"]:
            return {"posted": False, "reason": "no activity to close", "preview": preview}
        if not preview["balanced"]:
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail="Closing entry is not balanced")

        journal = AccountingService.create_journal_entry(
            org_id=org_id,
            date=fiscal_year_end,
            lines=preview["lines"],
            description=f"Year-end close {fiscal_year_end.year}",
            source_type="year_end_close",
            source_id=f"yec-{fiscal_year_end.year}",
            created_by=created_by,
        )
        return {
            "posted": True,
            "journal_id": journal["id"],
            "entry_number": journal["entry_number"],
            "preview": preview,
        }
