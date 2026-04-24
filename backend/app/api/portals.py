import uuid
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.system import PortalTokenRepository
from app.firestore.contacts import ContactRepository
from app.firestore.invoices import InvoiceRepository
from app.firestore.bills import BillRepository, PurchaseOrderRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/portals", tags=["Portals"])

@router.post("/generate-link")
def generate_portal_link(data: dict, user: dict = Depends(get_current_user)):
    repo = PortalTokenRepository(user["org_id"])
    token = secrets.token_urlsafe(32)
    repo.create({
        "id": str(uuid.uuid4()),
        "contact_id": data["contact_id"],
        "portal_type": data.get("portal_type", "customer"),
        "token": token,
        "expires_at": datetime.utcnow() + timedelta(days=data.get("expires_days", 30)),
        "is_active": True,
    })
    return {"token": token, "url": f"/portal/{token}"}

@router.get("/customer/{token}")
def customer_portal(token: str):
    repo = PortalTokenRepository("system")
    # Find token across all orgs
    docs = repo.collection.where("token", "==", token) \
        .where("is_active", "==", True).limit(1).stream()
    portal = None
    for doc in docs:
        portal = {"id": doc.id, **doc.to_dict()}
    if not portal: raise HTTPException(404, "Invalid portal link")
    if portal.get("expires_at") and portal["expires_at"] < datetime.utcnow():
        raise HTTPException(410, "Portal link expired")
    
    org_id = portal["org_id"]
    contact_id = portal["contact_id"]
    contact_repo = ContactRepository(org_id)
    contact = contact_repo.get(contact_id)
    inv_repo = InvoiceRepository(org_id)
    invoices, _ = inv_repo.list(
        filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
        order_by="date", limit=50
    )
    return {
        "contact": {"id": contact.get("id"), "name": contact.get("display_name")} if contact else None,
        "invoices": invoices,
    }

@router.get("/vendor/{token}")
def vendor_portal(token: str):
    repo = PortalTokenRepository("system")
    docs = repo.collection.where("token", "==", token) \
        .where("is_active", "==", True).limit(1).stream()
    portal = None
    for doc in docs:
        portal = {"id": doc.id, **doc.to_dict()}
    if not portal: raise HTTPException(404, "Invalid portal link")
    
    org_id = portal["org_id"]
    contact_id = portal["contact_id"]
    contact_repo = ContactRepository(org_id)
    contact = contact_repo.get(contact_id)
    po_repo = PurchaseOrderRepository(org_id)
    pos, _ = po_repo.list(
        filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
        order_by="date", limit=50
    )
    bill_repo = BillRepository(org_id)
    bills, _ = bill_repo.list(
        filters=[{"field": "contact_id", "op": "==", "value": contact_id}],
        order_by="date", limit=50
    )
    return {
        "contact": {"id": contact.get("id"), "name": contact.get("display_name")} if contact else None,
        "purchase_orders": pos,
        "bills": bills,
    }

@router.post("/portals/{token}/deactivate")
def deactivate_portal(token: str, user: dict = Depends(get_current_user)):
    repo = PortalTokenRepository(user["org_id"])
    docs = list(repo.collection.where("token", "==", token).where("org_id", "==", user["org_id"]).limit(1).stream())
    if not docs: raise HTTPException(404)
    repo.update(docs[0].id, {"is_active": False})
    return {"success": True}
