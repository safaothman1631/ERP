"""Foreign Exchange and Currency Revaluation Service"""
import uuid
from decimal import Decimal, getcontext, ROUND_HALF_UP
from datetime import datetime, date
from typing import Optional
from fastapi import HTTPException
from app.firestore.system import ExchangeRateRepository
from app.firestore.accounts import AccountRepository
from app.firestore.invoices import InvoiceRepository
from app.firestore.bills import BillRepository
from app.firestore.journals import JournalEntryRepository
from app.firestore.revaluations import RevaluationRunRepository
from app.services.accounting import AccountingService

# Set decimal precision for financial calculations
getcontext().prec = 28


class FXService:
    """Handles foreign exchange operations and currency revaluation"""

    @staticmethod
    def get_rate(org_id: str, currency: str, as_of_date: date) -> Decimal:
        """
        Get exchange rate for a currency as of a specific date.
        Returns the most recent rate <= as_of_date.
        
        Args:
            org_id: Organization ID
            currency: Currency code (e.g., 'USD', 'EUR')
            as_of_date: Date to get rate for
            
        Returns:
            Exchange rate as Decimal
            
        Raises:
            HTTPException: If no rate found
        """
        # For base currency, rate is always 1
        if currency == "IQD":
            return Decimal("1.0")
        
        rate_repo = ExchangeRateRepository("system")
        
        # Get all rates for this currency up to the date
        all_rates = rate_repo.collection \
            .where("currency", "==", currency) \
            .where("effective_date", "<=", as_of_date.isoformat()) \
            .order_by("effective_date", direction="DESCENDING") \
            .limit(1) \
            .stream()
        
        for doc in all_rates:
            rate_data = doc.to_dict()
            return Decimal(str(rate_data.get("rate", 1)))
        
        # No rate found
        raise HTTPException(
            status_code=404,
            detail=f"نرخی دراو نەدۆزرایەوە بۆ {currency} لە بەرواری {as_of_date}"
        )

    @staticmethod
    def _get_foreign_currency_accounts(org_id: str) -> list[dict]:
        """Get all accounts that have foreign currency balances"""
        acc_repo = AccountRepository(org_id)
        
        # Get accounts marked as foreign currency accounts
        # For now, we filter by is_foreign_currency flag or currency field
        all_accounts = acc_repo.list(filters=[], limit=1000)[0]
        
        foreign_accounts = []
        for acc in all_accounts:
            # Check if account is foreign currency
            if acc.get("currency") and acc.get("currency") != "IQD":
                foreign_accounts.append(acc)
            elif acc.get("is_foreign_currency"):
                foreign_accounts.append(acc)
        
        return foreign_accounts

    @staticmethod
    def _compute_account_foreign_balance(
        org_id: str,
        account_id: str,
        currency: str,
        as_of_date: date
    ) -> tuple[Decimal, Decimal]:
        """
        Compute foreign currency balance and book value for an account.
        
        Returns:
            (foreign_balance, book_value_local)
            
        For AR/AP accounts:
            - Foreign balance = sum of unpaid invoices/bills in that currency
            - Book value = sum of original local amounts
            
        For cash/bank accounts:
            - Use account balance directly
        """
        q = Decimal('0.01')
        acc_repo = AccountRepository(org_id)
        account = acc_repo.get(account_id)
        
        if not account:
            return Decimal("0"), Decimal("0")
        
        account_type = account.get("account_type", "")
        
        # For AR accounts - sum unpaid invoices
        if account_type in ("accounts_receivable", "receivable"):
            inv_repo = InvoiceRepository(org_id)
            invoices = inv_repo.list(
                filters=[
                    {"field": "status", "op": "in", "value": ["sent", "partial", "overdue"]},
                ],
                limit=5000
            )[0]
            
            foreign_balance = Decimal("0")
            book_value = Decimal("0")
            
            for inv in invoices:
                if inv.get("currency_code") == currency:
                    balance_due = Decimal(str(inv.get("balance_due", 0)))
                    original_rate = Decimal(str(inv.get("exchange_rate", 1)))
                    
                    foreign_balance += balance_due
                    book_value += (balance_due * original_rate).quantize(q, rounding=ROUND_HALF_UP)
            
            return foreign_balance, book_value
        
        # For AP accounts - sum unpaid bills
        elif account_type in ("accounts_payable", "payable"):
            bill_repo = BillRepository(org_id)
            bills = bill_repo.list(
                filters=[
                    {"field": "status", "op": "in", "value": ["open", "partial"]},
                ],
                limit=5000
            )[0]
            
            foreign_balance = Decimal("0")
            book_value = Decimal("0")
            
            for bill in bills:
                if bill.get("currency_code") == currency:
                    balance_due = Decimal(str(bill.get("balance_due", 0)))
                    original_rate = Decimal(str(bill.get("exchange_rate", 1)))
                    
                    foreign_balance += balance_due
                    book_value += (balance_due * original_rate).quantize(q, rounding=ROUND_HALF_UP)
            
            return foreign_balance, book_value
        
        # For cash/bank accounts - use ledger balance
        else:
            # Sum journal entry lines for this account
            journal_repo = JournalEntryRepository(org_id)
            
            # This is simplified - in production, you'd query ledger efficiently
            # For now, use account balance and assume it's in foreign currency
            balance = Decimal(str(account.get("balance", 0)))
            
            # Assume balance is already in base currency (book value)
            # We need to infer foreign balance from historical rate
            # This is a simplification - real system needs proper ledger tracking
            
            return Decimal("0"), balance

    @staticmethod
    def revalue_account(org_id: str, account_id: str, as_of_date: date) -> dict:
        """
        Revalue a single foreign currency account.
        
        Returns:
            {
                account_id: str,
                account_name: str,
                currency: str,
                foreign_balance: Decimal,
                current_rate: Decimal,
                revalued_local: Decimal,
                book_local: Decimal,
                gain_loss: Decimal
            }
        """
        q = Decimal('0.01')
        acc_repo = AccountRepository(org_id)
        account = acc_repo.get(account_id)
        
        if not account:
            raise HTTPException(status_code=404, detail="هەژمار نەدۆزرایەوە")
        
        currency = account.get("currency", "IQD")
        
        if currency == "IQD":
            # No revaluation needed for base currency
            return {
                "account_id": account_id,
                "account_name": account.get("name", ""),
                "currency": currency,
                "foreign_balance": Decimal("0"),
                "current_rate": Decimal("1"),
                "revalued_local": Decimal("0"),
                "book_local": Decimal("0"),
                "gain_loss": Decimal("0"),
            }
        
        # Get current rate
        current_rate = FXService.get_rate(org_id, currency, as_of_date)
        
        # Get foreign balance and book value
        foreign_balance, book_local = FXService._compute_account_foreign_balance(
            org_id, account_id, currency, as_of_date
        )
        
        # Calculate revalued amount
        revalued_local = (foreign_balance * current_rate).quantize(q, rounding=ROUND_HALF_UP)
        
        # Calculate gain/loss
        gain_loss = (revalued_local - book_local).quantize(q, rounding=ROUND_HALF_UP)
        
        return {
            "account_id": account_id,
            "account_name": account.get("name", ""),
            "currency": currency,
            "foreign_balance": float(foreign_balance),
            "current_rate": float(current_rate),
            "revalued_local": float(revalued_local),
            "book_local": float(book_local),
            "gain_loss": float(gain_loss),
        }

    @staticmethod
    def run_period_revaluation(
        org_id: str,
        period_end: date,
        gain_account_id: Optional[str] = None,
        loss_account_id: Optional[str] = None,
        post_journal: bool = False,
        created_by: Optional[str] = None,
        notes: str = "",
    ) -> dict:
        """
        Run currency revaluation for all foreign currency accounts.
        
        Args:
            org_id: Organization ID
            period_end: Period end date
            gain_account_id: Account for FX gains (required if post_journal=True)
            loss_account_id: Account for FX losses (required if post_journal=True)
            post_journal: Whether to post journal entry
            created_by: User ID
            notes: Optional notes
            
        Returns:
            {
                processed: int,
                total_gain: Decimal,
                total_loss: Decimal,
                net: Decimal,
                journal_entry_id: Optional[str],
                period_end: str,
                lines: list[dict]
            }
        """
        q = Decimal('0.01')
        
        if post_journal and (not gain_account_id or not loss_account_id):
            raise HTTPException(
                status_code=400,
                detail="هەژمارەکانی قازانج و زەرەر پێویستن بۆ تۆمارکردن"
            )
        
        # Get all foreign currency accounts
        foreign_accounts = FXService._get_foreign_currency_accounts(org_id)
        
        lines = []
        total_gain = Decimal("0")
        total_loss = Decimal("0")
        
        for account in foreign_accounts:
            try:
                result = FXService.revalue_account(org_id, account["id"], period_end)
                
                gain_loss = Decimal(str(result["gain_loss"]))
                
                if abs(gain_loss) > Decimal("0.01"):  # Ignore tiny differences
                    lines.append(result)
                    
                    if gain_loss > 0:
                        total_gain += gain_loss
                    else:
                        total_loss += abs(gain_loss)
            except Exception as e:
                # Log error but continue with other accounts
                print(f"Error revaluing account {account['id']}: {e}")
                continue
        
        net = (total_gain - total_loss).quantize(q, rounding=ROUND_HALF_UP)
        
        journal_entry_id = None
        
        # Post journal entry if requested
        if post_journal and lines:
            je_lines = []
            
            for line in lines:
                gl = Decimal(str(line["gain_loss"]))
                
                if gl > 0:
                    # Unrealized gain: DR Asset/Liability, CR Gain
                    je_lines.append({
                        "account_id": line["account_id"],
                        "debit": float(gl),
                        "credit": 0,
                        "description": f"ڕێکخستنی نرخی {line['currency']}",
                    })
                    je_lines.append({
                        "account_id": gain_account_id,
                        "debit": 0,
                        "credit": float(gl),
                        "description": f"قازانجی نرخی {line['currency']}",
                    })
                else:
                    # Unrealized loss: DR Loss, CR Asset/Liability
                    abs_loss = abs(gl)
                    je_lines.append({
                        "account_id": loss_account_id,
                        "debit": float(abs_loss),
                        "credit": 0,
                        "description": f"زەرەری نرخی {line['currency']}",
                    })
                    je_lines.append({
                        "account_id": line["account_id"],
                        "debit": 0,
                        "credit": float(abs_loss),
                        "description": f"ڕێکخستنی نرخی {line['currency']}",
                    })
            
            # Create journal entry
            je = AccountingService.create_journal_entry(
                org_id=org_id,
                date=datetime.combine(period_end, datetime.min.time()),
                lines=je_lines,
                description=notes or f"ڕێکخستنی نرخی دراو - {period_end.isoformat()}",
                reference=f"FX-REVAL-{period_end.strftime('%Y%m%d')}",
                source_type="fx_revaluation",
                created_by=created_by,
            )
            
            journal_entry_id = je["id"]
        
        # Save revaluation run
        run_repo = RevaluationRunRepository(org_id)
        run = run_repo.create_run({
            "period_end": period_end.isoformat(),
            "status": "posted" if post_journal else "preview",
            "total_gain": float(total_gain),
            "total_loss": float(total_loss),
            "net_impact": float(net),
            "journal_entry_id": journal_entry_id,
            "lines": lines,
            "gain_account_id": gain_account_id,
            "loss_account_id": loss_account_id,
            "notes": notes,
            "created_by": created_by,
        })
        
        return {
            "processed": len(lines),
            "total_gain": float(total_gain),
            "total_loss": float(total_loss),
            "net": float(net),
            "journal_entry_id": journal_entry_id,
            "period_end": period_end.isoformat(),
            "lines": lines,
            "run_id": run["id"],
        }
