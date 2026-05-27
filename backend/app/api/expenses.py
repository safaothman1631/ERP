import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from app.firestore.expenses import ExpenseRepository
from app.firestore.bills import BillRepository, PaymentMadeRepository
from app.firestore.bills import PurchaseOrderRepository
from app.firestore.taxes import TaxRateRepository
from app.firestore.system import SequenceRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services.three_way_match import ThreeWayMatchService
from app.services.match_normalizers import (
    normalize_bill_for_match,
    normalize_po_for_match,
    normalize_receipts_for_match,
)
from app.services import settings_service
from app.schemas.schemas import ExpenseCreate, ExpenseResponse, BillCreate, BillUpdate, BillResponse
from app.services.versioned_update import apply_versioned_update
from app.services.module_gate import require_module

router = APIRouter(
    prefix="/api/expenses",
    tags=["Expenses"],
    dependencies=[Depends(require_module("purchase"))],
)


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
bills_router = APIRouter(
    prefix="/api/bills",
    tags=["Bills"],
    dependencies=[Depends(require_module("purchase"))],
)


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
    cursor: str = Query("", max_length=64),
    user: dict = Depends(get_current_user),
):
    repo = BillRepository(user["org_id"])
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})

    from app.services.api_list import api_list
    from app.services.list_response import paginated_response

    items, total, next_cursor = api_list(
        repo,
        page=page,
        page_size=page_size,
        cursor=cursor or None,
        filters=filters,
        order_by="date",
        order_dir="DESCENDING",
    )
    return paginated_response(
        items, total, page, page_size, repo=repo, next_cursor=next_cursor
    )


