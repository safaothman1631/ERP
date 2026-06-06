"""Double-Entry Accounting Engine - The core of the system"""
from datetime import datetime
from fastapi import HTTPException
from app.firestore.journals import JournalEntryRepository
from app.firestore.accounts import AccountRepository
from app.services.je_validation import validate_je_balance


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
        entry_id: str = None,
        company_id: str = None,
        emit_event: dict = None,
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
        validate_je_balance(lines, currency_code)

        from app.services.period_close import PeriodCloseService

        if PeriodCloseService.check_period_locked(org_id, date):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "period_locked",
                    "message": f"Period locked: cannot post on or before lock date",
                },
            )

        from app.services.journal_entry_atomic import create_journal_entry_atomic

        return create_journal_entry_atomic(
            org_id,
            date=date,
            lines=lines,
            description=description,
            reference=reference,
            source_type=source_type,
            source_id=source_id,
            currency_code=currency_code,
            exchange_rate=exchange_rate,
            created_by=created_by,
            company_id=company_id,
            entry_id=entry_id,
            status="posted",
            emit_event=emit_event,
        )

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
            entry_id=invoice.get("_je_entry_id"),
            created_by=invoice.get("created_by"),
            company_id=invoice.get("company_id"),
            # Pool 3.3: couple an "invoice.confirmed" event to the JE write so
            # downstream handlers (e-invoice/inventory/notification) fire once iff
            # the JE commits. Ignored unless OUTBOX_HOTPATH_ENABLED is on.
            emit_event={
                "event_type": "invoice.confirmed",
                "payload": {
                    "invoice_id": invoice["id"],
                    "org_id": org_id,
                    "invoice_number": invoice.get("invoice_number"),
                    "total": float(invoice.get("total") or 0),
                    "contact_id": invoice.get("contact_id"),
                    "company_id": invoice.get("company_id") or org_id,
                },
                "idempotency_key": f"invoice-confirmed:{invoice['id']}",
            },
        )

    @staticmethod
    def create_cogs_journal(org_id: str, source: dict, total_cost: float):
        """Post Dr COGS / Cr Inventory at cost when goods leave inventory on a
        sale. Separate from the revenue entry so they reverse independently.
        Returns None when total_cost <= 0 (nothing stocked). `source` carries
        id / reference / date / _je_entry_id / created_by for idempotency + audit."""
        total_cost = round(float(total_cost or 0), 2)
        if total_cost <= 0:
            return None
        ref = source.get("reference") or source.get("id", "")
        lines = [
            {"account_id": AccountingService._get_account_by_type(org_id, "cost_of_goods_sold"),
             "debit": total_cost, "credit": 0, "description": f"COGS - {ref}"},
            {"account_id": AccountingService._get_account_by_type(org_id, "inventory"),
             "debit": 0, "credit": total_cost, "description": f"Inventory out - {ref}"},
        ]
        return AccountingService.create_journal_entry(
            org_id=org_id,
            date=source.get("date") or datetime.utcnow(),
            lines=lines,
            description=f"COGS - {ref}",
            source_type="cogs",
            source_id=source.get("id"),
            entry_id=source.get("_je_entry_id"),
            created_by=source.get("created_by"),
            company_id=source.get("company_id"),
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
                "debit": float(line.get("line_total") or line.get("total") or line.get("amount") or 0),
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
            entry_id=bill.get("_je_entry_id"),
            created_by=bill.get("created_by"),
            company_id=bill.get("company_id"),
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

    @staticmethod
    def reverse_journal_entry(
        org_id: str,
        je_id: str,
        reversal_date: datetime,
        user_id: str | None = None,
        description: str | None = None,
    ) -> dict:
        """Create a reversing JE and link it to the original entry."""
        je_repo = JournalEntryRepository(org_id)
        original = je_repo.get(je_id)
        if not original or original.get("org_id") != org_id:
            raise HTTPException(status_code=404, detail="ژورناڵ نەدۆزرایەوە")
        if original.get("reversed_by"):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "je_already_reversed",
                    "message": "Journal entry already reversed",
                    "reversed_by": original.get("reversed_by"),
                },
            )

        lines = je_repo.get_lines(je_id)
        reversed_lines = [
            {
                "account_id": ln["account_id"],
                "debit": float(ln.get("credit", 0) or 0),
                "credit": float(ln.get("debit", 0) or 0),
                "description": f"Reverse: {ln.get('description', '')}",
                "contact_id": ln.get("contact_id"),
            }
            for ln in lines
        ]

        rev = AccountingService.create_journal_entry(
            org_id=org_id,
            date=reversal_date,
            lines=reversed_lines,
            description=description or f"Reverse {original.get('entry_number', je_id)}",
            reference=f"REV-{original.get('entry_number', je_id)}",
            source_type="journal_reversal",
            source_id=je_id,
            created_by=user_id,
        )
        je_repo.update(je_id, {"reversed_by": rev["id"], "status": "reversed"})
        je_repo.update(rev["id"], {"reverses": je_id})
        return rev
