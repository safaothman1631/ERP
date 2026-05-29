"""Tenant-facing SaaS billing endpoints (launch-readiness § R5).

This router is **per-tenant**: every endpoint reads/writes the tenant's own
``TenantBilling`` document. Super-admin endpoints live in ``saas_admin.py``.

State endpoint returns a denormalized view (state + plan summary + trial
countdown) so the frontend can render the billing page in one round-trip.

Note: nothing here imports the Stripe SDK at module-import time; it's all
lazy via ``app.billing.stripe``. That keeps boot resilient when Stripe is
not yet configured (the R7.7 open question).
"""
from __future__ import annotations

import logging
from dataclasses import asdict
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.services.auth import get_current_user
from app.services.permissions import require_perm

from app.billing import dunning as dunning_engine
from app.billing import trial as trial_engine
from app.billing import stripe as stripe_billing
from app.billing.plans import (
    DEFAULT_TRIAL_DAYS,
    PLANS,
    Plan,
    get_plan,
    list_plans,
    to_stripe_amount,
)
from app.firestore.tenant_billing_repo import TenantBillingRepository

from app.schemas.saas_billing import (
    BillingStateResponse,
    CancelRequest,
    CancelResponse,
    ChangePlanRequest,
    ChangePlanResponse,
    InvoiceListItem,
    InvoiceListResponse,
    PlanSummary,
    ProrationPreview,
    RestartRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/saas-billing", tags=["saas-billing"])


# ── Helpers ─────────────────────────────────────────────────────────────

def _tenant_id(user: dict) -> str:
    # In this codebase ``org_id`` is the per-tenant identifier.
    tid = user.get("org_id")
    if not tid:
        raise HTTPException(status_code=400, detail={"code": "no_tenant"})
    return tid


def _plan_summary(plan: Plan) -> PlanSummary:
    return PlanSummary(
        slug=plan.slug,
        name_ku=plan.name_ku,
        name_en=plan.name_en,
        price_iqd_monthly=plan.price_iqd_monthly,
        price_usd_monthly=plan.price_usd_monthly,
        price_iqd_annual=plan.price_iqd_annual,
        price_usd_annual=plan.price_usd_annual,
        limits=dict(plan.limits),
        features=dict(plan.features),
    )


def _state_to_response(state: Dict[str, Any]) -> BillingStateResponse:
    plan: Optional[Plan] = None
    if state.get("plan_slug") and state["plan_slug"] in PLANS:
        plan = get_plan(state["plan_slug"])
    trial_ends_at = state.get("trial_ends_at")
    return BillingStateResponse(
        tenant_id=state["tenant_id"],
        plan_slug=state.get("plan_slug") or "starter",
        billing_cycle=state.get("billing_cycle") or "monthly",
        currency=state.get("currency") or "IQD",
        status=state.get("status") or "trialing",
        trial_ends_at=_iso(trial_ends_at),
        days_left_in_trial=trial_engine.days_left(trial_ends_at=trial_ends_at)
            if trial_ends_at else None,
        current_period_start=_iso(state.get("current_period_start")),
        current_period_end=_iso(state.get("current_period_end")),
        payment_method_type=state.get("payment_method_type"),
        last_payment_at=_iso(state.get("last_payment_at")),
        dunning_step=int(state.get("dunning_step", 0)),
        plan=_plan_summary(plan) if plan else None,
        cancel_at_period_end=bool(state.get("cancel_at_period_end", False)),
    )


def _iso(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, datetime):
        return value.isoformat()
    # Firestore Timestamps quack with ``.isoformat``.
    try:
        return value.isoformat()
    except Exception:
        return str(value)


# ── Public-ish: list plans (used by the in-app upgrade picker) ──────────

@router.get("/plans")
def get_plans():
    """List public plans. No auth required — also used by the marketing page."""
    return {
        "items": [
            _plan_summary(p).model_dump(mode="json") for p in list_plans()
        ],
        "trial_days": DEFAULT_TRIAL_DAYS,
    }


# ── State ───────────────────────────────────────────────────────────────

@router.get("/state", response_model=BillingStateResponse)
def get_state(user: dict = Depends(get_current_user)):
    tid = _tenant_id(user)
    repo = TenantBillingRepository(tid)
    state = repo.get()
    if state is None:
        # Lazy-initialize for tenants created before this module existed.
        state = repo.initialize_for_trial()
    return _state_to_response(state)


# ── Change plan (upgrade / downgrade) ───────────────────────────────────

def _proration_preview(state: Dict[str, Any], new_plan: Plan,
                       cycle: str, currency: str) -> ProrationPreview:
    """Estimate the immediate amount due on a plan change.

    For a Stripe-backed tenant we ideally call ``preview_proration`` from the
    Stripe adapter; if Stripe isn't wired (R7.7 open) we fall back to a
    naive "charge the new plan's first period in full" preview.
    """
    sub_id = state.get("stripe_subscription_id")
    if sub_id:
        try:
            price_map = stripe_billing.load_price_map()
            slug_map = price_map.get(new_plan.slug)
            if slug_map:
                price_id = slug_map.get(currency=currency, cycle=cycle)
                preview = stripe_billing.preview_proration(
                    subscription_id=sub_id, new_price_id=price_id,
                )
                return ProrationPreview(
                    amount_due_now=int(preview.get("amount_due", 0)),
                    currency=currency,  # type: ignore[arg-type]
                    credit_from_old_plan=0,
                    next_invoice_total=int(preview.get("total", 0)),
                    next_invoice_at=None,
                )
        except (stripe_billing.StripeNotConfigured,
                stripe_billing.StripeBillingError, KeyError) as exc:
            logger.warning("Falling back from Stripe proration: %s", exc)
    # Fallback estimate.
    amount = to_stripe_amount(
        new_plan.price(currency=currency, cycle=cycle), currency,
    )
    return ProrationPreview(
        amount_due_now=amount,
        currency=currency,  # type: ignore[arg-type]
        credit_from_old_plan=0,
        next_invoice_total=amount,
        next_invoice_at=None,
    )


@router.post("/change-plan", response_model=ChangePlanResponse,
             dependencies=[Depends(require_perm("settings.billing"))])
def change_plan(req: ChangePlanRequest,
                user: dict = Depends(get_current_user)):
    tid = _tenant_id(user)
    try:
        new_plan = get_plan(req.to_plan)
    except KeyError:
        raise HTTPException(status_code=400, detail={"code": "unknown_plan"})

    repo = TenantBillingRepository(tid)
    state = repo.get() or repo.initialize_for_trial()
    preview = _proration_preview(state, new_plan, req.billing_cycle, req.currency)

    if not req.confirm:
        # Preview-only mode; nothing applied yet.
        return ChangePlanResponse(preview=preview, applied=False, new_state=None)

    # Apply the change.
    sub_id = state.get("stripe_subscription_id")
    if sub_id:
        try:
            price_map = stripe_billing.load_price_map()
            slug_map = price_map.get(new_plan.slug)
            if slug_map:
                price_id = slug_map.get(
                    currency=req.currency, cycle=req.billing_cycle,
                )
                stripe_billing.update_subscription_plan(
                    subscription_id=sub_id, new_price_id=price_id,
                )
        except (stripe_billing.StripeNotConfigured,
                stripe_billing.StripeBillingError) as exc:
            # Best-effort: persist the desired plan, surface the Stripe error.
            logger.warning("Stripe plan change skipped: %s", exc)

    new_state = repo.update({
        "plan_slug": new_plan.slug,
        "billing_cycle": req.billing_cycle,
        "currency": req.currency,
        "status": state.get("status") or "active",
    })
    return ChangePlanResponse(
        preview=preview, applied=True,
        new_state=_state_to_response(new_state),
    )


# ── Cancel + restart ────────────────────────────────────────────────────

@router.post("/cancel", response_model=CancelResponse,
             dependencies=[Depends(require_perm("settings.billing"))])
def cancel(req: CancelRequest, user: dict = Depends(get_current_user)):
    tid = _tenant_id(user)
    repo = TenantBillingRepository(tid)
    state = repo.get() or repo.initialize_for_trial()
    sub_id = state.get("stripe_subscription_id")
    if sub_id:
        try:
            stripe_billing.cancel_subscription(
                subscription_id=sub_id,
                at_period_end=(req.at == "period_end"),
            )
        except (stripe_billing.StripeNotConfigured,
                stripe_billing.StripeBillingError) as exc:
            logger.warning("Stripe cancel skipped: %s", exc)
    new_state = repo.cancel(
        reason=(req.reason or ""),
        at_period_end=(req.at == "period_end"),
    )
    return CancelResponse(
        status=new_state["status"],
        cancel_at_period_end=bool(new_state.get("cancel_at_period_end")),
        cancellation_reason=new_state.get("cancellation_reason"),
    )


@router.post("/restart",
             dependencies=[Depends(require_perm("settings.billing"))])
def restart(req: RestartRequest, user: dict = Depends(get_current_user)):
    tid = _tenant_id(user)
    repo = TenantBillingRepository(tid)
    state = repo.get()
    if not state:
        raise HTTPException(status_code=404, detail={"code": "no_state"})
    sub_id = state.get("stripe_subscription_id")
    if sub_id:
        try:
            stripe_billing.reactivate_subscription(subscription_id=sub_id)
        except (stripe_billing.StripeNotConfigured,
                stripe_billing.StripeBillingError) as exc:
            logger.warning("Stripe reactivate skipped: %s", exc)
    new_state = repo.update({
        "status": "active",
        "cancel_at_period_end": False,
        "cancellation_reason": None,
    })
    return {"ok": True, "state": _state_to_response(new_state).model_dump(mode="json")}


# ── Invoices ────────────────────────────────────────────────────────────

@router.get("/invoices", response_model=InvoiceListResponse)
def list_invoices_endpoint(user: dict = Depends(get_current_user)):
    tid = _tenant_id(user)
    repo = TenantBillingRepository(tid)
    state = repo.get() or {}
    customer_id = state.get("stripe_customer_id")
    items: list[InvoiceListItem] = []
    if customer_id:
        try:
            raw = stripe_billing.list_invoices(stripe_customer_id=customer_id)
            for inv in raw:
                items.append(InvoiceListItem(
                    id=inv.get("id", ""),
                    number=inv.get("number"),
                    amount_due=int(inv.get("amount_due", 0)),
                    currency=str(inv.get("currency", "")).upper(),
                    status=inv.get("status", ""),
                    issued_at=_iso(inv.get("created")),
                    paid_at=_iso(inv.get("status_transitions", {}).get("paid_at")),
                    hosted_url=inv.get("hosted_invoice_url"),
                    pdf_url=inv.get("invoice_pdf"),
                ))
        except (stripe_billing.StripeNotConfigured,
                stripe_billing.StripeBillingError) as exc:
            logger.warning("Stripe invoice list skipped: %s", exc)
    return InvoiceListResponse(items=items, total=len(items))


# ── Stripe webhook ──────────────────────────────────────────────────────

@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events. Verifies signature, dispatches by type.

    Returns 200 even for unknown event types (Stripe retries 4xx forever).
    Returns 400 on signature verification failure so misconfigured webhooks
    surface quickly.
    """
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")
    try:
        event = stripe_billing.verify_webhook(
            payload=payload, sig_header=sig_header,
        )
    except stripe_billing.StripeNotConfigured:
        # Webhook ingress shouldn't 500 if Stripe isn't wired yet.
        return Response(status_code=200, content="stripe-not-configured")
    except stripe_billing.StripeBillingError as exc:
        logger.warning("Bad Stripe webhook signature: %s", exc)
        raise HTTPException(status_code=400, detail={"code": "bad_signature"})

    etype = event.get("type")
    if etype not in stripe_billing.SUPPORTED_EVENTS:
        return {"ok": True, "ignored": etype}

    obj = event.get("data", {}).get("object", {}) or {}
    customer_id = obj.get("customer")
    tenant_id = (obj.get("metadata") or {}).get("tenant_id")
    if not tenant_id and customer_id:
        # The webhook arrived before we wrote the customer id; we can't tell
        # which tenant it belongs to. Ack and move on (will reconcile later).
        return {"ok": True, "deferred": True}

    if not tenant_id:
        return {"ok": True, "no_tenant": True}

    repo = TenantBillingRepository(tenant_id)
    if etype in {"customer.subscription.created", "customer.subscription.updated"}:
        repo.update({
            "stripe_subscription_id": obj.get("id"),
            "status": _map_stripe_status(obj.get("status")),
            "current_period_start": _from_unix(obj.get("current_period_start")),
            "current_period_end": _from_unix(obj.get("current_period_end")),
            "cancel_at_period_end": bool(obj.get("cancel_at_period_end")),
        })
    elif etype == "customer.subscription.deleted":
        repo.update({"status": "cancelled"})
    elif etype == "invoice.payment_succeeded":
        repo.record_payment(
            paid_at=_from_unix(obj.get("status_transitions", {}).get("paid_at")),
            new_period_start=_from_unix(obj.get("period_start")),
            new_period_end=_from_unix(obj.get("period_end")),
            payment_method_type="card",
        )
    elif etype == "invoice.payment_failed":
        repo.update({"status": "past_due"})

    return {"ok": True, "type": etype}


def _map_stripe_status(s: Optional[str]) -> str:
    return {
        "active": "active",
        "trialing": "trialing",
        "past_due": "past_due",
        "unpaid": "past_due",
        "canceled": "cancelled",
        "incomplete": "incomplete",
        "incomplete_expired": "cancelled",
    }.get(s or "", "active")


def _from_unix(ts):
    if not ts:
        return None
    if isinstance(ts, datetime):
        return ts
    try:
        return datetime.utcfromtimestamp(int(ts))
    except Exception:
        return None
