"""Payments REST API (launch-readiness § R4.9–R4.11).

Routes:
  * ``POST   /api/payments/initiate``           initiate a charge with a provider
  * ``POST   /api/payments/{id}/capture``       admin/webhook-driven capture
  * ``POST   /api/payments/{id}/refund``        refund (full or partial)
  * ``GET    /api/payments/{id}``               read a single Payment
  * ``GET    /api/payments``                    list with status/provider/invoice filters
  * ``POST   /api/payments/webhooks/{provider}``  public ingress, signature-verified

The route module deliberately stays thin: business logic lives in the gateway
adapters and the GL reversal lives in the existing accounting service.
"""
from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field

from app.firestore.payment_repo import (
    PaymentRepository,
    WebhookEventLogRepository,
)
from app.payments.gateway import (
    Money,
    PaymentOrder,
    PaymentProviderNotConfigured,
    PaymentStatus,
    WebhookSignatureInvalid,
)
from app.payments.registry import ProviderNotRegistered, get as get_provider
from app.services.auth import get_current_user
from app.services.permissions import require_perm


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments", tags=["payments"])

# Exported for bulk registration in main.py — mirrors the pattern used in
# ``app.api.quick_create.ALL_ROUTERS``.
ALL_ROUTERS = [router]


# ── Request/response schemas ─────────────────────────────────────────────


class InitiateRequest(BaseModel):
    amount: Decimal = Field(..., gt=0)
    currency: str = Field("IQD", min_length=3, max_length=3)
    provider_slug: str
    order: PaymentOrder


class RefundRequest(BaseModel):
    amount: Optional[Decimal] = Field(None, gt=0)
    reason: str = Field("", max_length=280)


# ── Helpers ──────────────────────────────────────────────────────────────


def _repo_factory(org_id: str) -> PaymentRepository:
    return PaymentRepository(org_id)


def _resolve_provider_for_org(slug: str):
    try:
        return get_provider(slug)
    except ProviderNotRegistered:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "provider_not_registered", "provider": slug},
        )


# ── Routes ───────────────────────────────────────────────────────────────


@router.post(
    "/initiate",
    status_code=201,
    dependencies=[Depends(require_perm("invoices.create"))],
)
async def initiate_payment(
    payload: InitiateRequest,
    response: Response,
    user: dict = Depends(get_current_user),
):
    """Open a new payment with the chosen provider."""
    provider = _resolve_provider_for_org(payload.provider_slug)
    order = payload.order.model_copy(
        update={
            "metadata": {
                **payload.order.metadata,
                "org_id": user["org_id"],
                "actor": user.get("id", "system"),
            }
        }
    )
    amount = Money(amount=payload.amount, currency=payload.currency.upper())
    try:
        result = await provider.initiate(amount, order)
    except PaymentProviderNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "provider_not_configured", "message": str(exc)},
        )
    response.headers["Location"] = f"/api/payments/{result.payment_id}"
    return result.model_dump()


@router.post(
    "/{payment_id}/capture",
    dependencies=[Depends(require_perm("invoices.update"))],
)
async def capture_payment(
    payment_id: str,
    user: dict = Depends(get_current_user),
):
    """Capture an authorised payment (admin/webhook-driven)."""
    repo = _repo_factory(user["org_id"])
    payment = repo.get(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="payment_not_found")
    provider = _resolve_provider_for_org(payment["provider_slug"])

    # COD captures via the dedicated transition path.
    if payment["provider_slug"] == "cod":
        from app.payments.cod_gateway import CODGateway, CODTransitionInvalid

        if not isinstance(provider, CODGateway):
            raise HTTPException(500, "registered cod provider has wrong type")
        try:
            updated = provider.mark_delivered(repo, payment_id, actor=user["id"])
        except CODTransitionInvalid as exc:
            raise HTTPException(409, str(exc))
        return updated

    # Cash is already captured; idempotent return.
    if payment["provider_slug"] == "cash":
        return payment

    # Stripe-style adapter: call provider.capture with provider_reference.
    pref = payment.get("provider_reference")
    if not pref:
        raise HTTPException(409, "payment has no provider_reference yet")
    try:
        cap = await provider.capture(pref)
    except PaymentProviderNotConfigured as exc:
        raise HTTPException(503, str(exc))
    repo.update_status(payment_id, cap.status, actor=user["id"],
                       provider_reference=cap.provider_reference)
    return repo.get(payment_id)


