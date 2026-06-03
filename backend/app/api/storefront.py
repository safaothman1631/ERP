"""Wave E: Public Storefront + Customer Portal.

Public endpoints (no auth) for browsing products, managing cart, checkout.
Portal endpoints (magic-link JWT auth) for customer self-service.
"""
from datetime import datetime, timedelta
from typing import Optional
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr
from jose import jwt, JWTError

from app.firestore.items import ItemRepository
from app.firestore.contacts import ContactRepository
from app.firestore.invoices import SalesOrderRepository, InvoiceRepository
from app.firestore.ecommerce import EcomCartRepository
from app.firestore.bills import BillRepository, PurchaseOrderRepository, PaymentMadeRepository
from app.config import get_settings

router = APIRouter(tags=["Storefront"])

settings = get_settings()

# ──────────────────────────── Schemas ────────────────────────────

class CartItemSchema(BaseModel):
    item_id: str
    quantity: float = 1


class CheckoutSchema(BaseModel):
    customer_name: str
    customer_email: EmailStr
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    payment_method: str = "cash"


class PortalLinkRequest(BaseModel):
    email: EmailStr


class PortalVerifyRequest(BaseModel):
    token: str


# ──────────────────────────── Helpers ────────────────────────────

def get_default_org() -> str:
    """Return first org from system or fallback org_id. For storefront demo."""
    # In production, you'd read from system settings or subdomain mapping
    return "0487e3e8-60e9-4824-b288-c0042f48b078"  # default test org


