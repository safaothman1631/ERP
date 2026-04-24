import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.taxes import TaxRateRepository, TaxGroupRepository, TaxReturnRepository
from app.services.auth import get_current_user
from app.schemas.schemas import TaxRateCreate, TaxRateResponse, TaxReturnCreate, TaxReturnResponse

router = APIRouter(prefix="/api/taxes", tags=["Taxes"])


@router.get("/rates")
def list_tax_rates(user: dict = Depends(get_current_user)):
    repo = TaxRateRepository(user["org_id"])
    rates, _ = repo.list(
        filters=[{"field": "is_active", "op": "!=", "value": False}],
        limit=100
    )
    return rates


@router.post("/rates", status_code=201)
def create_tax_rate(data: TaxRateCreate, user: dict = Depends(get_current_user)):
    repo = TaxRateRepository(user["org_id"])
    rate = repo.create({
        "id": str(uuid.uuid4()),
        "name": data.name,
        "name_ku": data.name_ku,
        "rate": data.rate,
        "tax_type": data.tax_type,
        "is_compound": data.is_compound,
    })
    return rate


@router.put("/rates/{rate_id}")
def update_tax_rate(rate_id: str, data: TaxRateCreate, user: dict = Depends(get_current_user)):
    repo = TaxRateRepository(user["org_id"])
    rate = repo.get(rate_id)
    if not rate or rate.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="ڕێژەی باج نەدۆزرایەوە")
    
    rate = repo.update(rate_id, {
        "name": data.name,
        "name_ku": data.name_ku,
        "rate": data.rate,
        "tax_type": data.tax_type,
        "is_compound": data.is_compound,
    })
    return rate


@router.delete("/rates/{rate_id}")
def delete_tax_rate(rate_id: str, user: dict = Depends(get_current_user)):
    repo = TaxRateRepository(user["org_id"])
    rate = repo.get(rate_id)
    if not rate or rate.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="ڕێژەی باج نەدۆزرایەوە")
    
    repo.update(rate_id, {"is_active": False})
    return {"message": "ڕێژەی باج سڕایەوە", "success": True}


# ===== TAX GROUPS =====
@router.get("/groups")
def list_tax_groups(user: dict = Depends(get_current_user)):
    repo = TaxGroupRepository(user["org_id"])
    groups, _ = repo.list(
        filters=[{"field": "is_active", "op": "!=", "value": False}],
        limit=100
    )
    return groups


@router.post("/groups", status_code=201)
def create_tax_group(data: dict, user: dict = Depends(get_current_user)):
    import json
    repo = TaxGroupRepository(user["org_id"])
    group = repo.create({
        "id": str(uuid.uuid4()),
        "name": data["name"],
        "combined_rate": data.get("combined_rate", 0),
        "tax_ids": data.get("tax_ids", []),
    })
    return group


# ===== TAX RETURNS =====
@router.get("/returns")
def list_tax_returns(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    repo = TaxReturnRepository(user["org_id"])
    items, total = repo.list(
        order_by="period_end",
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


@router.post("/returns", status_code=201)
def create_tax_return(data: TaxReturnCreate, user: dict = Depends(get_current_user)):
    """Create tax return — auto-calculate output tax (sales) minus input tax (purchases)"""
    from app.firestore.invoices import InvoiceRepository
    from app.firestore.bills import BillRepository
    
    inv_repo = InvoiceRepository(user["org_id"])
    bill_repo = BillRepository(user["org_id"])
    
    # Calculate tax collected (from invoices in period)
    tax_collected = 0
    invoices, _ = inv_repo.list(
        filters=[
            {"field": "date", "op": ">=", "value": data.period_start},
            {"field": "date", "op": "<=", "value": data.period_end},
        ],
        limit=500
    )
    for inv in invoices:
        if inv.get("status") not in ["draft", "void"]:
            tax_collected += float(inv.get("tax_amount", 0))

    # Calculate tax paid (from bills in period)
    tax_paid = 0
    bills, _ = bill_repo.list(
        filters=[
            {"field": "date", "op": ">=", "value": data.period_start},
            {"field": "date", "op": "<=", "value": data.period_end},
        ],
        limit=500
    )
    for bill in bills:
        if bill.get("status") not in ["draft", "void"]:
            tax_paid += float(bill.get("tax_amount", 0))

    net_tax = tax_collected - tax_paid

    repo = TaxReturnRepository(user["org_id"])
    tax_return = repo.create({
        "id": str(uuid.uuid4()),
        "name": data.name,
        "period_start": data.period_start,
        "period_end": data.period_end,
        "tax_collected": tax_collected,
        "tax_paid": tax_paid,
        "net_tax": net_tax,
        "notes": data.notes,
        "status": "draft",
    })
    return tax_return


@router.get("/returns/{return_id}")
def get_tax_return(return_id: str, user: dict = Depends(get_current_user)):
    repo = TaxReturnRepository(user["org_id"])
    tr = repo.get(return_id)
    if not tr or tr.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="ڕاپۆرتی باج نەدۆزرایەوە")
    return tr


@router.post("/returns/{return_id}/file")
def file_tax_return(return_id: str, user: dict = Depends(get_current_user)):
    """File the tax return"""
    from datetime import datetime

    repo = TaxReturnRepository(user["org_id"])
    tr = repo.get(return_id)
    if not tr or tr.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="ڕاپۆرتی باج نەدۆزرایەوە")
    if tr.get("status") != "draft":
        raise HTTPException(status_code=400, detail="تەنها ڕەشنووس فایل دەکرێت")

    repo.update(return_id, {"status": "filed", "filed_date": datetime.utcnow()})
    return {"message": "ڕاپۆرتی باج فایلکرا", "success": True}


