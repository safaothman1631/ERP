import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
from app.firestore.system import SalesReturnRepository, PurchaseReturnRepository
from app.firestore.returns import RefundRecordRepository
from app.firestore.invoices import CreditNoteRepository
from app.firestore.bills import VendorCreditRepository
from app.firestore.payments import PaymentReceivedRepository, PaymentMadeRepository
from app.firestore.inventory import StockMovementRepository
from app.firestore.journals import JournalEntryRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/returns", tags=["Returns"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _create_stock_movements(org_id: str, return_id: str, lines: list, direction: str, reason: str) -> int:
    """Create stock movements for a return.
    direction: 'in' (sales return = goods back to stock) or 'out' (vendor return = goods leaving stock).
    Returns count of movements created.
    """
    if not lines:
        return 0
    sm_repo = StockMovementRepository(org_id)
    count = 0
    for line in lines:
        item_id = line.get("item_id") or line.get("product_id")
        qty = float(line.get("quantity") or line.get("qty") or 0)
        if not item_id or qty <= 0:
            continue
        signed_qty = qty if direction == "in" else -qty
        sm_repo.create({
            "id": str(uuid.uuid4()),
            "item_id": item_id,
            "warehouse_id": line.get("warehouse_id"),
            "quantity": signed_qty,
            "movement_type": f"return_{direction}",
            "reference_type": "return",
            "reference_id": return_id,
            "date": _now_iso(),
            "notes": reason,
        })
        count += 1
    return count


def _create_cash_refund_journal(org_id: str, ret: dict, amount: float, refund_type: str, user: dict) -> Optional[str]:
    """Create a journal entry for a cash refund.
    refund_type: 'sale' (DR Sales Returns, CR Cash) or 'vendor' (DR Cash, CR Purchase Returns).
    Returns the journal entry id (or None on failure).
    """
    try:
        je_repo = JournalEntryRepository(org_id)
        je_id = str(uuid.uuid4())
        ref = ret.get("return_number") or ret.get("id", "")
        if refund_type == "sale":
            lines = [
                {"account_code": "4900", "account_name": "Sales Returns", "debit": amount, "credit": 0,
                 "description": f"Sales return refund {ref}"},
                {"account_code": "1000", "account_name": "Cash", "debit": 0, "credit": amount,
                 "description": f"Cash refund for return {ref}"},
            ]
        else:
            lines = [
                {"account_code": "1000", "account_name": "Cash", "debit": amount, "credit": 0,
                 "description": f"Refund received for vendor return {ref}"},
                {"account_code": "5900", "account_name": "Purchase Returns", "debit": 0, "credit": amount,
                 "description": f"Vendor return {ref}"},
            ]
        header = {
            "id": je_id,
            "entry_number": f"JE-RFND-{je_id[:8].upper()}",
            "date": _now_iso(),
            "reference_type": "return_refund",
            "reference_id": ret.get("id"),
            "description": f"Cash refund for return {ref}",
            "total_debit": amount,
            "total_credit": amount,
            "status": "posted",
            "created_by": user.get("uid"),
        }
        je_repo.create_with_lines(header, lines)
        return je_id
    except Exception:
        return None



class RefundRequest(BaseModel):
    method: str  # 'cash' | 'credit_note' | 'wallet'
    amount: Optional[float] = None


class ApproveRequest(BaseModel):
    notes: Optional[str] = None

