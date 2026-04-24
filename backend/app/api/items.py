import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.items import ItemRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.schemas.schemas import ItemCreate, ItemUpdate, ItemResponse

router = APIRouter(prefix="/api/items", tags=["Items"])


@router.get("")
def list_items(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    search: str = Query("", max_length=200),
    item_type: str = Query("", max_length=20),
    user: dict = Depends(get_current_user),
):
    repo = ItemRepository(user["org_id"])
    
    filters = [{"field": "is_active", "op": "!=", "value": False}]
    if item_type:
        filters.append({"field": "item_type", "op": "==", "value": item_type})
    
    items, total = repo.list(
        filters=filters,
        order_by="name",
        order_dir="ASCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    
    # Client-side text filtering for search
    if search:
        search_lower = search.lower()
        items = [
            i for i in items
            if search_lower in (i.get("name", "") or "").lower()
            or search_lower in (i.get("sku", "") or "").lower()
            or search_lower in (i.get("description", "") or "").lower()
        ]
        total = len(items)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("", status_code=201, dependencies=[Depends(require_perm("items.create"))])
def create_item(
    data: ItemCreate,
    user: dict = Depends(get_current_user),
):
    repo = ItemRepository(user["org_id"])
    item = repo.create({"id": str(uuid.uuid4()), **data.model_dump()})
    return item


@router.get("/{item_id}")
def get_item(item_id: str, user: dict = Depends(get_current_user)):
    repo = ItemRepository(user["org_id"])
    item = repo.get(item_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="کاڵا نەدۆزرایەوە")
    return item


@router.put("/{item_id}", dependencies=[Depends(require_perm("items.update"))])
def update_item(item_id: str, data: ItemUpdate, user: dict = Depends(get_current_user)):
    repo = ItemRepository(user["org_id"])
    item = repo.get(item_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="کاڵا نەدۆزرایەوە")

    update_data = data.model_dump(exclude_unset=True)
    item = repo.update(item_id, update_data)
    return item


@router.delete("/{item_id}", dependencies=[Depends(require_perm("items.delete"))])
def delete_item(item_id: str, user: dict = Depends(get_current_user)):
    repo = ItemRepository(user["org_id"])
    item = repo.get(item_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="کاڵا نەدۆزرایەوە")

    repo.update(item_id, {"is_active": False})
    return {"message": "کاڵا سڕایەوە", "success": True}


# ==================== BARCODE SCANNING ====================

@router.get("/barcode/{barcode}")
def lookup_item_by_barcode(barcode: str, user: dict = Depends(get_current_user)):
    """Lookup item by barcode or SKU"""
    repo = ItemRepository(user["org_id"])
    
    # Search for items matching barcode or SKU
    all_items, _ = repo.list(limit=1000)
    
    for item in all_items:
        if item.get("sku") == barcode or item.get("barcode") == barcode:
            return item
    
    raise HTTPException(status_code=404, detail="کاڵایەک بەم بارکۆدە نەدۆزرایەوە")


@router.post("/{item_id}/barcode")
def generate_barcode_image(item_id: str, user: dict = Depends(get_current_user)):
    """Generate QR code barcode image for an item"""
    import qrcode
    import io
    import base64
    
    repo = ItemRepository(user["org_id"])
    item = repo.get(item_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="کاڵا نەدۆزرایەوە")
    
    # Use SKU or barcode field, fallback to item_id
    barcode_value = item.get("sku") or item.get("barcode") or item_id
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(barcode_value)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return {
        "item_id": item_id,
        "barcode_value": barcode_value,
        "image_base64": img_base64,
        "image_data_url": f"data:image/png;base64,{img_base64}"
    }
