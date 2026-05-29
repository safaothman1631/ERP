"""Hosted-payment-link endpoint for invoices (launch-readiness § R4.16).

``POST /api/invoices/{id}/pay-link`` returns a tenant-branded URL that opens
``frontend/src/pages/pay/PayLink.tsx``. The token is a short JWT carrying
``{tid, iid, amount, currency, exp}`` and signed with the application
``SECRET_KEY``. The public endpoint that resolves the link is in the existing
``app/api/payment_links.py`` (token-based) — this module is the **generator**.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from pydantic import BaseModel, Field

from app.config import get_settings
from app.firestore.invoices import InvoiceRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm


router = APIRouter(prefix="/api/invoices", tags=["payments"])


class PayLinkRequest(BaseModel):
    expires_in_hours: int = Field(168, ge=1, le=24 * 30)  # default 7 days
    enabled_providers: Optional[list[str]] = None
    note: Optional[str] = Field(None, max_length=280)


class PayLinkResponse(BaseModel):
    url: str
    token: str
    expires_at: datetime


def _public_base_url() -> str:
    """Tenant-facing base URL for the hosted page."""
    return os.environ.get("PUBLIC_APP_URL", "https://erp.zoho.kurd.iq")


@router.post(
    "/{invoice_id}/pay-link",
    response_model=PayLinkResponse,
    dependencies=[Depends(require_perm("invoices.update"))],
)
def create_pay_link(
    invoice_id: str,
    body: PayLinkRequest,
    user: dict = Depends(get_current_user),
):
    """Generate a signed payment URL for an invoice."""
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.get(invoice_id)
    if not invoice:
        raise HTTPException(404, "invoice_not_found")
    if invoice.get("status") == "paid":
        raise HTTPException(409, "invoice_already_paid")

    settings = get_settings()
    secret = getattr(settings, "SECRET_KEY", None) or os.environ.get("SECRET_KEY", "dev")
    expires_at = datetime.utcnow() + timedelta(hours=body.expires_in_hours)

    amount_due = Decimal(str(invoice.get("balance_due", invoice.get("total", 0))))
    currency = invoice.get("currency", "IQD")
    payload = {
        "tid": user["org_id"],
        "iid": invoice_id,
        "amt": str(amount_due),
        "cur": currency,
        "exp": int(expires_at.timestamp()),
        "iat": int(datetime.utcnow().timestamp()),
    }
    if body.enabled_providers:
        payload["prov"] = body.enabled_providers
    if body.note:
        payload["note"] = body.note

    token = jwt.encode(payload, secret, algorithm="HS256")
    url = f"{_public_base_url()}/pay/{token}"
    return PayLinkResponse(url=url, token=token, expires_at=expires_at)
