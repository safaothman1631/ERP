"""Sprint 28: Iraq Payment Gateways (FIB + Zain Cash + Asia Hawala) — FIX-441..460.

Public webhooks (FIB / Zain Cash) are HMAC-SHA256 verified via X-Webhook-Signature.

Provides a unified API for initiating and tracking payments through major Iraqi
payment providers. Network calls are stubbed — provider integration is a
configuration concern handled by the deployer.
"""
import hashlib
import hmac
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.firestore.iraq_payments import IraqPaymentRepository, IraqGatewayConfigRepository
from app.firestore.invoices import InvoiceRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/iraq-payments", tags=["Iraq Payments"])

SUPPORTED_GATEWAYS = {"fib", "zain_cash", "asia_hawala"}


class GatewayConfig(BaseModel):
    gateway: str  # fib | zain_cash | asia_hawala
    merchant_id: str
    api_key: Optional[str] = None
    callback_url: Optional[str] = None
    enabled: bool = True


class PaymentInit(BaseModel):
    gateway: str
    invoice_id: Optional[str] = None
    amount: float
    currency: str = "IQD"
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    description: Optional[str] = None


class PaymentCallback(BaseModel):
    provider_reference: str
    status: str           # success | failed | pending
    raw_payload: Optional[dict] = None


@router.get("/gateways", dependencies=[Depends(require_perm("settings.read"))])
def list_gateways(user: dict = Depends(get_current_user)):
    items, total = IraqGatewayConfigRepository(user["org_id"]).list(limit=50)
    masked = []
    for g in items:
        row = dict(g)
        if row.get("api_key"):
            row["api_key"] = "****"
        masked.append(row)
    return {"items": masked, "total": total, "supported": list(SUPPORTED_GATEWAYS)}


@router.post("/gateways", status_code=201,
             dependencies=[Depends(require_perm("settings.update"))])
def configure_gateway(data: GatewayConfig, user: dict = Depends(get_current_user)):
    if data.gateway not in SUPPORTED_GATEWAYS:
        raise HTTPException(400, f"unsupported gateway. allowed: {sorted(SUPPORTED_GATEWAYS)}")
    repo = IraqGatewayConfigRepository(user["org_id"])
    existing, _ = repo.list(filters=[
        {"field": "gateway", "op": "==", "value": data.gateway},
    ], limit=1)
    if existing:
        return repo.update(existing[0]["id"], data.model_dump())
    return repo.create(data.model_dump())


@router.delete("/gateways/{gw_id}",
               dependencies=[Depends(require_perm("settings.update"))])
def delete_gateway(gw_id: str, user: dict = Depends(get_current_user)):
    repo = IraqGatewayConfigRepository(user["org_id"])
    if not repo.get(gw_id):
        raise HTTPException(404, "gateway not configured")
    repo.delete(gw_id)
    return {"deleted": True}


@router.post("/initiate", status_code=201, dependencies=[Depends(require_perm("invoices.update"))])
def initiate_payment(data: PaymentInit, user: dict = Depends(get_current_user)):
    """Create a pending payment intent. Returns provider reference + redirect_url stub."""
    if data.gateway not in SUPPORTED_GATEWAYS:
        raise HTTPException(400, f"unsupported gateway")
    if data.amount <= 0:
        raise HTTPException(400, "amount must be > 0")

    # Verify gateway is configured + enabled
    cfg_repo = IraqGatewayConfigRepository(user["org_id"])
    cfgs, _ = cfg_repo.list(filters=[
        {"field": "gateway", "op": "==", "value": data.gateway},
    ], limit=1)
    if not cfgs or not cfgs[0].get("enabled"):
        raise HTTPException(400, f"gateway {data.gateway} not configured/enabled")

    # Validate invoice if linked
    if data.invoice_id:
        inv = InvoiceRepository(user["org_id"]).get(data.invoice_id)
        if not inv:
            raise HTTPException(404, "invoice not found")

    repo = IraqPaymentRepository(user["org_id"])
    provider_ref = f"{data.gateway.upper()}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{user['id'][:8]}"
    payment = repo.create({
        **data.model_dump(),
        "provider_reference": provider_ref,
        "status": "pending",
        "initiated_at": datetime.utcnow().isoformat(),
        "initiated_by": user["id"],
    })
    redirect_url_stub = f"https://gateway-stub.example.com/{data.gateway}/{provider_ref}"
    return {"payment": payment, "provider_reference": provider_ref, "redirect_url": redirect_url_stub}


