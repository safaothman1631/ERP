import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.expenses import ExpenseRepository
from app.firestore.bills import BillRepository, PaymentMadeRepository
from app.firestore.taxes import TaxRateRepository
from app.firestore.system import SequenceRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.schemas.schemas import ExpenseCreate, ExpenseResponse, BillCreate, BillResponse

router = APIRouter(prefix="/api/expenses", tags=["Expenses"])


@router.get("")
def list_expenses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    repo = ExpenseRepository(user["org_id"])
    items, total = repo.list(
        filters=[{"field": "status", "op": "!=", "value": "void"}],
        order_by="date",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("", status_code=201, dependencies=[Depends(require_perm("expenses.create"))])
def create_expense(
    data: ExpenseCreate,
    user: dict = Depends(get_current_user),
):
    seq_repo = SequenceRepository(user["org_id"])
    expense_number = seq_repo.get_next("expense")
    
    repo = ExpenseRepository(user["org_id"])
    expense = repo.create({
        "id": str(uuid.uuid4()),
        "expense_number": expense_number,
        **data.model_dump(),
    })
    return expense


@router.delete("/{expense_id}", dependencies=[Depends(require_perm("expenses.delete"))])
def void_expense(expense_id: str, user: dict = Depends(get_current_user)):
    repo = ExpenseRepository(user["org_id"])
    expense = repo.get(expense_id)
    if not expense or expense.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="خەرجی نەدۆزرایەوە")
    
    repo.update(expense_id, {"status": "void"})
    return {"message": "خەرجی هەڵوەشێنرایەوە", "success": True}


# ===== BILLS =====
bills_router = APIRouter(prefix="/api/bills", tags=["Bills"])


def _calculate_bill_totals(lines_data: list, tax_repo: TaxRateRepository):
    """Calculate bill totals from line items"""
    subtotal = 0
    total_tax = 0
    
    for line_data in lines_data:
        qty = line_data.get("quantity", 1)
        price = line_data.get("unit_price", 0)
        line_subtotal = qty * price
        
        tax_amount = 0
        if line_data.get("tax_id"):
            tax = tax_repo.get(line_data["tax_id"])
            if tax:
                tax_amount = line_subtotal * (float(tax.get("rate", 0)) / 100)
        
        line_data["tax_amount"] = tax_amount
        line_data["line_total"] = line_subtotal + tax_amount
        
        subtotal += line_subtotal
        total_tax += tax_amount
    
    return subtotal, total_tax