# ===== WITHHOLDING TAX =====
@router.get("/withholding")
def list_withholding_taxes(user: dict = Depends(get_current_user)):
    """List all withholding tax configurations"""
    from app.firebase_client import get_db
    db = get_db()
    docs = db.collection("withholding_taxes") \
        .where("org_id", "==", user["org_id"]) \
        .where("is_active", "==", True) \
        .stream()
    
    items = [{"id": doc.id, **doc.to_dict()} for doc in docs]
    return items


@router.post("/withholding", status_code=201)
def create_withholding_tax(data: dict, user: dict = Depends(get_current_user)):
    """Create a withholding tax configuration"""
    from app.firebase_client import get_db
    from datetime import datetime
    
    db = get_db()
    wht_id = str(uuid.uuid4())
    wht_data = {
        "id": wht_id,
        "org_id": user["org_id"],
        "name": data["name"],
        "name_ku": data.get("name_ku", ""),
        "rate": float(data["rate"]),
        "account_id": data.get("account_id"),
        "applies_to": data.get("applies_to", "vendor"),  # vendor or customer
        "is_active": True,
        "created_at": datetime.utcnow(),
    }
    
    db.collection("withholding_taxes").document(wht_id).set(wht_data)
    return wht_data


@router.get("/withholding/{tax_id}")
def get_withholding_tax(tax_id: str, user: dict = Depends(get_current_user)):
    """Get a specific withholding tax configuration"""
    from app.firebase_client import get_db
    db = get_db()
    doc = db.collection("withholding_taxes").document(tax_id).get()
    
    if not doc.exists or doc.to_dict().get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="باجی دەستبەسەر نەدۆزرایەوە")
    
    return {"id": doc.id, **doc.to_dict()}


@router.put("/withholding/{tax_id}")
def update_withholding_tax(tax_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Update withholding tax configuration"""
    from app.firebase_client import get_db
    db = get_db()
    doc_ref = db.collection("withholding_taxes").document(tax_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="باجی دەستبەسەر نەدۆزرایەوە")
    
    update_data = {
        "name": data.get("name"),
        "name_ku": data.get("name_ku"),
        "rate": float(data.get("rate", 0)),
        "account_id": data.get("account_id"),
        "applies_to": data.get("applies_to", "vendor"),
    }
    
    # Remove None values
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    doc_ref.update(update_data)
    return {"id": tax_id, **doc.to_dict(), **update_data}


@router.delete("/withholding/{tax_id}")
def delete_withholding_tax(tax_id: str, user: dict = Depends(get_current_user)):
    """Delete (deactivate) withholding tax"""
    from app.firebase_client import get_db
    db = get_db()
    doc_ref = db.collection("withholding_taxes").document(tax_id)
    doc = doc_ref.get()
    
    if not doc.exists or doc.to_dict().get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="باجی دەستبەسەر نەدۆزرایەوە")
    
    doc_ref.update({"is_active": False})
    return {"success": True, "message": "باجی دەستبەسەر سڕایەوە"}