def _process_gateway_callback(org_id: str, gateway: str, data: PaymentCallback) -> dict:
    """Shared callback logic for authenticated and webhook routes."""
    from app.services.idempotency import get_cached_response, store_response

    idem = f"{gateway}:{data.provider_reference}:{data.status}"
    cached = get_cached_response(org_id, "iraq_payment_callback", idem)
    if cached:
        return cached

    repo = IraqPaymentRepository(org_id)
    items, _ = repo.list(filters=[
        {"field": "provider_reference", "op": "==", "value": data.provider_reference},
        {"field": "gateway", "op": "==", "value": gateway},
    ], limit=1)
    if not items:
        raise HTTPException(404, "payment not found")
    pmt = items[0]
    if pmt.get("status") == "success":
        result = {"payment_id": pmt["id"], "status": "success", "duplicate": True}
        store_response(org_id, "iraq_payment_callback", idem, result)
        return result

    new_status = data.status if data.status in {"success", "failed", "pending"} else "pending"
    payload = {
        "status": new_status,
        "callback_received_at": datetime.utcnow().isoformat(),
        "raw_callback": data.raw_payload or {},
    }
    if new_status == "success":
        payload["completed_at"] = datetime.utcnow().isoformat()
        if pmt.get("invoice_id"):
            try:
                inv_repo = InvoiceRepository(org_id)
                inv = inv_repo.get(pmt["invoice_id"])
                if inv:
                    inv_repo.update(pmt["invoice_id"], {
                        "payment_status": "paid",
                        "paid_amount": float(inv.get("paid_amount") or 0) + float(pmt.get("amount") or 0),
                        "paid_at": datetime.utcnow().isoformat(),
                    })
            except Exception:
                pass
    updated = repo.update(pmt["id"], payload)
    result = {"payment_id": pmt["id"], "status": new_status, "payment": updated}
    store_response(org_id, "iraq_payment_callback", idem, result)
    return result


@router.post("/callback/{gateway}", status_code=200,
             dependencies=[Depends(require_perm("settings.update"))])
def payment_callback(gateway: str, data: PaymentCallback,
                      user: dict = Depends(get_current_user)):
    """Authenticated provider callback (internal testing)."""
    if gateway not in SUPPORTED_GATEWAYS:
        raise HTTPException(400, "unsupported gateway")
    return _process_gateway_callback(user["org_id"], gateway, data)


# Header the provider must send carrying the HMAC-SHA256 hex digest of the raw body.
WEBHOOK_SIGNATURE_HEADER = "X-Webhook-Signature"


async def _verify_and_parse_webhook(request: Request) -> PaymentCallback:
    """Authenticate a PUBLIC payment webhook and return the parsed body.

    The raw request body is read **once** and HMAC-verified before any parsing,
    so a forged callback can never reach ``_process_gateway_callback`` (which
    marks invoices paid). Behaviour:

    * secret unset/empty            → 503 (webhook disabled, safe-by-default)
    * signature header missing/bad  → 401 (invalid signature)
    * valid signature               → parsed ``PaymentCallback``
    """
    secret = (settings.IRAQ_PAYMENT_WEBHOOK_SECRET or "").strip()
    if not secret:
        # Safe-by-default: with no secret configured we cannot authenticate the
        # caller, so we refuse to process rather than trust an unsigned request.
        raise HTTPException(503, "webhook disabled: signature secret not configured")

    raw_body = await request.body()
    provided_sig = request.headers.get(WEBHOOK_SIGNATURE_HEADER, "")
    if not provided_sig:
        raise HTTPException(401, "invalid signature")

    expected_sig = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, provided_sig):
        raise HTTPException(401, "invalid signature")

    # Body is authenticated — parse the verified bytes into the model.
    try:
        payload = json.loads(raw_body.decode("utf-8"))
        return PaymentCallback(**payload)
    except (ValueError, ValidationError) as exc:
        raise HTTPException(400, "invalid webhook payload") from exc


@router.post("/webhook/fib", status_code=200)
async def fib_webhook(request: Request, org_id: str = Query(..., min_length=1)):
    """Public FIB webhook — HMAC-signed (X-Webhook-Signature); org_id identifies tenant."""
    data = await _verify_and_parse_webhook(request)
    return _process_gateway_callback(org_id, "fib", data)


@router.post("/webhook/zain-cash", status_code=200)
async def zain_cash_webhook(request: Request, org_id: str = Query(..., min_length=1)):
    """Public Zain Cash webhook — HMAC-signed (X-Webhook-Signature)."""
    data = await _verify_and_parse_webhook(request)
    return _process_gateway_callback(org_id, "zain_cash", data)


@router.get("/payments", dependencies=[Depends(require_perm("invoices.read"))])
def list_payments(status: Optional[str] = None, gateway: Optional[str] = None,
                   user: dict = Depends(get_current_user)):
    repo = IraqPaymentRepository(user["org_id"])
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    if gateway:
        filters.append({"field": "gateway", "op": "==", "value": gateway})
    items, total = repo.list(filters=filters or None, limit=500,
                              order_by="initiated_at", order_dir="DESCENDING")
    return {"items": items, "total": total}


@router.get("/payments/{pmt_id}")
def get_payment(pmt_id: str, user: dict = Depends(get_current_user)):
    item = IraqPaymentRepository(user["org_id"]).get(pmt_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "payment not found")
    return item