@bills_router.get("")
def list_bills(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    status: str = Query("", max_length=20),
    user: dict = Depends(get_current_user),
):
    repo = BillRepository(user["org_id"])
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    
    items, total = repo.list(
        filters=filters,
        order_by="date",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@bills_router.post("", status_code=201, dependencies=[Depends(require_perm("bills.create"))])
def create_bill(data: BillCreate, user: dict = Depends(get_current_user)):
    seq_repo = SequenceRepository(user["org_id"])
    bill_number = seq_repo.get_next("bill")
    
    tax_repo = TaxRateRepository(user["org_id"])
    lines = [line.model_dump() for line in data.lines]
    subtotal, total_tax = _calculate_bill_totals(lines, tax_repo)
    
    repo = BillRepository(user["org_id"])
    bill = repo.create({
        "id": str(uuid.uuid4()),
        "contact_id": data.contact_id,
        "bill_number": bill_number,
        "date": data.date,
        "due_date": data.due_date,
        "reference": data.reference,
        "currency_code": data.currency_code,
        "exchange_rate": data.exchange_rate,
        "notes": data.notes,
        "subtotal": subtotal,
        "tax_amount": total_tax,
        "total": subtotal + total_tax,
        "balance_due": subtotal + total_tax,
        "status": "draft",
    })
    
    repo.set_lines(bill["id"], lines)
    return bill


@bills_router.post("/{bill_id}/approve", dependencies=[Depends(require_perm("bills.update"))])
def approve_bill(bill_id: str, user: dict = Depends(get_current_user)):
    repo = BillRepository(user["org_id"])
    bill = repo.get(bill_id)
    if not bill or bill.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پسووڵە نەدۆزرایەوە")
    if bill.get("status") != "draft":
        raise HTTPException(status_code=400, detail="تەنیا ڕەشنووس پەسەند دەکرێت")

    # FIX-50: audit trail on approval
    bill = repo.update(bill_id, {
        "status": "open",
        "approved_at": datetime.utcnow().isoformat(),
        "approved_by_id": user["id"],
        "approved_by_name": user.get("name") or user.get("email", ""),
    })
    return bill


# FIX-100/101: Bill state machine — cancel + void
@bills_router.post("/{bill_id}/cancel", dependencies=[Depends(require_perm("bills.update"))])
def cancel_bill(bill_id: str, data: dict = None, user: dict = Depends(get_current_user)):
    repo = BillRepository(user["org_id"])
    bill = repo.get(bill_id)
    if not bill or bill.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پسووڵە نەدۆزرایەوە")
    if bill.get("status") in ("paid", "void", "cancelled"):
        raise HTTPException(status_code=400, detail=f"ناتوانرێت دۆخی '{bill.get('status')}' هەڵبوەشێنرێت")
    if float(bill.get("balance_due", bill.get("total", 0)) or 0) != float(bill.get("total", 0) or 0):
        raise HTTPException(status_code=400, detail="ناتوانرێت پسووڵەی پارەی لەسەرە درا هەڵبوەشێنرێت — یەکەم پارەکە بگەڕێنەوە")
    return repo.update(bill_id, {
        "status": "cancelled",
        "cancelled_at": datetime.utcnow().isoformat(),
        "cancelled_by": user.get("id"),
        "cancellation_reason": (data or {}).get("reason", ""),
    })


@bills_router.post("/{bill_id}/void", dependencies=[Depends(require_perm("bills.update"))])
def void_bill(bill_id: str, data: dict = None, user: dict = Depends(get_current_user)):
    repo = BillRepository(user["org_id"])
    bill = repo.get(bill_id)
    if not bill or bill.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پسووڵە نەدۆزرایەوە")
    if bill.get("status") == "void":
        return bill
    return repo.update(bill_id, {
        "status": "void",
        "voided_at": datetime.utcnow().isoformat(),
        "voided_by": user.get("id"),
        "void_reason": (data or {}).get("reason", ""),
    })


# ===== PAYMENTS MADE =====
payments_made_router = APIRouter(prefix="/api/payments-made", tags=["Payments Made"])


@payments_made_router.get("")
def list_payments_made(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    repo = PaymentMadeRepository(user["org_id"])
    items, total = repo.list(
        order_by="date",
        order_dir="DESCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@payments_made_router.post("", status_code=201, dependencies=[Depends(require_perm("bills.update"))])
def create_payment_made(data: dict, user: dict = Depends(get_current_user)):
    """Record a payment to a vendor (with optional withholding tax for Iraq compliance).

    Body schema:
        bill_id (str, required): Bill being settled
        amount (float, required): Gross bill amount being applied (cash + withheld)
        date (str ISO, required)
        paid_through_account_id (str, optional): Bank/cash account; defaults to first cash
        withholding_amount (float, optional, default 0): Tax withheld at source
        withholding_account_id (str, optional): Liability account for WHT; auto-resolves

    Posts a balanced journal entry:
        DR Accounts Payable          amount
            CR Cash/Bank             amount - withholding_amount
            CR Withholding Payable   withholding_amount  (only if WHT > 0)

    Reduces bill.balance_due by `amount` (full credit applied; WHT is part of bill payment)."""
    org_id = user["org_id"]
    bill_id = data.get("bill_id")
    if not bill_id:
        raise HTTPException(status_code=400, detail="bill_id داواکراوە")
    amount = float(data.get("amount") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="بڕی پارەدان دەبێت گەورەتر بێت لە سفر")
    wh_amount = float(data.get("withholding_amount") or 0)
    if wh_amount < 0 or wh_amount > amount:
        raise HTTPException(status_code=400, detail="بڕی گرتنەوە نادروستە")

    bill_repo = BillRepository(org_id)
    bill = bill_repo.get(bill_id)
    if not bill or bill.get("org_id") != org_id:
        raise HTTPException(status_code=404, detail="پسووڵە نەدۆزرایەوە")
    if bill.get("status") in ("void", "cancelled"):
        raise HTTPException(status_code=400, detail="ناتوانیت پارە بدەیتە پسووڵەی هەڵوەشاوە")
    current_balance = float(bill.get("balance_due", bill.get("total", 0)) or 0)
    if amount > current_balance + 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"بڕی پارەدان ({amount}) لە بالانسی ماوە ({current_balance}) زیاترە",
        )

    seq_repo = SequenceRepository(org_id)
    payment_number = seq_repo.get_next("payment_made")

    pm_repo = PaymentMadeRepository(org_id)
    cash_amount = round(amount - wh_amount, 2)
    payment = pm_repo.create({
        "id": str(uuid.uuid4()),
        "payment_number": payment_number,
        "bill_id": bill_id,
        "vendor_id": bill.get("vendor_id") or bill.get("contact_id"),
        "contact_id": bill.get("vendor_id") or bill.get("contact_id"),
        "date": data.get("date"),
        "payment_date": data.get("date"),
        "amount": amount,
        "cash_amount": cash_amount,
        "withholding_amount": wh_amount,
        "withholding_account_id": data.get("withholding_account_id"),
        "paid_through_account_id": data.get("paid_through_account_id"),
        "payment_mode": data.get("payment_mode"),
        "reference": data.get("reference"),
        "description": data.get("description"),
        "currency_code": data.get("currency_code") or bill.get("currency_code") or "IQD",
        "exchange_rate": float(data.get("exchange_rate") or 1.0),
        "status": "completed",
    })

    # Reduce bill balance_due
    bill_repo.record_payment(bill_id, amount)

    # Post balanced journal entry (best-effort: log warning, don't fail payment if GL not configured)
    journal_entry_id = None
    try:
        from app.services.accounting import AccountingService
        from app.firestore.accounts import AccountRepository

        ap_account = AccountingService._get_account_by_type(org_id, "accounts_payable")
        paid_through = (
            data.get("paid_through_account_id")
            or AccountingService._get_account_by_type(org_id, "cash")
        )

        lines = [
            {
                "account_id": ap_account,
                "debit": amount,
                "credit": 0,
                "description": f"پارەدان بە دابینکار - {payment_number}",
                "contact_id": payment.get("contact_id"),
            },
            {
                "account_id": paid_through,
                "debit": 0,
                "credit": cash_amount,
                "description": f"پارەدان نەقد {payment_number}",
            },
        ]

        if wh_amount > 0:
            wh_account = data.get("withholding_account_id")
            if not wh_account:
                acc_repo = AccountRepository(org_id)
                accounts, _ = acc_repo.list(
                    filters=[{"field": "is_active", "op": "==", "value": True}],
                    limit=500,
                )
                for a in accounts:
                    blob = (a.get("name") or "").lower() + " " + (a.get("name_ku") or "")
                    if "withhold" in blob or "گرتنەوە" in blob:
                        wh_account = a["id"]
                        break
                if not wh_account:
                    for code in ("2145", "2140", "2150"):
                        a_id = AccountingService._get_account_by_code(org_id, code)
                        if a_id:
                            wh_account = a_id
                            break
            if wh_account:
                lines.append({
                    "account_id": wh_account,
                    "debit": 0,
                    "credit": wh_amount,
                    "description": f"باجی گرتنەوە {payment_number}",
                })
            else:
                raise HTTPException(
                    status_code=400,
                    detail="حسابی باجی گرتنەوە دانەنراوە — تکایە withholding_account_id بنێرە یان لە پلانی حسابات زیادی بکە",
                )

        journal = AccountingService.create_journal_entry(
            org_id=org_id,
            date=payment["date"],
            lines=lines,
            description=f"پارەدان بە پسووڵە {bill.get('bill_number') or bill_id}",
            source_type="payment_made",
            source_id=payment["id"],
            currency_code=payment.get("currency_code", "IQD"),
            exchange_rate=float(payment.get("exchange_rate", 1.0)),
            created_by=user.get("uid"),
        )
        journal_entry_id = journal.get("id")
        pm_repo.update(payment["id"], {"journal_entry_id": journal_entry_id})
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.warning(f"payment_made journal post failed for {payment['id']}: {e}")

    return {**payment, "journal_entry_id": journal_entry_id, "bill_balance_due": max(0, round(current_balance - amount, 2))}


@payments_made_router.delete("/{payment_id}", dependencies=[Depends(require_perm("bills.update"))])
def void_payment_made(payment_id: str, user: dict = Depends(get_current_user)):
    """Void a vendor payment: restores bill balance and marks payment voided.
    Note: Does NOT auto-reverse the journal entry — that requires manual reversing JE."""
    org_id = user["org_id"]
    pm_repo = PaymentMadeRepository(org_id)
    payment = pm_repo.get(payment_id)
    if not payment or payment.get("org_id") != org_id:
        raise HTTPException(status_code=404, detail="پارەدان نەدۆزرایەوە")
    if payment.get("status") == "void":
        return {"message": "پێشتر هەڵوەشاوە", "success": True}

    bill_id = payment.get("bill_id")
    if bill_id:
        bill_repo = BillRepository(org_id)
        bill = bill_repo.get(bill_id)
        if bill and bill.get("org_id") == org_id:
            restored = float(bill.get("balance_due") or 0) + float(payment.get("amount") or 0)
            total = float(bill.get("total") or restored)
            new_status = "open" if restored >= total - 0.01 else "partially_paid"
            bill_repo.update(bill_id, {
                "balance_due": round(min(restored, total), 2),
                "status": new_status,
            })

    pm_repo.update(payment_id, {"status": "void"})
    return {"message": "پارەدان هەڵوەشێنرایەوە", "success": True}