# === SALES RETURNS ===
@router.get("/sales")
def list_sales_returns(page: int = Query(1), page_size: int = Query(20, le=500),
                       user: dict = Depends(get_current_user)):
    repo = SalesReturnRepository(user["org_id"])
    items, total = repo.list(order_by="date", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.post("/sales", status_code=201)
def create_sales_return(data: dict, user: dict = Depends(get_current_user)):
    repo = SalesReturnRepository(user["org_id"])
    ret = repo.create({
        "id": str(uuid.uuid4()),
        "invoice_id": data.get("invoice_id"),
        "contact_id": data.get("contact_id"),
        "return_number": data.get("return_number", ""),
        "date": data.get("date"),
        "reason": data.get("reason", ""),
        "status": "pending",
        "total": data.get("total", 0),
    })
    if data.get("lines"):
        repo.set_lines(ret["id"], data["lines"])
    return ret

@router.get("/sales/{return_id}")
def get_sales_return(return_id: str, user: dict = Depends(get_current_user)):
    repo = SalesReturnRepository(user["org_id"])
    r = repo.get_with_lines(return_id)
    if not r: raise HTTPException(404)
    return r

@router.put("/sales/{return_id}")
def update_sales_return(return_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = SalesReturnRepository(user["org_id"])
    if not repo.get(return_id): raise HTTPException(404)
    return repo.update(return_id, data)

@router.delete("/sales/{return_id}")
def delete_sales_return(return_id: str, user: dict = Depends(get_current_user)):
    repo = SalesReturnRepository(user["org_id"])
    if not repo.get(return_id): raise HTTPException(404)
    repo.delete(return_id)
    return {"success": True}

# === PURCHASE RETURNS ===
@router.get("/purchases")
def list_purchase_returns(page: int = Query(1), page_size: int = Query(20, le=500),
                          user: dict = Depends(get_current_user)):
    repo = PurchaseReturnRepository(user["org_id"])
    items, total = repo.list(order_by="date", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.post("/purchases", status_code=201)
def create_purchase_return(data: dict, user: dict = Depends(get_current_user)):
    repo = PurchaseReturnRepository(user["org_id"])
    ret = repo.create({
        "id": str(uuid.uuid4()),
        "bill_id": data.get("bill_id"),
        "contact_id": data.get("contact_id"),
        "return_number": data.get("return_number", ""),
        "date": data.get("date"),
        "reason": data.get("reason", ""),
        "status": "pending",
        "total": data.get("total", 0),
    })
    if data.get("lines"):
        repo.set_lines(ret["id"], data["lines"])
    return ret

@router.get("/purchases/{return_id}")
def get_purchase_return(return_id: str, user: dict = Depends(get_current_user)):
    repo = PurchaseReturnRepository(user["org_id"])
    r = repo.get_with_lines(return_id)
    if not r: raise HTTPException(404)
    return r

@router.put("/purchases/{return_id}")
def update_purchase_return(return_id: str, data: dict, user: dict = Depends(get_current_user)):
    repo = PurchaseReturnRepository(user["org_id"])
    if not repo.get(return_id): raise HTTPException(404)
    return repo.update(return_id, data)

@router.delete("/purchases/{return_id}")
def delete_purchase_return(return_id: str, user: dict = Depends(get_current_user)):
    repo = PurchaseReturnRepository(user["org_id"])
    if not repo.get(return_id): raise HTTPException(404)
    repo.delete(return_id)
    return {"success": True}


# === SALES RETURN APPROVAL & REFUND ===
@router.post("/sales/{return_id}/approve", status_code=200)
def approve_sales_return(
    data: ApproveRequest,
    return_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Approve a sales return - marks it approved and creates inventory movement"""
    repo = SalesReturnRepository(user["org_id"])
    ret = repo.get(return_id)
    if not ret:
        raise HTTPException(404, "Return not found")
    if ret.get("status") == "approved":
        raise HTTPException(400, "Return already approved")
    
    # Update status
    repo.update(return_id, {
        "status": "approved",
        "approved_at": _now_iso(),
        "approved_by": user.get("uid"),
        "approval_notes": data.notes or "",
    })
    
    # Create inventory movements (stock back IN to warehouse)
    full = repo.get_with_lines(return_id) or ret
    moves = _create_stock_movements(
        user["org_id"], return_id, full.get("lines") or [],
        direction="in", reason=full.get("reason", "")
    )
    
    return {"success": True, "status": "approved", "stock_movements": moves}


@router.post("/sales/{return_id}/refund", status_code=201)
def refund_sales_return(
    data: RefundRequest,
    return_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Create refund for a sales return - credit note, cash, or wallet"""
    org_id = user["org_id"]
    ret_repo = SalesReturnRepository(org_id)
    ret = ret_repo.get(return_id)
    if not ret:
        raise HTTPException(404, "Return not found")
    
    if ret.get("status") != "approved":
        raise HTTPException(400, "Return must be approved before refund")
    
    refund_amount = data.amount if data.amount is not None else float(ret.get("total", 0))
    if refund_amount <= 0:
        raise HTTPException(400, "Refund amount must be positive")
    
    refund_id = str(uuid.uuid4())
    refund_record = {
        "id": refund_id,
        "org_id": org_id,
        "return_id": return_id,
        "type": "sale",
        "method": data.method,
        "amount": refund_amount,
        "currency": ret.get("currency", "IQD"),
        "status": "pending",
        "created_at": _now_iso(),
        "created_by": user.get("uid"),
    }
    
    result = {"refund_id": refund_id}
    
    # Process based on method
    if data.method == "credit_note":
        # Create credit note
        cn_repo = CreditNoteRepository(org_id)
        cn_id = str(uuid.uuid4())
        cn = cn_repo.create({
            "id": cn_id,
            "org_id": org_id,
            "credit_note_number": f"CN-{cn_id[:8].upper()}",
            "contact_id": ret.get("contact_id"),
            "invoice_id": ret.get("invoice_id"),
            "date": _now_iso(),
            "status": "open",
            "total": refund_amount,
            "balance_remaining": refund_amount,
            "amount_applied": 0,
            "reason": f"Refund for return {ret.get('return_number', return_id)}",
            "created_at": _now_iso(),
        })
        refund_record["credit_note_id"] = cn_id
        refund_record["status"] = "completed"
        result["credit_note_id"] = cn_id
    
    elif data.method == "cash":
        # Create payment record (negative amount = refund)
        pay_repo = PaymentReceivedRepository(org_id)
        pay_id = str(uuid.uuid4())
        payment = pay_repo.create({
            "id": pay_id,
            "org_id": org_id,
            "contact_id": ret.get("contact_id"),
            "date": _now_iso(),
            "amount": -refund_amount,  # Negative = refund
            "payment_mode": "cash",
            "reference": f"Refund for return {ret.get('return_number', return_id)}",
            "status": "completed",
            "created_at": _now_iso(),
        })
        refund_record["payment_id"] = pay_id
        refund_record["status"] = "completed"
        result["payment_id"] = pay_id
        
        # Create Journal Entry for cash refund (DR Sales Returns, CR Cash)
        je_id = _create_cash_refund_journal(org_id, ret, refund_amount, "sale", user)
        if je_id:
            refund_record["journal_entry_id"] = je_id
            result["journal_entry_id"] = je_id
    
    elif data.method == "wallet":
        # Increment contact's wallet balance
        from app.firestore.contacts import ContactRepository
        contact_repo = ContactRepository(org_id)
        contact = contact_repo.get(ret.get("contact_id"))
        if contact:
            current_wallet = float(contact.get("wallet_balance", 0))
            contact_repo.update(ret.get("contact_id"), {
                "wallet_balance": current_wallet + refund_amount
            })
            refund_record["status"] = "completed"
        else:
            raise HTTPException(404, "Contact not found for wallet refund")
    
    else:
        raise HTTPException(400, f"Invalid refund method: {data.method}")
    
    # Save refund record
    refund_repo = RefundRecordRepository(org_id)
    refund_repo.create(refund_record)
    
    # Update return status
    ret_repo.update(return_id, {"refund_status": "refunded"})
    
    return result


@router.get("/sales/{return_id}/refunds")
def list_sales_return_refunds(
    return_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """List all refunds for a sales return"""
    ret_repo = SalesReturnRepository(user["org_id"])
    if not ret_repo.get(return_id):
        raise HTTPException(404, "Return not found")
    
    refund_repo = RefundRecordRepository(user["org_id"])
    items, total = refund_repo.list_by_return(return_id)
    return {"items": items, "total": total}


# === VENDOR RETURNS (PURCHASE RETURNS TO VENDORS) ===
@router.post("/vendor", status_code=201)
def create_vendor_return(data: dict, user: dict = Depends(get_current_user)):
    """Create vendor return (outgoing return to vendor)"""
    repo = PurchaseReturnRepository(user["org_id"])
    ret = repo.create({
        "id": str(uuid.uuid4()),
        "bill_id": data.get("bill_id"),
        "contact_id": data.get("contact_id"),
        "return_number": data.get("return_number", ""),
        "date": data.get("date"),
        "reason": data.get("reason", ""),
        "status": "pending",
        "total": data.get("total", 0),
        "created_at": _now_iso(),
    })
    if data.get("lines"):
        repo.set_lines(ret["id"], data["lines"])
    return ret


@router.get("/vendor")
def list_vendor_returns(
    page: int = Query(1),
    page_size: int = Query(20, le=500),
    user: dict = Depends(get_current_user)
):
    """List vendor returns"""
    repo = PurchaseReturnRepository(user["org_id"])
    items, total = repo.list(order_by="date", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/vendor/{return_id}/approve", status_code=200)
def approve_vendor_return(
    data: ApproveRequest,
    return_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Approve a vendor return"""
    repo = PurchaseReturnRepository(user["org_id"])
    ret = repo.get(return_id)
    if not ret:
        raise HTTPException(404, "Return not found")
    if ret.get("status") == "approved":
        raise HTTPException(400, "Return already approved")
    
    repo.update(return_id, {
        "status": "approved",
        "approved_at": _now_iso(),
        "approved_by": user.get("uid"),
        "approval_notes": data.notes or "",
    })
    
    # Create inventory movements (stock OUT — goods leaving our warehouse to vendor)
    full = repo.get_with_lines(return_id) or ret
    moves = _create_stock_movements(
        user["org_id"], return_id, full.get("lines") or [],
        direction="out", reason=full.get("reason", "")
    )
    
    return {"success": True, "status": "approved", "stock_movements": moves}


@router.post("/vendor/{return_id}/refund", status_code=201)
def refund_vendor_return(
    data: RefundRequest,
    return_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Create refund for vendor return - vendor credit or cash"""
    org_id = user["org_id"]
    ret_repo = PurchaseReturnRepository(org_id)
    ret = ret_repo.get(return_id)
    if not ret:
        raise HTTPException(404, "Return not found")
    
    if ret.get("status") != "approved":
        raise HTTPException(400, "Return must be approved before refund")
    
    refund_amount = data.amount if data.amount is not None else float(ret.get("total", 0))
    if refund_amount <= 0:
        raise HTTPException(400, "Refund amount must be positive")
    
    refund_id = str(uuid.uuid4())
    refund_record = {
        "id": refund_id,
        "org_id": org_id,
        "return_id": return_id,
        "type": "vendor",
        "method": data.method,
        "amount": refund_amount,
        "currency": ret.get("currency", "IQD"),
        "status": "pending",
        "created_at": _now_iso(),
        "created_by": user.get("uid"),
    }
    
    result = {"refund_id": refund_id}
    
    # Process based on method
    if data.method == "credit_note":
        # Create vendor credit
        vc_repo = VendorCreditRepository(org_id)
        vc_id = str(uuid.uuid4())
        vc = vc_repo.create({
            "id": vc_id,
            "org_id": org_id,
            "vendor_credit_number": f"VC-{vc_id[:8].upper()}",
            "contact_id": ret.get("contact_id"),
            "bill_id": ret.get("bill_id"),
            "date": _now_iso(),
            "status": "open",
            "total": refund_amount,
            "balance_remaining": refund_amount,
            "reason": f"Refund for vendor return {ret.get('return_number', return_id)}",
            "created_at": _now_iso(),
        })
        refund_record["credit_note_id"] = vc_id
        refund_record["status"] = "completed"
        result["vendor_credit_id"] = vc_id
    
    elif data.method == "cash":
        # Create payment made record (negative = refund from vendor)
        pay_repo = PaymentMadeRepository(org_id)
        pay_id = str(uuid.uuid4())
        payment = pay_repo.create({
            "id": pay_id,
            "org_id": org_id,
            "contact_id": ret.get("contact_id"),
            "date": _now_iso(),
            "amount": -refund_amount,  # Negative = refund received
            "payment_mode": "cash",
            "reference": f"Refund for vendor return {ret.get('return_number', return_id)}",
            "status": "completed",
            "created_at": _now_iso(),
        })
        refund_record["payment_id"] = pay_id
        refund_record["status"] = "completed"
        result["payment_id"] = pay_id

        # Journal entry for vendor cash refund (DR Cash, CR Purchase Returns)
        je_id = _create_cash_refund_journal(org_id, ret, refund_amount, "vendor", user)
        if je_id:
            refund_record["journal_entry_id"] = je_id
            result["journal_entry_id"] = je_id

    else:
        raise HTTPException(400, f"Invalid refund method: {data.method}")
    
    # Save refund record
    refund_repo = RefundRecordRepository(org_id)
    refund_repo.create(refund_record)
    
    # Update return status
    ret_repo.update(return_id, {"refund_status": "refunded"})
    
    return result


@router.get("/vendor/{return_id}/refunds")
def list_vendor_return_refunds(
    return_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """List all refunds for a vendor return"""
    ret_repo = PurchaseReturnRepository(user["org_id"])
    if not ret_repo.get(return_id):
        raise HTTPException(404, "Return not found")
    
    refund_repo = RefundRecordRepository(user["org_id"])
    items, total = refund_repo.list_by_return(return_id)
    return {"items": items, "total": total}