@router.post(
    "/{payment_id}/refund",
    dependencies=[Depends(require_perm("invoices.update"))],
)
async def refund_payment(
    payment_id: str,
    body: RefundRequest,
    user: dict = Depends(get_current_user),
):
    repo = _repo_factory(user["org_id"])
    payment = repo.get(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="payment_not_found")
    if payment.get("parent_payment_id"):
        raise HTTPException(409, "cannot refund a refund row")
    provider = _resolve_provider_for_org(payment["provider_slug"])

    refund_money = (
        Money(amount=body.amount, currency=payment["currency"])
        if body.amount else None
    )

    # Each adapter exposes ``refund_with_repo`` to keep local Payment bookkeeping
    # in one place — see cash_gateway.py and stripe_gateway.py.
    try:
        result = await provider.refund_with_repo(
            repo, payment, amount=refund_money,
            reason=body.reason, actor=user["id"],
        )
    except AttributeError:
        # COD or stub adapters reach here.
        if payment["provider_slug"] == "cod":
            from app.payments.cod_gateway import CODGateway, CODTransitionInvalid

            assert isinstance(provider, CODGateway)
            try:
                provider.mark_returned(
                    repo, payment_id, actor=user["id"], note=body.reason
                )
            except CODTransitionInvalid as exc:
                raise HTTPException(409, str(exc))
            _post_gl_reversal(user["org_id"], payment, body.reason, user["id"])
            return repo.get(payment_id)
        raise HTTPException(501, f"refund not implemented for provider "
                                 f"{payment['provider_slug']}")
    except PaymentProviderNotConfigured as exc:
        raise HTTPException(503, str(exc))

    # GL reversal for charges that moved money (cash + stripe).
    _post_gl_reversal(user["org_id"], payment, body.reason, user["id"],
                      refund_amount=result.amount.amount)
    return result.model_dump()


@router.get("/{payment_id}")
def get_payment(payment_id: str, user: dict = Depends(get_current_user)):
    repo = _repo_factory(user["org_id"])
    p = repo.get(payment_id)
    if not p:
        raise HTTPException(404, "payment_not_found")
    return p


@router.get("")
def list_payments(
    status_filter: Optional[str] = Query(None, alias="status"),
    provider_slug: Optional[str] = Query(None, alias="provider"),
    invoice_id: Optional[str] = Query(None),
    from_date: Optional[datetime] = Query(None, alias="from"),
    to_date: Optional[datetime] = Query(None, alias="to"),
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    repo = _repo_factory(user["org_id"])
    filters: list[dict[str, Any]] = []
    if status_filter:
        filters.append({"field": "status", "op": "==", "value": status_filter})
    if provider_slug:
        filters.append({"field": "provider_slug", "op": "==", "value": provider_slug})
    if invoice_id:
        filters.append({"field": "invoice_id", "op": "==", "value": invoice_id})
    if from_date:
        filters.append({"field": "created_at", "op": ">=", "value": from_date})
    if to_date:
        filters.append({"field": "created_at", "op": "<=", "value": to_date})
    items, total = repo.list(
        filters=filters, order_by="created_at", order_dir="DESCENDING", limit=limit,
    )
    return {"items": items, "total": total}


@router.post("/webhooks/{provider_slug}", status_code=200)
async def webhook_ingress(provider_slug: str, request: Request):
    """Public webhook ingress. Verifies signature, dedupes, then dispatches."""
    body = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}
    try:
        provider = get_provider(provider_slug)
    except ProviderNotRegistered:
        raise HTTPException(404, "unknown_provider")

    try:
        event = await provider.verify_webhook(headers, body)
    except WebhookSignatureInvalid as exc:
        logger.warning("webhook signature invalid: %s/%s", provider_slug, exc)
        raise HTTPException(400, "invalid_signature")
    except PaymentProviderNotConfigured as exc:
        raise HTTPException(503, str(exc))

    if not event.provider_event_id:
        # Cash/COD return empty events (no provider webhooks).
        return {"ok": True, "noop": True}

    # Dedup. ``org_id`` is resolved from the event metadata (Stripe puts it there).
    org_id = (
        (event.raw.get("data") or {}).get("object", {}).get("metadata", {}).get("org_id")
        or event.raw.get("metadata", {}).get("org_id")
        or "system"
    )
    log_repo = WebhookEventLogRepository(org_id)
    if log_repo.has_seen(provider_slug, event.provider_event_id):
        return {"ok": True, "dedup": True}
    log_repo.record(provider_slug, event.provider_event_id, event.event_type, event.raw)

    # Translate Stripe event_type into a local Payment status change.
    repo = PaymentRepository(org_id)
    local_status_by_event = {
        "payment_intent.succeeded": PaymentStatus.succeeded,
        "payment_intent.canceled": PaymentStatus.cancelled,
        "payment_intent.payment_failed": PaymentStatus.failed,
        "charge.refunded": PaymentStatus.refunded,
        "charge.dispute.created": PaymentStatus.requires_action,
    }
    new_status = local_status_by_event.get(event.event_type)
    if new_status and event.payment_id:
        local = repo.find_by_provider_reference(provider_slug, event.payment_id)
        if local:
            repo.update_status(local["id"], new_status, actor=f"webhook:{provider_slug}")
    return {"ok": True}


