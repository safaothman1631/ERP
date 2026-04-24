import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.system import SalesReturnRepository, PurchaseReturnRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/returns", tags=["Returns"])

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
