import uuid
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from app.firestore.system import PaymentLinkRepository
from app.firestore.invoices import InvoiceRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/payment-links", tags=["Payment Links"])

@router.get("")
def list_links(user: dict = Depends(get_current_user)):
    repo = PaymentLinkRepository(user["org_id"])
    items, _ = repo.list(order_by="created_at", limit=100)
    return items

@router.post("", status_code=201)
def create_link(data: dict, user: dict = Depends(get_current_user)):
    repo = PaymentLinkRepository(user["org_id"])
    link_token = secrets.token_urlsafe(24)
    return repo.create({
        "id": str(uuid.uuid4()),
        "invoice_id": data.get("invoice_id"),
        "amount": data.get("amount", 0),
        "description": data.get("description", ""),
        "token": link_token,
        "url": f"/pay/{link_token}",
        "expires_at": datetime.utcnow() + timedelta(days=data.get("expires_days", 7)),
        "is_active": True,
        "is_paid": False,
    })

@router.get("/verify/{token}")
def verify_link(token: str):
    repo = PaymentLinkRepository("system")
    docs = list(repo.collection.where("token", "==", token).where("is_active", "==", True).limit(1).stream())
    if not docs: raise HTTPException(404, "Invalid payment link")
    link = {"id": docs[0].id, **docs[0].to_dict()}
    if link.get("expires_at") and link["expires_at"] < datetime.utcnow():
        raise HTTPException(410, "Payment link expired")
    return {"amount": link["amount"], "description": link["description"]}

@router.post("/pay/{token}")
def process_payment(token: str, data: dict):
    repo = PaymentLinkRepository("system")
    docs = list(repo.collection.where("token", "==", token).where("is_active", "==", True).limit(1).stream())
    if not docs: raise HTTPException(404)
    link = {"id": docs[0].id, **docs[0].to_dict()}
    repo.update(link["id"], {"is_paid": True, "paid_at": datetime.utcnow(), "is_active": False})
    return {"success": True, "message": "Payment recorded"}

@router.delete("/{link_id}")
def delete_link(link_id: str, user: dict = Depends(get_current_user)):
    repo = PaymentLinkRepository(user["org_id"])
    if not repo.get(link_id):
        raise HTTPException(404)
    repo.delete(link_id)
    return {"success": True}