# ── GL reversal helper ───────────────────────────────────────────────────


def _post_gl_reversal(
    org_id: str,
    parent_payment: dict,
    reason: str,
    actor: str,
    *,
    refund_amount: Optional[Decimal] = None,
) -> None:
    """Post a reversing journal entry for the refunded payment.

    Uses the existing ``AccountingService`` so behaviour matches manual JEs.
    Account mapping comes from the tenant's ``default_accounts`` set during
    onboarding (cash account ↔ AR/POS revenue contra). If the mapping is
    missing we log + skip rather than block the refund itself.
    """
    try:
        from app.services.accounting import AccountingService
        from app.firestore.companies import CompanyRepository
    except Exception as exc:
        logger.warning("accounting service unavailable; skipping GL reversal: %s", exc)
        return

    # Look up tenant default_accounts from the active company. We tolerate any
    # shape — the onboarding wizard sets default_accounts under the org's
    # primary company doc.
    defaults: dict[str, str] = {}
    try:
        repo = CompanyRepository(org_id)
        items, _ = repo.list(limit=1)
        if items:
            defaults = items[0].get("default_accounts") or {}
    except Exception:
        defaults = {}
    cash_acct = defaults.get("cash") or defaults.get("undeposited_funds")
    revenue_acct = defaults.get("sales_revenue") or defaults.get("ar_clearing")
    if not (cash_acct and revenue_acct):
        logger.warning(
            "refund GL skipped — default_accounts missing for org=%s", org_id
        )
        return

    amt = Decimal(str(refund_amount if refund_amount is not None else parent_payment["amount"]))
    if amt < 0:
        amt = -amt
    try:
        AccountingService.create_journal_entry(
            org_id=org_id,
            date=datetime.utcnow(),
            lines=[
                # Reverse: debit revenue / credit cash (refund returns money).
                {"account_id": revenue_acct, "debit": float(amt), "credit": 0,
                 "description": f"Refund: {reason or 'no reason given'}"},
                {"account_id": cash_acct, "debit": 0, "credit": float(amt),
                 "description": f"Refund of payment {parent_payment['id']}"},
            ],
            description=f"Refund — payment {parent_payment['id']}",
            reference=parent_payment.get("provider_reference") or parent_payment["id"],
            source_type="payment_refund",
            source_id=parent_payment["id"],
            currency_code=parent_payment["currency"],
            created_by=actor,
        )
    except Exception as exc:
        logger.exception("refund GL reversal failed: %s", exc)