def create_portal_jwt(email: str, org_id: str, expires_delta: timedelta = timedelta(hours=24)) -> str:
    """Generate short-lived JWT for customer portal access."""
    expire = datetime.utcnow() + expires_delta
    payload = {
        "sub": email,
        "org_id": org_id,
        "type": "portal",
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_portal_jwt(token: str) -> dict:
    """Verify and decode portal JWT. Raise HTTPException if invalid."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "portal":
            raise HTTPException(401, "Invalid token type")
        return payload
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")


async def get_portal_user(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency to extract portal user from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    token = authorization.split(" ")[1]
    return verify_portal_jwt(token)


# ──────────────────────────── Public Storefront ────────────────────────────

@router.get("/api/storefront/products")
def list_storefront_products(
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    """Public product catalog. Returns active items (online_visible=True or is_active)."""
    org = org_id or get_default_org()
    repo = ItemRepository(org)
    all_items, _ = repo.list(filters=None, limit=500, order_by="name")
    
    # Filter in Python: is_active items (treat as online_visible)
    items = [i for i in all_items if i.get("is_active") is not False]
    
    # Category filter
    if category:
        items = [i for i in items if i.get("category") == category]
    
    # Search filter
    if search:
        search_lower = search.lower()
        items = [
            i for i in items
            if search_lower in (i.get("name") or "").lower()
            or search_lower in (i.get("sku") or "").lower()
            or search_lower in (i.get("description") or "").lower()
        ]
    
    # Limit
    items = items[:limit]
    
    return {"items": items, "total": len(items)}


@router.get("/api/storefront/products/{item_id}")
def get_storefront_product(
    item_id: str,
    org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    """Get single product detail."""
    org = org_id or get_default_org()
    repo = ItemRepository(org)
    item = repo.get(item_id)
    if not item or item.get("is_active") is False:
        raise HTTPException(404, "Product not found or inactive")
    return item


@router.get("/api/storefront/categories")
def list_storefront_categories(
    org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    """Return unique category list from active items."""
    org = org_id or get_default_org()
    repo = ItemRepository(org)
    all_items, _ = repo.list(filters=None, limit=1000)
    categories = set()
    for item in all_items:
        if item.get("is_active") is not False and item.get("category"):
            categories.add(item["category"])
    return {"categories": sorted(list(categories))}


# ──────────────────────────── Cart (Anonymous) ────────────────────────────

@router.post("/api/storefront/cart", status_code=201)
def create_or_get_cart(
    data: dict,
    org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    """Create or retrieve cart by session_id (anonymous shopping).
    Body: {session_id: str, items?: [{item_id, quantity}]}
    """
    org = org_id or get_default_org()
    session_id = data.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id required")
    
    repo = EcomCartRepository(org)
    # Try to find existing cart
    existing, _ = repo.list(filters=[{"field": "session_id", "op": "==", "value": session_id}], limit=1)
    if existing:
        return existing[0]
    
    # Create new cart
    cart = repo.create({
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "status": "open",
        "lines": data.get("items") or [],
        "created_at": datetime.utcnow().isoformat(),
    })
    return cart


@router.put("/api/storefront/cart/{cart_id}")
def update_storefront_cart(
    cart_id: str,
    data: dict,
    org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    """Update cart items. Body: {items: [{item_id, quantity}]}"""
    org = org_id or get_default_org()
    repo = EcomCartRepository(org)
    cart = repo.get(cart_id)
    if not cart:
        raise HTTPException(404, "Cart not found")
    
    updated = repo.update(cart_id, {"lines": data.get("items") or []})
    return updated


@router.post("/api/storefront/cart/{cart_id}/checkout", status_code=201)
def storefront_checkout(
    cart_id: str,
    data: CheckoutSchema,
    org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    """Checkout: create Contact (if new), create SalesOrder, return order_id."""
    org = org_id or get_default_org()
    cart_repo = EcomCartRepository(org)
    cart = cart_repo.get(cart_id)
    if not cart or cart.get("status") != "open":
        raise HTTPException(400, "Cart not available")
    
    lines = cart.get("lines") or []
    if not lines:
        raise HTTPException(400, "Cart is empty")
    
    # Find or create contact
    contact_repo = ContactRepository(org)
    contacts, _ = contact_repo.list(
        filters=[{"field": "email", "op": "==", "value": data.customer_email}],
        limit=1
    )
    if contacts:
        contact = contacts[0]
    else:
        contact = contact_repo.create({
            "id": str(uuid.uuid4()),
            "display_name": data.customer_name,
            "email": data.customer_email,
            "phone": data.customer_phone,
            "address": data.customer_address,
            "contact_type": "customer",
        })
    
    # Build SO lines
    item_repo = ItemRepository(org)
    so_lines = []
    subtotal = 0.0
    for ln in lines:
        item = item_repo.get(ln["item_id"])
        if not item:
            continue
        price = float(item.get("price") or item.get("sale_price") or 0)
        qty = float(ln.get("quantity") or 1)
        amt = price * qty
        subtotal += amt
        so_lines.append({
            "product_id": ln["item_id"],
            "description": item.get("name"),
            "quantity": qty,
            "unit_price": price,
            "amount": amt,
        })
    
    # Create SalesOrder
    so_repo = SalesOrderRepository(org)
    so = so_repo.create({
        "id": str(uuid.uuid4()),
        "customer_id": contact["id"],
        "order_date": datetime.utcnow().date().isoformat(),
        "status": "draft",
        "source": "storefront",
        "lines": so_lines,
        "subtotal": subtotal,
        "total": subtotal,
        "payment_method": data.payment_method,
    })
    
    # Mark cart as checked_out
    cart_repo.update(cart_id, {"status": "checked_out", "order_id": so["id"]})
    
    return {
        "order_id": so["id"],
        "customer_email": data.customer_email,
        "total": subtotal,
    }


@router.get("/api/storefront/orders/{order_id}/status")
def storefront_order_status(
    order_id: str,
    email: str,
    org_id: Optional[str] = Header(None, alias="X-Org-Id"),
):
    """Public order tracking by order_id + email verification."""
    org = org_id or get_default_org()
    so_repo = SalesOrderRepository(org)
    so = so_repo.get(order_id)
    if not so:
        raise HTTPException(404, "Order not found")
    
    # Verify email matches customer
    contact_repo = ContactRepository(org)
    contact = contact_repo.get(so.get("customer_id"))
    if not contact or contact.get("email") != email:
        raise HTTPException(403, "Email does not match order")
    
    return {
        "id": so.get("id"),
        "status": so.get("status"),
        "order_date": so.get("order_date"),
        "total": so.get("total"),
        "customer_name": contact.get("display_name"),
    }


# ──────────────────────────── Portal (Magic Link + JWT) ────────────────────────────

# Store magic tokens in memory for demo (production: use Firestore collection)
_magic_tokens: dict[str, dict] = {}


@router.post("/api/portal/request-link")
def portal_request_link(data: PortalLinkRequest):
    """Request a customer-portal magic link.

    SECURITY: the token is delivered out-of-band (email) and is NEVER returned in
    the HTTP response. Returning it (the previous "demo" behaviour) let anyone who
    knew a customer's email mint a portal session — account takeover. The response
    is also always a generic 200 so the endpoint can't enumerate which emails are
    customers.
    """
    org = get_default_org()
    contact_repo = ContactRepository(org)
    contacts, _ = contact_repo.list(
        filters=[{"field": "email", "op": "==", "value": data.email}],
        limit=1
    )
    if contacts:
        contact = contacts[0]
        token = secrets.token_urlsafe(32)
        _magic_tokens[token] = {
            "email": data.email,
            "org_id": org,
            "contact_id": contact["id"],
            "expires_at": datetime.utcnow() + timedelta(minutes=15),
        }
        verify_path = f"/portal/verify?token={token}"
        # Delivered by email in production. Logged server-side (not returned) so
        # operators/dev can retrieve it until the portal email channel is wired.
        try:
            import logging
            logging.getLogger("storefront").info(
                "portal.magic_link issued for %s -> %s", data.email, verify_path
            )
        except Exception:
            pass
        # TODO(prod): email `verify_path` to data.email via the org SMTP pipeline
        # (see auth.py:_send_reset_email for the pattern).
    return {"message": "If an account exists for this email, a sign-in link has been sent."}


@router.post("/api/portal/verify-link")
def portal_verify_link(data: PortalVerifyRequest):
    """Verify magic token and return portal JWT."""
    token_data = _magic_tokens.get(data.token)
    if not token_data:
        raise HTTPException(404, "Invalid or expired token")
    
    if token_data["expires_at"] < datetime.utcnow():
        del _magic_tokens[data.token]
        raise HTTPException(410, "Token expired")
    
    # Remove token (one-time use)
    del _magic_tokens[data.token]
    
    # Generate JWT
    portal_jwt = create_portal_jwt(token_data["email"], token_data["org_id"])
    
    return {
        "portal_jwt": portal_jwt,
        "email": token_data["email"],
    }


@router.get("/api/portal/me/invoices")
def portal_list_invoices(user: dict = Depends(get_portal_user)):
    """List invoices for logged-in portal user."""
    org_id = user["org_id"]
    email = user["sub"]
    
    # Find contact by email
    contact_repo = ContactRepository(org_id)
    contacts, _ = contact_repo.list(filters=[{"field": "email", "op": "==", "value": email}], limit=1)
    if not contacts:
        return {"invoices": [], "total": 0}
    
    contact_id = contacts[0]["id"]
    inv_repo = InvoiceRepository(org_id)
    invoices, total = inv_repo.list(
        filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
        order_by="date",
        order_dir="DESCENDING",
        limit=100
    )
    return {"invoices": invoices, "total": total}


@router.get("/api/portal/me/orders")
def portal_list_orders(user: dict = Depends(get_portal_user)):
    """List sales orders for logged-in portal user."""
    org_id = user["org_id"]
    email = user["sub"]
    
    contact_repo = ContactRepository(org_id)
    contacts, _ = contact_repo.list(filters=[{"field": "email", "op": "==", "value": email}], limit=1)
    if not contacts:
        return {"orders": [], "total": 0}
    
    contact_id = contacts[0]["id"]
    so_repo = SalesOrderRepository(org_id)
    orders, total = so_repo.list(
        filters=[{"field": "customer_id", "op": "==", "value": contact_id}],
        order_by="order_date",
        order_dir="DESCENDING",
        limit=100
    )
    return {"orders": orders, "total": total}


@router.get("/api/portal/me/payments")
def portal_list_payments(user: dict = Depends(get_portal_user)):
    """List payments for logged-in portal user."""
    # Placeholder: would query payments collection filtered by contact_id
    return {"payments": [], "total": 0, "message": "Payments tracking coming soon"}


@router.get("/api/portal/me/statements")
def portal_statements(user: dict = Depends(get_portal_user)):
    """Customer statement summary."""
    org_id = user["org_id"]
    email = user["sub"]
    
    contact_repo = ContactRepository(org_id)
    contacts, _ = contact_repo.list(filters=[{"field": "email", "op": "==", "value": email}], limit=1)
    if not contacts:
        return {"total_due": 0, "overdue": 0, "recent_invoices": []}
    
    contact_id = contacts[0]["id"]
    inv_repo = InvoiceRepository(org_id)
    invoices, _ = inv_repo.list(
        filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
        limit=100
    )
    
    total_due = sum(float(inv.get("balance") or 0) for inv in invoices)
    overdue = sum(
        float(inv.get("balance") or 0) for inv in invoices
        if inv.get("status") == "overdue"
    )
    
    return {
        "contact_name": contacts[0].get("display_name"),
        "total_due": total_due,
        "overdue": overdue,
        "recent_invoices": invoices[:5],
    }


# ──────────────────────────── Vendor Portal (Magic Link + JWT) ────────────────────────────

# Vendor magic tokens (separate from customer tokens)
_vendor_magic_tokens: dict[str, dict] = {}


def create_vendor_jwt(email: str, org_id: str, contact_id: str, expires_delta: timedelta = timedelta(hours=24)) -> str:
    """Generate short-lived JWT for vendor portal access."""
    expire = datetime.utcnow() + expires_delta
    payload = {
        "sub": email,
        "org_id": org_id,
        "contact_id": contact_id,
        "type": "vendor_portal",
        "role": "vendor",
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_vendor_jwt(token: str) -> dict:
    """Verify and decode vendor portal JWT. Raise HTTPException if invalid."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "vendor_portal":
            raise HTTPException(401, "Invalid token type")
        return payload
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")


async def get_vendor_user(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency to extract vendor user from Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    token = authorization.split(" ")[1]
    return verify_vendor_jwt(token)


@router.post("/api/vendor-portal/request-link")
def vendor_portal_request_link(data: PortalLinkRequest):
    """Request magic link by vendor email. In production, send email. For demo, return token."""
    org = get_default_org()
    contact_repo = ContactRepository(org)
    contacts, _ = contact_repo.list(
        filters=[{"field": "email", "op": "==", "value": data.email}],
        limit=1
    )
    if not contacts:
        raise HTTPException(404, "No vendor found with this email")
    
    contact = contacts[0]
    # Check if contact is a vendor
    if contact.get("contact_type") != "vendor":
        raise HTTPException(403, "This email is not registered as a vendor")
    
    token = secrets.token_urlsafe(32)
    _vendor_magic_tokens[token] = {
        "email": data.email,
        "org_id": org,
        "contact_id": contact["id"],
        "expires_at": datetime.utcnow() + timedelta(minutes=15),
    }
    
    return {
        "message": "Vendor magic link sent (demo: token returned)",
        "token": token,
        "verify_url": f"/vendor-portal/verify?token={token}",
    }


@router.post("/api/vendor-portal/verify-link")
def vendor_portal_verify_link(data: PortalVerifyRequest):
    """Verify vendor magic token and return vendor JWT."""
    token_data = _vendor_magic_tokens.get(data.token)
    if not token_data:
        raise HTTPException(404, "Invalid or expired token")
    
    if token_data["expires_at"] < datetime.utcnow():
        del _vendor_magic_tokens[data.token]
        raise HTTPException(410, "Token expired")
    
    # Remove token (one-time use)
    del _vendor_magic_tokens[data.token]
    
    # Generate vendor JWT
    vendor_jwt = create_vendor_jwt(
        token_data["email"],
        token_data["org_id"],
        token_data["contact_id"]
    )
    
    return {
        "vendor_jwt": vendor_jwt,
        "email": token_data["email"],
        "contact_id": token_data["contact_id"],
    }


@router.get("/api/vendor-portal/me/profile")
def vendor_portal_profile(user: dict = Depends(get_vendor_user)):
    """Get vendor profile information."""
    org_id = user["org_id"]
    contact_id = user["contact_id"]
    
    contact_repo = ContactRepository(org_id)
    contact = contact_repo.get(contact_id)
    if not contact:
        raise HTTPException(404, "Vendor profile not found")
    
    return {
        "id": contact.get("id"),
        "display_name": contact.get("display_name"),
        "email": contact.get("email"),
        "phone": contact.get("phone"),
        "address": contact.get("address"),
        "contact_type": contact.get("contact_type"),
    }


@router.get("/api/vendor-portal/me/purchase-orders")
def vendor_portal_list_pos(
    status: Optional[str] = None,
    user: dict = Depends(get_vendor_user)
):
    """List purchase orders for this vendor. Filter by status: open|received|all."""
    org_id = user["org_id"]
    contact_id = user["contact_id"]
    
    po_repo = PurchaseOrderRepository(org_id)
    all_pos, _ = po_repo.list(limit=500)
    
    # Filter by vendor (contact_id field in PO)
    vendor_pos = [po for po in all_pos if po.get("contact_id") == contact_id or po.get("vendor_id") == contact_id]
    
    # Status filter
    if status and status != "all":
        vendor_pos = [po for po in vendor_pos if po.get("status") == status]
    
    # Sort by date desc
    vendor_pos.sort(key=lambda x: x.get("date") or "", reverse=True)
    
    return {"purchase_orders": vendor_pos, "total": len(vendor_pos)}


@router.get("/api/vendor-portal/me/purchase-orders/{po_id}")
def vendor_portal_get_po(
    po_id: str,
    user: dict = Depends(get_vendor_user)
):
    """Get PO detail with line items."""
    org_id = user["org_id"]
    contact_id = user["contact_id"]
    
    po_repo = PurchaseOrderRepository(org_id)
    po = po_repo.get_with_lines(po_id)
    if not po:
        raise HTTPException(404, "Purchase order not found")
    
    # Verify this PO belongs to this vendor
    if po.get("contact_id") != contact_id and po.get("vendor_id") != contact_id:
        raise HTTPException(403, "This purchase order does not belong to you")
    
    return po


class VendorBillSubmitSchema(BaseModel):
    po_id: Optional[str] = None
    bill_number: str
    bill_date: str
    due_date: str
    lines: list[dict]
    notes: Optional[str] = None
    attachments: Optional[list[dict]] = None


@router.post("/api/vendor-portal/me/bills", status_code=201)
def vendor_portal_submit_bill(
    data: VendorBillSubmitSchema,
    user: dict = Depends(get_vendor_user)
):
    """Submit a bill against a PO (or standalone). Status = pending_review."""
    org_id = user["org_id"]
    contact_id = user["contact_id"]
    
    # Calculate totals
    subtotal = sum(
        float(line.get("qty", 0)) * float(line.get("unit_price", 0))
        for line in data.lines
    )
    total_tax = sum(
        float(line.get("qty", 0)) * float(line.get("unit_price", 0)) * float(line.get("tax_rate", 0)) / 100
        for line in data.lines
    )
    total = subtotal + total_tax
    
    bill_repo = BillRepository(org_id)
    bill = bill_repo.create({
        "id": str(uuid.uuid4()),
        "contact_id": contact_id,
        "vendor_id": contact_id,
        "po_id": data.po_id,
        "bill_number": data.bill_number,
        "date": data.bill_date,
        "due_date": data.due_date,
        "status": "pending_review",
        "subtotal": subtotal,
        "tax": total_tax,
        "total": total,
        "balance_due": total,
        "notes": data.notes,
        "attachments": data.attachments or [],
        "lines": data.lines,
        "submitted_by_vendor": True,
        "created_at": datetime.utcnow().isoformat(),
    })
    
    return bill


@router.get("/api/vendor-portal/me/bills")
def vendor_portal_list_bills(
    status: Optional[str] = None,
    user: dict = Depends(get_vendor_user)
):
    """List bills submitted by this vendor."""
    org_id = user["org_id"]
    contact_id = user["contact_id"]
    
    bill_repo = BillRepository(org_id)
    all_bills, _ = bill_repo.list(limit=500)
    
    # Filter by vendor
    vendor_bills = [b for b in all_bills if b.get("contact_id") == contact_id or b.get("vendor_id") == contact_id]
    
    # Status filter
    if status:
        vendor_bills = [b for b in vendor_bills if b.get("status") == status]
    
    # Sort by date desc
    vendor_bills.sort(key=lambda x: x.get("date") or "", reverse=True)
    
    return {"bills": vendor_bills, "total": len(vendor_bills)}


@router.get("/api/vendor-portal/me/payments")
def vendor_portal_list_payments(user: dict = Depends(get_vendor_user)):
    """List payments received for this vendor's bills."""
    org_id = user["org_id"]
    contact_id = user["contact_id"]
    
    # Get vendor bills
    bill_repo = BillRepository(org_id)
    all_bills, _ = bill_repo.list(limit=500)
    vendor_bills = [b for b in all_bills if b.get("contact_id") == contact_id or b.get("vendor_id") == contact_id]
    vendor_bill_ids = {b["id"] for b in vendor_bills}
    
    # Get payments made for these bills
    payment_repo = PaymentMadeRepository(org_id)
    all_payments, _ = payment_repo.list(limit=500)
    
    # Filter payments that reference vendor bills
    vendor_payments = []
    for payment in all_payments:
        bills_paid = payment.get("bills") or []
        if any(bp.get("bill_id") in vendor_bill_ids for bp in bills_paid):
            vendor_payments.append(payment)
    
    # Sort by date desc
    vendor_payments.sort(key=lambda x: x.get("payment_date") or x.get("date") or "", reverse=True)
    
    return {"payments": vendor_payments, "total": len(vendor_payments)}


@router.get("/api/vendor-portal/me/dashboard")
def vendor_portal_dashboard(user: dict = Depends(get_vendor_user)):
    """Vendor dashboard: open POs, bills, payments summary."""
    org_id = user["org_id"]
    contact_id = user["contact_id"]
    
    # POs
    po_repo = PurchaseOrderRepository(org_id)
    all_pos, _ = po_repo.list(limit=500)
    vendor_pos = [po for po in all_pos if po.get("contact_id") == contact_id or po.get("vendor_id") == contact_id]
    open_pos = [po for po in vendor_pos if po.get("status") in ["draft", "approved", "open"]]
    open_pos_value = sum(float(po.get("total") or 0) for po in open_pos)
    
    # Bills
    bill_repo = BillRepository(org_id)
    all_bills, _ = bill_repo.list(limit=500)
    vendor_bills = [b for b in all_bills if b.get("contact_id") == contact_id or b.get("vendor_id") == contact_id]
    pending_bills = [b for b in vendor_bills if b.get("status") == "pending_review"]
    
    # Payments (last 30 days)
    payment_repo = PaymentMadeRepository(org_id)
    all_payments, _ = payment_repo.list(limit=500)
    vendor_bill_ids = {b["id"] for b in vendor_bills}
    
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).date().isoformat()
    recent_payments = []
    for payment in all_payments:
        payment_date = payment.get("payment_date") or payment.get("date") or ""
        if payment_date >= thirty_days_ago:
            bills_paid = payment.get("bills") or []
            if any(bp.get("bill_id") in vendor_bill_ids for bp in bills_paid):
                recent_payments.append(payment)
    
    paid_bills_total_30d = sum(float(p.get("amount") or 0) for p in recent_payments)
    
    # Outstanding balance
    outstanding_balance = sum(float(b.get("balance_due") or 0) for b in vendor_bills if b.get("status") not in ["paid", "void"])
    
    return {
        "open_pos_count": len(open_pos),
        "open_pos_value": round(open_pos_value, 2),
        "pending_bills_count": len(pending_bills),
        "paid_bills_total_30d": round(paid_bills_total_30d, 2),
        "outstanding_balance": round(outstanding_balance, 2),
    }
