import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.bills import VendorCreditRepository
from app.firestore.system import SequenceRepository
from app.services.auth import get_current_user
from app.schemas.schemas import VendorCreditCreate, VendorCreditResponse

router = APIRouter(prefix="/api/vendor-credits", tags=["Vendor Credits"])

@router.get("")
def list_vendor_credits(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    status: str = Query("", max_length=20),
    user: dict = Depends(get_current_user),
):
    repo = VendorCreditRepository(user["org_id"])
    filters = [{"field": "status", "op": "==", "value": status}] if status else []
    items, total = repo.list(filters=filters, order_by="date", order_dir="DESCENDING", limit=page_size, offset=(page-1)*page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size, "total_pages": (total+page_size-1)//page_size}

@router.post("", status_code=201)
def create_vendor_credit(data: VendorCreditCreate, user: dict = Depends(get_current_user)):
    from app.services.numbering_service import get_next_number
    
    # Get branch_id from request or user default
    branch_id = getattr(data, 'branch_id', None) or user.get('default_branch_id')
    
    # Generate credit number if not provided
    auto_numbered = False
    if hasattr(data, 'credit_number') and data.credit_number:
        number = data.credit_number
    else:
        number = get_next_number(user["org_id"], branch_id, "vendor_credit", "VC")
        auto_numbered = True
    
    repo = VendorCreditRepository(user["org_id"])
    item = repo.create({"id": str(uuid.uuid4()), "credit_number": number, "auto_numbered": auto_numbered, **data.model_dump(exclude={"lines"})} )
    if hasattr(data, "lines") and data.lines:
        repo.set_lines(item["id"], [line.model_dump() for line in data.lines])
    return item

# FIX-109: was @router.get("/{{vendor_credit_id}}") — double-brace bug
@router.get("/{vendor_credit_id}")
def get_vendor_credit(vendor_credit_id: str, user: dict = Depends(get_current_user)):
    repo = VendorCreditRepository(user["org_id"])
    item = repo.get(vendor_credit_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="قەرزی فرۆشیار نەدۆزرایەوە")
    return item


@router.post("/{vendor_credit_id}/approve")
def approve_vendor_credit(vendor_credit_id: str, user: dict = Depends(get_current_user)):
    """Approve a draft vendor credit: status draft -> open."""
    from datetime import datetime as _dt
    repo = VendorCreditRepository(user["org_id"])
    item = repo.get(vendor_credit_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="قەرزی فرۆشیار نەدۆزرایەوە")
    if item.get("status") not in ("draft", None, ""):
        raise HTTPException(status_code=400, detail=f"تەنها draft دەستوور دەدرێت (دۆخی ئێستا: {item.get('status')})")
    return repo.update(vendor_credit_id, {
        "status": "open",
        "approved_at": _dt.utcnow().isoformat(),
        "approved_by": user.get("id"),
    })