@bills_router.post("", status_code=201, dependencies=[Depends(require_perm("bills.create"))])
def create_bill(data: BillCreate, user: dict = Depends(get_current_user)):
    from app.services.numbering_service import get_next_number
    
    # Get branch_id from request or user default
    branch_id = getattr(data, 'branch_id', None) or user.get('default_branch_id')
    
    # Generate bill number if not provided
    auto_numbered = False
    if hasattr(data, 'bill_number') and data.bill_number:
        bill_number = data.bill_number
    else:
        bill_number = get_next_number(user["org_id"], branch_id, "bill", "BILL")
        auto_numbered = True
    
    tax_repo = TaxRateRepository(user["org_id"])
    lines = [line.model_dump() for line in data.lines]
    subtotal, total_tax = _calculate_bill_totals(lines, tax_repo)
    
    repo = BillRepository(user["org_id"])
    bill = repo.create({
        "id": str(uuid.uuid4()),
        "contact_id": data.contact_id,
        "bill_number": bill_number,
        "auto_numbered": auto_numbered,
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


@bills_router.put("/{bill_id}", dependencies=[Depends(require_perm("bills.update"))])
def update_bill(
    bill_id: str,
    data: BillUpdate,
    user: dict = Depends(get_current_user),
    if_match: Optional[str] = Header(None, alias="If-Match"),
):
    repo = BillRepository(user["org_id"])
    bill = repo.get(bill_id)
    if not bill or bill.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پسووڵە نەدۆزرایەوە")
    if bill.get("status") not in ("draft",):
        raise HTTPException(status_code=400, detail="تەنیا ڕەشنووس دەتوانرێت دەستکاری بکرێت")

    update_data = data.model_dump(exclude_unset=True, exclude={"lines"})
    bill = apply_versioned_update(repo, bill_id, update_data, if_match=if_match)

    if data.lines is not None:
        tax_repo = TaxRateRepository(user["org_id"])
        lines = [line.model_dump() for line in data.lines]
        subtotal, total_tax = _calculate_bill_totals(lines, tax_repo)
        total = subtotal + total_tax
        repo.update(bill_id, {
            "subtotal": subtotal,
            "tax_amount": total_tax,
            "total": total,
            "balance_due": total - float(bill.get("amount_paid", 0) or 0),
        })
        repo.set_lines(bill_id, lines)
        bill = repo.get_with_lines(bill_id) or repo.get(bill_id)
    return bill


@bills_router.post("/{bill_id}/approve", dependencies=[Depends(require_perm("bills.update"))])
def approve_bill(bill_id: str, user: dict = Depends(get_current_user)):
    repo = BillRepository(user["org_id"])
    bill = repo.get(bill_id)
    if not bill or bill.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="پسووڵە نەدۆزرایەوە")
    if bill.get("status") != "draft":
        raise HTTPException(status_code=400, detail="تەنیا ڕەشنووس پەسەند دەکرێت")

    po_id = bill.get("purchase_order_id")
    if po_id:
        po_repo = PurchaseOrderRepository(user["org_id"])
        po = po_repo.get_with_lines(po_id)
        if po:
            cfg = settings_service.get_purchases_settings(user["org_id"])
            match_required = po.get("three_way_match_required", cfg.get("three_way_match", False))
            if match_required:
                bill_full = repo.get_with_lines(bill_id)
                match_result = ThreeWayMatchService.match(
                    normalize_po_for_match(po),
                    normalize_receipts_for_match(po.get("goods_receipts") or []),
                    normalize_bill_for_match(bill_full or bill),
                )
                allowed, reason = ThreeWayMatchService.can_post_bill(match_result)
                if not allowed:
                    raise HTTPException(status_code=422, detail=reason or "three_way_match_failed")

    from app.services.bill_approve import approve_bill_atomic

    from app.services.firestore_tx import TenantMismatchError

    try:
        bill = approve_bill_atomic(
            user["org_id"],
            bill_id,
            approved_by_id=user["id"],
            approved_by_name=user.get("name") or user.get("email", ""),
        )
    except TenantMismatchError:
        raise HTTPException(status_code=404, detail="پسووڵە نەدۆزرایەوە")
    except ValueError as exc:
        if str(exc) == "bill_not_draft":
            raise HTTPException(status_code=400, detail="تەنیا ڕەشنووس پەسەند دەکرێت")
        raise
    try:
        from app.services.webhook_dispatcher import dispatch_event
        dispatch_event(user["org_id"], "bill.approved", {"id": bill_id})
    except Exception:
        pass
    try:
        from app.services.automation_runner import fire_automated_actions
        fire_automated_actions(user["org_id"], "bill", "on_status_change", bill)
    except Exception:
        pass
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

    from app.services.accounting import AccountingService
    from app.firestore.accounts import AccountRepository
    from app.services.bill_payments import (
        create_payment_made_atomic,
        create_payment_made_with_je_atomic,
    )

    payment_id = str(uuid.uuid4())
    cash_amount = round(amount - wh_amount, 2)
    payment_payload = {
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
    }

    ap_account = AccountingService._get_account_by_type(org_id, "accounts_payable")
    paid_through = (
        data.get("paid_through_account_id")
        or AccountingService._get_account_by_type(org_id, "cash")
    )
    je_lines = None
    if ap_account and paid_through:
        je_lines = [
            {
                "account_id": ap_account,
                "debit": amount,
                "credit": 0,
                "description": f"پارەدان بە دابینکار - {payment_number}",
                "contact_id": payment_payload["contact_id"],
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
            if not wh_account:
                raise HTTPException(
                    status_code=400,
                    detail="حسابی باجی گرتنەوە دانەنراوە — تکایە withholding_account_id بنێرە یان لە پلانی حسابات زیادی بکە",
                )
            je_lines.append({
                "account_id": wh_account,
                "debit": 0,
                "credit": wh_amount,
                "description": f"باجی گرتنەوە {payment_number}",
            })

    try:
        if je_lines:
            payment = create_payment_made_with_je_atomic(
                org_id,
                payment_id,
                payment_payload,
                je_lines=je_lines,
                je_description=f"پارەدان بە پسووڵە {bill.get('bill_number') or bill_id}",
                je_date=data.get("date"),
                created_by=user.get("uid"),
                currency_code=payment_payload["currency_code"],
                exchange_rate=payment_payload["exchange_rate"],
            )
        else:
            payment = create_payment_made_atomic(org_id, payment_id, payment_payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail={"code": "bill_payment_failed", "message": str(exc)}) from exc

    journal_entry_id = payment.get("journal_entry_id")
    return {
        **payment,
        "journal_entry_id": journal_entry_id,
        "bill_balance_due": max(0, round(current_balance - amount, 2)),
    }


@payments_made_router.delete("/{payment_id}", dependencies=[Depends(require_perm("bills.update"))])
def void_payment_made(payment_id: str, user: dict = Depends(get_current_user)):
    """Void a vendor payment: restores bill balance atomically.
    Note: Does NOT auto-reverse the journal entry — that requires manual reversing JE."""
    org_id = user["org_id"]
    pm_repo = PaymentMadeRepository(org_id)
    payment = pm_repo.get(payment_id)
    if not payment or payment.get("org_id") != org_id:
        raise HTTPException(status_code=404, detail="پارەدان نەدۆزرایەوە")
    if payment.get("status") == "void":
        return {"message": "پێشتر هەڵوەشاوە", "success": True}

    from app.services.bill_payments import void_payment_made_atomic

    try:
        void_payment_made_atomic(org_id, payment_id)
    except ValueError as exc:
        if str(exc) == "payment_not_found":
            raise HTTPException(status_code=404, detail="پارەدان نەدۆزرایەوە") from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"message": "پارەدان هەڵوەشێنرایەوە", "success": True}
