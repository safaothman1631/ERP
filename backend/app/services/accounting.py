"""Double-Entry Accounting Engine - The core of the system"""
import uuid
from datetime import datetime
from fastapi import HTTPException
from app.firestore.journals import JournalEntryRepository
from app.firestore.accounts import AccountRepository
from app.firestore.system import SequenceRepository


class AccountingService:
    """Handles all double-entry accounting operations"""

    @staticmethod
    def create_journal_entry(
        org_id: str,
        date: datetime,
        lines: list[dict],
        description: str = "",
        reference: str = "",
        source_type: str = "manual",
        source_id: str = None,
        currency_code: str = "IQD",
        exchange_rate: float = 1.0,
        created_by: str = None,
    ) -> dict:
        """
        Create a balanced double-entry journal entry.

        lines format: [
            {"account_id": "...", "debit": 1000, "credit": 0, "description": "..."},
            {"account_id": "...", "debit": 0, "credit": 1000, "description": "..."},
        ]

        Rules:
        1. Total debits MUST equal total credits
        2. At least 2 lines required
        3. Each line must have either debit or credit (not both)
        """
        # Validate: at least 2 lines
        if len(lines) < 2:
            raise HTTPException(status_code=400, detail="پێویستە لانیکەم ٢ هێڵ هەبێت بۆ ژورناڵ")

        # Calculate totals
        total_debit = sum(float(line.get("debit", 0)) for line in lines)
        total_credit = sum(float(line.get("credit", 0)) for line in lines)

        # Validate: debits must equal credits
        if abs(total_debit - total_credit) > 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"دێبیت ({total_debit}) و کرێدیت ({total_credit}) هاوسەنگ نین!"
            )

        # Get next journal number
        seq_repo = SequenceRepository(org_id)
        entry_number = seq_repo.get_next("journal")

        # Create journal entry header + lines atomically (single batch)
        journal_repo = JournalEntryRepository(org_id)
        journal_data = {
            "id": str(uuid.uuid4()),
            "entry_number": entry_number,
            "date": date,
            "description": description,
            "reference": reference,
            "source_type": source_type,
            "source_id": source_id,
            "currency_code": currency_code,
            "exchange_rate": exchange_rate,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "status": "posted",
            "is_auto": source_type != "manual",
            "created_by": created_by,
        }
        journal = journal_repo.create_with_lines(journal_data, lines)

        # Update account balances
        acc_repo = AccountRepository(org_id)
        for line_data in lines:
            account = acc_repo.get(line_data["account_id"])
            if account:
                debit = float(line_data.get("debit", 0))
                credit = float(line_data.get("credit", 0))

                # Normal balance rules:
                # Assets & Expenses: increase with debit
                # Liabilities, Equity & Income: increase with credit
                if account.get("account_type") in ("asset", "cash", "bank", "accounts_receivable",
                                             "inventory", "fixed_asset", "other_current_asset",
                                             "expense", "operating_expense", "other_expense",
                                             "cost_of_goods_sold"):
                    balance_change = debit - credit
                else:
                    balance_change = credit - debit
                
                acc_repo.increment(line_data["account_id"], "balance", balance_change)

        return journal

    @staticmethod
    def create_invoice_journal(org_id: str, invoice: dict) -> dict:
        """Auto-create journal entry when invoice is confirmed/sent"""
        lines = [
            {
                "account_id": AccountingService._get_account_by_type(org_id, "accounts_receivable"),
                "debit": float(invoice["total"]),
                "credit": 0,
                "description": f"پسووڵە {invoice['invoice_number']}",
                "contact_id": invoice.get("contact_id"),
            },
        ]

        # Credit: sales revenue (subtotal before discount)
        sales_credit = float(invoice["subtotal"])
        lines.append({
            "account_id": AccountingService._get_account_by_type(org_id, "sales"),
            "debit": 0,
            "credit": sales_credit,
            "description": f"داهاتی فرۆشتن - {invoice['invoice_number']}",
        })

        # Debit: discount (reduces revenue)
        discount = float(invoice.get("discount_amount", 0))
        if discount > 0:
            lines.append({
                "account_id": AccountingService._get_account_by_type(org_id, "sales"),
                "debit": discount,
                "credit": 0,
                "description": f"داشکاندن - {invoice['invoice_number']}",
            })

        # Add tax line if applicable
        if float(invoice.get("tax_amount", 0)) > 0:
            tax_account = AccountingService._get_account_by_code(org_id, "2140")
            if tax_account:
                lines.append({
                    "account_id": tax_account,
                    "debit": 0,
                    "credit": float(invoice["tax_amount"]),
                    "description": f"باجی فرۆشتن - {invoice['invoice_number']}",
                })

        # Credit: shipping charge
        shipping = float(invoice.get("shipping_charge", 0))
        if shipping > 0:
            lines.append({
                "account_id": AccountingService._get_account_by_type(org_id, "sales"),
                "debit": 0,
                "credit": shipping,
                "description": f"بارکردن - {invoice['invoice_number']}",
            })

        # Handle adjustment (can be positive or negative)
        adjustment = float(invoice.get("adjustment", 0))
        if adjustment > 0:
            lines.append({
                "account_id": AccountingService._get_account_by_type(org_id, "sales"),
                "debit": 0,
                "credit": adjustment,
                "description": f"ڕێکخستن - {invoice['invoice_number']}",
            })
        elif adjustment < 0:
            lines.append({
                "account_id": AccountingService._get_account_by_type(org_id, "sales"),
                "debit": abs(adjustment),
                "credit": 0,
                "description": f"ڕێکخستن - {invoice['invoice_number']}",
            })

        return AccountingService.create_journal_entry(
            org_id=org_id,
            date=invoice["date"],
            lines=lines,
            description=f"پسووڵەی فرۆشتن {invoice['invoice_number']}",
            source_type="invoice",
            source_id=invoice["id"],
            currency_code=invoice.get("currency_code", "IQD"),
            exchange_rate=float(invoice.get("exchange_rate", 1.0)),
        )

    @staticmethod
    def create_payment_received_journal(org_id: str, payment: dict) -> dict:
        """Auto-create journal when payment is received from customer"""
        deposit_account = payment.get("deposit_to_account_id") or \
            AccountingService._get_account_by_type(org_id, "cash")

        lines = [
            {
                "account_id": deposit_account,
                "debit": float(payment["amount"]),
                "credit": 0,
                "description": f"وەرگرتنی پارە {payment['payment_number']}",
            },
            {
                "account_id": AccountingService._get_account_by_type(org_id, "accounts_receivable"),
                "debit": 0,
                "credit": float(payment["amount"]),
                "description": f"وەرگرتنی پارە لە کڕیار - {payment['payment_number']}",
                "contact_id": payment.get("contact_id"),
            },
        ]

        return AccountingService.create_journal_entry(
            org_id=org_id,
            date=payment["date"],
            lines=lines,
            description=f"وەرگرتنی پارە {payment['payment_number']}",
            source_type="payment_received",
            source_id=payment["id"],
            currency_code=payment.get("currency_code", "IQD"),
            exchange_rate=float(payment.get("exchange_rate", 1.0)),
        )

    @staticmethod
    def create_expense_journal(org_id: str, expense: dict) -> dict:
        """Auto-create journal when expense is recorded"""
        paid_through = expense.get("paid_through_account_id") or \
            AccountingService._get_account_by_type(org_id, "cash")

        lines = [
            {
                "account_id": expense["account_id"],
                "debit": float(expense["total"]),
                "credit": 0,
                "description": f"خەرجی {expense['expense_number']} - {expense.get('description', '')}",
            },
            {
                "account_id": paid_through,
                "debit": 0,
                "credit": float(expense["total"]),
                "description": f"پارەدان بۆ خەرجی {expense['expense_number']}",
            },
        ]

        return AccountingService.create_journal_entry(
            org_id=org_id,
            date=expense["date"],
            lines=lines,
            description=f"خەرجی {expense['expense_number']}",
            source_type="expense",
            source_id=expense["id"],
            currency_code=expense.get("currency_code", "IQD"),
            exchange_rate=float(expense.get("exchange_rate", 1.0)),
        )

    @staticmethod
    def create_bill_journal(org_id: str, bill: dict, bill_lines: list) -> dict:
        """Auto-create journal when bill is confirmed"""
        lines = []

        # Debit: expense/inventory accounts from bill lines
        for line in bill_lines:
            account_id = line.get("account_id") or AccountingService._get_account_by_type(org_id, "cost_of_goods_sold")
            lines.append({
                "account_id": account_id,
                "debit": float(line["line_total"]),
                "credit": 0,
                "description": line.get("description") or f"پسووڵەی دابینکار {bill['bill_number']}",
            })

        # Credit: accounts payable
        lines.append({
            "account_id": AccountingService._get_account_by_type(org_id, "accounts_payable"),
            "debit": 0,
            "credit": float(bill["total"]),
            "description": f"پسووڵەی دابینکار {bill['bill_number']}",
            "contact_id": bill.get("contact_id"),
        })

        return AccountingService.create_journal_entry(
            org_id=org_id,
            date=bill["date"],
            lines=lines,
            description=f"پسووڵەی دابینکار {bill['bill_number']}",
            source_type="bill",
            source_id=bill["id"],
            currency_code=bill.get("currency_code", "IQD"),
            exchange_rate=float(bill.get("exchange_rate", 1.0)),
        )

    @staticmethod
    def create_payment_made_journal(org_id: str, payment: dict) -> dict:
        """Auto-create journal when payment is made to vendor"""
        paid_through = payment.get("paid_through_account_id") or \
            AccountingService._get_account_by_type(org_id, "cash")

        lines = [
            {
                "account_id": AccountingService._get_account_by_type(org_id, "accounts_payable"),
                "debit": float(payment["amount"]),
                "credit": 0,
                "description": f"پارەدان بە دابینکار - {payment['payment_number']}",
                "contact_id": payment.get("contact_id"),
            },
            {
                "account_id": paid_through,
                "debit": 0,
                "credit": float(payment["amount"]),
                "description": f"پارەدان {payment['payment_number']}",
            },
        ]

        return AccountingService.create_journal_entry(
            org_id=org_id,
            date=payment["date"],
            lines=lines,
            description=f"پارەدان بە دابینکار {payment['payment_number']}",
            source_type="payment_made",
            source_id=payment["id"],
            currency_code=payment.get("currency_code", "IQD"),
            exchange_rate=float(payment.get("exchange_rate", 1.0)),
        )

    @staticmethod
    def _get_account_by_type(org_id: str, account_type: str) -> str:
        """Get account ID by account type"""
        acc_repo = AccountRepository(org_id)
        filters = [
            {"field": "account_type", "op": "==", "value": account_type},
            {"field": "is_active", "op": "==", "value": True},
        ]
        accounts, _ = acc_repo.list(filters=filters, limit=1)
        if not accounts:
            raise HTTPException(status_code=404, detail=f"حساب بۆ جۆری {account_type} نەدۆزرایەوە")
        return accounts[0]["id"]

    @staticmethod
    def _get_account_by_code(org_id: str, code: str) -> str | None:
        """Get account ID by code"""
        acc_repo = AccountRepository(org_id)
        filters = [
            {"field": "code", "op": "==", "value": code},
            {"field": "is_active", "op": "==", "value": True},
        ]
        accounts, _ = acc_repo.list(filters=filters, limit=1)
        return accounts[0]["id"] if accounts else None

    @staticmethod
    def create_credit_note_journal(org_id: str, credit_note: dict) -> dict:
        """Journal: Dr Sales Revenue / Cr Accounts Receivable"""
        lines = [
            {
                "account_id": AccountingService._get_account_by_type(org_id, "sales"),
                "debit": float(credit_note["total"]),
                "credit": 0,
                "description": f"کرێدیت نۆت {credit_note['credit_note_number']}",
            },
            {
                "account_id": AccountingService._get_account_by_type(org_id, "accounts_receivable"),
                "debit": 0,
                "credit": float(credit_note["total"]),
                "description": f"کرێدیت نۆت {credit_note['credit_note_number']}",
                "contact_id": credit_note.get("contact_id"),
            },
        ]
        return AccountingService.create_journal_entry(
            org_id=org_id, date=credit_note["date"], lines=lines,
            description=f"کرێدیت نۆت {credit_note['credit_note_number']}",
            source_type="credit_note", source_id=credit_note["id"],
            currency_code=credit_note.get("currency_code", "IQD"),
        )

    @staticmethod
    def create_vendor_credit_journal(org_id: str, vendor_credit: dict, vc_lines: list) -> dict:
        """Journal: Dr Accounts Payable / Cr Expense"""
        lines = [
            {
                "account_id": AccountingService._get_account_by_type(org_id, "accounts_payable"),
                "debit": float(vendor_credit["total"]),
                "credit": 0,
                "description": f"کرێدیتی فرۆشیار {vendor_credit['credit_note_number']}",
                "contact_id": vendor_credit.get("contact_id"),
            },
        ]

        # Credit the expense accounts from vendor credit lines
        for vc_line in vc_lines:
            account_id = vc_line.get("account_id") or AccountingService._get_account_by_type(org_id, "cost_of_goods_sold")
            lines.append({
                "account_id": account_id,
                "debit": 0,
                "credit": float(vc_line["line_total"]),
                "description": vc_line.get("description") or f"کرێدیتی فرۆشیار {vendor_credit['credit_note_number']}",
            })

        return AccountingService.create_journal_entry(
            org_id=org_id, date=vendor_credit["date"], lines=lines,
            description=f"کرێدیتی فرۆشیار {vendor_credit['credit_note_number']}",
            source_type="vendor_credit", source_id=vendor_credit["id"],
            currency_code=vendor_credit.get("currency_code", "IQD"),
        )
