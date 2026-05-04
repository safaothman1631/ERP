"""Sprint 24: E-commerce Module (FIX-361..380).

Online product catalog + shopping cart + checkout → creates Sales Order.
Public catalog endpoints (no auth) plus authenticated cart/order management.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

from app.firestore.ecommerce import (
    EcomItemRepository,
    EcomCartRepository,
    EcomOrderRepository,
)
from app.firestore.items import ItemRepository
from app.firestore.invoices import SalesOrderRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services import settings_service

router = APIRouter(prefix="/api/ecommerce", tags=["E-commerce"])


# ──────────────────────────── Schemas ────────────────────────────

class EcomProductCreate(BaseModel):
    product_id: str           # link to inventory product
    public: bool = True
    online_name: Optional[str] = None
    description_html: Optional[str] = None
    online_price: Optional[float] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    sort_order: int = 0


class EcomProductUpdate(BaseModel):
    public: Optional[bool] = None
    online_name: Optional[str] = None
    description_html: Optional[str] = None
    online_price: Optional[float] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None


class CartLine(BaseModel):
    product_id: str
    quantity: float = 1


class CheckoutRequest(BaseModel):
    customer_id: str
    customer_email: Optional[str] = None
    shipping_address: Optional[dict] = None


# ──────────────────────────── Catalog (public-ish) ────────────────────────────

@router.get("/products")
def list_ecom_products(category: Optional[str] = None,
                        org_id: Optional[str] = Header(None, alias="X-Org-Id"),
                        user: Optional[dict] = Depends(get_current_user)):
    org = (user and user.get("org_id")) or org_id
    if not org:
        raise HTTPException(400, "org_id required (login or X-Org-Id header)")
    repo = EcomItemRepository(org)
    filters = [{"field": "public", "op": "==", "value": True}]
    if category:
        filters.append({"field": "category", "op": "==", "value": category})
    items, total = repo.list(filters=filters, limit=500, order_by="sort_order")
    return {"items": items, "total": total}


@router.post("/products", status_code=201,
             dependencies=[Depends(require_perm("settings.update"))])
def create_ecom_product(data: EcomProductCreate, user: dict = Depends(get_current_user)):
    # Check if storefront is enabled
    try:
        cfg = settings_service.get_bag(user["org_id"], "ecommerce")
    except Exception:
        cfg = {}
    
    if not cfg.get("storefront_enabled", True):
        raise HTTPException(403, "E-commerce storefront is disabled")
    
    repo = EcomItemRepository(user["org_id"])
    # Validate underlying product exists
    base = ItemRepository(user["org_id"]).get(data.product_id)
    if not base:
        raise HTTPException(404, "underlying product not found")
    payload = data.model_dump()
    if payload.get("online_name") is None:
        payload["online_name"] = base.get("name")
    if payload.get("online_price") is None:
        payload["online_price"] = base.get("price") or base.get("sale_price") or 0
    return repo.create(payload)


@router.put("/products/{ep_id}", dependencies=[Depends(require_perm("settings.update"))])
def update_ecom_product(ep_id: str, data: EcomProductUpdate,
                        user: dict = Depends(get_current_user)):
    repo = EcomItemRepository(user["org_id"])
    if not repo.get(ep_id):
        raise HTTPException(404, "product not found")
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    return repo.update(ep_id, payload)


@router.delete("/products/{ep_id}", dependencies=[Depends(require_perm("settings.update"))])
def delete_ecom_product(ep_id: str, user: dict = Depends(get_current_user)):
    repo = EcomItemRepository(user["org_id"])
    if not repo.get(ep_id):
        raise HTTPException(404, "product not found")
    repo.delete(ep_id)
    return {"deleted": True}


# ──────────────────────────── Carts ────────────────────────────

@router.post("/carts", status_code=201)
def create_cart(user: dict = Depends(get_current_user)):
    repo = EcomCartRepository(user["org_id"])
    return repo.create({"user_id": user["id"], "lines": [], "status": "open"})


@router.get("/carts/{cart_id}")
def get_cart(cart_id: str, user: dict = Depends(get_current_user)):
    item = EcomCartRepository(user["org_id"]).get(cart_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "cart not found")
    return item


@router.post("/carts/{cart_id}/lines")
def add_cart_line(cart_id: str, line: CartLine, user: dict = Depends(get_current_user)):
    repo = EcomCartRepository(user["org_id"])
    cart = repo.get(cart_id)
    if not cart or cart.get("org_id") != user["org_id"]:
        raise HTTPException(404, "cart not found")
    if cart.get("status") != "open":
        raise HTTPException(400, "cart is not open")
    lines = list(cart.get("lines") or [])
    # Merge existing line for same product
    for ln in lines:
        if ln.get("product_id") == line.product_id:
            ln["quantity"] = float(ln.get("quantity") or 0) + float(line.quantity)
            return repo.update(cart_id, {"lines": lines})
    lines.append({"product_id": line.product_id, "quantity": float(line.quantity)})
    return repo.update(cart_id, {"lines": lines})


@router.delete("/carts/{cart_id}/lines/{product_id}")
def remove_cart_line(cart_id: str, product_id: str, user: dict = Depends(get_current_user)):
    repo = EcomCartRepository(user["org_id"])
    cart = repo.get(cart_id)
    if not cart or cart.get("org_id") != user["org_id"]:
        raise HTTPException(404, "cart not found")
    lines = [ln for ln in (cart.get("lines") or []) if ln.get("product_id") != product_id]
    return repo.update(cart_id, {"lines": lines})


@router.post("/carts/{cart_id}/checkout", status_code=201)
def checkout_cart(cart_id: str, data: CheckoutRequest, user: dict = Depends(get_current_user)):
    """Convert cart → SalesOrder (draft) and EcomOrder record."""
    org = user["org_id"]
    cart_repo = EcomCartRepository(org)
    cart = cart_repo.get(cart_id)
    if not cart or cart.get("org_id") != org:
        raise HTTPException(404, "cart not found")
    if cart.get("status") != "open":
        raise HTTPException(400, "cart not open")
    lines = cart.get("lines") or []
    if not lines:
        raise HTTPException(400, "cart is empty")

    # Build SO lines from product prices
    product_repo = ItemRepository(org)
    so_lines = []
    total = 0.0
    for ln in lines:
        prod = product_repo.get(ln["product_id"])
        if not prod:
            raise HTTPException(400, f"product {ln['product_id']} not found")
        price = float(prod.get("price") or prod.get("sale_price") or 0)
        qty = float(ln.get("quantity") or 0)
        amt = price * qty
        total += amt
        so_lines.append({
            "product_id": ln["product_id"],
            "description": prod.get("name"),
            "quantity": qty,
            "unit_price": price,
            "amount": amt,
        })

    so = SalesOrderRepository(org).create({
        "customer_id": data.customer_id,
        "order_date": datetime.utcnow().date().isoformat(),
        "status": "draft",
        "source": "ecommerce",
        "lines": so_lines,
        "subtotal": total,
        "total": total,
    })

    ecom_order = EcomOrderRepository(org).create({
        "cart_id": cart_id,
        "sales_order_id": so["id"],
        "customer_id": data.customer_id,
        "customer_email": data.customer_email,
        "shipping_address": data.shipping_address,
        "total": total,
        "status": "submitted",
    })
    cart_repo.update(cart_id, {"status": "checked_out", "checked_out_at": datetime.utcnow().isoformat()})
    return {"ecom_order": ecom_order, "sales_order_id": so["id"]}


@router.get("/orders")
def list_ecom_orders(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    repo = EcomOrderRepository(user["org_id"])
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters or None, limit=500,
                              order_by="created_at", order_dir="DESCENDING")
    return {"items": items, "total": total}
