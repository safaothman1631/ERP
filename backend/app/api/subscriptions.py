"""Sprint 38 + Wave G: Subscription Billing — plans, subscriptions, automated renewal,
proration, dunning workflow, MRR/ARR reporting.

FIX-1081..FIX-1110 + Wave-G enhancements.
"""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import Optional
import uuid
from math import ceil
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.firestore.invoices import InvoiceRepository
from app.firestore.subscriptions import (
    SubscriptionPlanRepository,
    SubscriptionRepository,
    DunningAttemptRepository
)
from app.services.auth import get_current_user
from app.services.report_streams import collect_stream

router = APIRouter(prefix="/api/subscriptions", tags=["Subscriptions"])


# Legacy inline repos for addons, coupons, sub-invoices
class SubAddonRepo(BaseRepository):
    collection_name = "sub_addons"


class SubCouponRepo(BaseRepository):
    collection_name = "sub_coupons"


class SubInvoiceRepo(BaseRepository):
    collection_name = "sub_invoices"


# Schemas
class PlanCreate(BaseModel):
    code: str = Field(..., max_length=50)
    name: str
    item_id: Optional[str] = None
    price: float = Field(..., ge=0)
    currency: str = "IQD"
    billing_cycle: str = Field("monthly", pattern=r"^(monthly|quarterly|yearly)$")
    billing_interval: int = Field(1, ge=1, le=12)
    trial_days: int = Field(0, ge=0, le=365)
    setup_fee: float = Field(0.0, ge=0)
    description: Optional[str] = None
    active: bool = True


class PlanUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=50)
    name: Optional[str] = None
    item_id: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = None
    billing_cycle: Optional[str] = Field(None, pattern=r"^(monthly|quarterly|yearly)$")
    billing_interval: Optional[int] = Field(None, ge=1, le=12)
    trial_days: Optional[int] = Field(None, ge=0, le=365)
    setup_fee: Optional[float] = Field(None, ge=0)
    description: Optional[str] = None
    active: Optional[bool] = None


class AddonCreate(BaseModel):
    name: str
    price: float = Field(..., ge=0)
    metric: str = Field("flat", pattern=r"^(flat|per_unit|tiered)$")


class CouponCreate(BaseModel):
    code: str
    discount_pct: float = Field(0.0, ge=0, le=100)
    discount_amount: float = Field(0.0, ge=0)
    max_redemptions: Optional[int] = None
    expires_at: Optional[str] = None


class SubscriptionCreate(BaseModel):
    contact_id: str
    plan_id: str
    start_date: Optional[str] = None
    trial_days_override: Optional[int] = Field(None, ge=0, le=365)
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class SubscriptionUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern=r"^(trial|active|past_due|paused|cancelled)$")
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class SubscriptionUpgrade(BaseModel):
    new_plan_id: str


class SubscriptionCancelRequest(BaseModel):
    at_period_end: bool = True
    reason: Optional[str] = None


def _own(repo, doc_id, org_id):
    """Verify document ownership."""
    item = repo.get(doc_id)
    if not item or item.get("org_id") != org_id:
        raise HTTPException(404, "نەدۆزرایەوە")
    return item


# ═══════════════════════════════════════════════════════════════════════════
# Helper functions for scheduler (Wave L)
# ═══════════════════════════════════════════════════════════════════════════

def _generate_invoice_for_sub(org_id: str, sub_id: str) -> dict:
    """Generate an invoice for a subscription (used by scheduler and API)."""
    sub_repo = SubscriptionRepository(org_id)
    plan_repo = SubscriptionPlanRepository(org_id)
    inv_repo = InvoiceRepository(org_id)
    
    sub = sub_repo.get(sub_id)
    if not sub:
        raise ValueError(f"Subscription {sub_id} not found")
    
    plan = plan_repo.get(sub.get("plan_id"))
    if not plan:
        raise ValueError(f"Plan {sub.get('plan_id')} not found")
    
    now = datetime.utcnow()
    invoice_data = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "contact_id": sub.get("contact_id"),
        "invoice_number": f"SUB-{sub_id[:8]}-{now.strftime('%Y%m%d')}",
        "date": now.isoformat(),
        "due_date": (now + timedelta(days=14)).isoformat(),
        "status": "draft",
        "currency": plan.get("currency", "IQD"),
        "subtotal": float(plan.get("price", 0)),
        "total": float(plan.get("price", 0)),
        "balance_due": float(plan.get("price", 0)),
        "notes": f"بەشداربوون: {plan.get('name')}",
        "subscription_id": sub_id,
        "created_at": now.isoformat(),
    }
    
    invoice = inv_repo.create(invoice_data)
    
    # Add line items
    line = {
        "id": str(uuid.uuid4()),
        "item_id": plan.get("item_id") or "",
        "description": f"{plan.get('name')} - {str(sub.get('current_period_start') or '')[:10]} بۆ {str(sub.get('current_period_end') or '')[:10]}",
        "quantity": 1,
        "rate": float(plan.get("price", 0)),
        "amount": float(plan.get("price", 0)),
    }
    inv_repo.set_lines(invoice["id"], [line])
    
    # Update subscription
    _cpe = sub.get("current_period_end")
    period_end = _cpe if isinstance(_cpe, datetime) else (
        datetime.fromisoformat(_cpe) if isinstance(_cpe, str) and _cpe else now
    )
    cycle = plan.get("billing_cycle", "monthly")
    interval = plan.get("billing_interval", 1)
    if cycle == "monthly":
        cycle_days = 30 * interval
    elif cycle == "quarterly":
        cycle_days = 90 * interval
    elif cycle == "yearly":
        cycle_days = 365 * interval
    else:
        cycle_days = 30
    
    next_period_end = period_end + timedelta(days=cycle_days)
    
    sub_repo.update(sub_id, {
        "last_invoice_id": invoice["id"],
        "next_invoice_date": next_period_end.isoformat(),
    })
    
    return invoice


def _run_dunning_step(org_id: str, sub_id: str) -> dict:
    """Execute dunning step for a past-due subscription (used by scheduler and API)."""
    sub_repo = SubscriptionRepository(org_id)
    dunning_repo = DunningAttemptRepository(org_id)
    
    sub = sub_repo.get(sub_id)
    if not sub:
        raise ValueError(f"Subscription {sub_id} not found")
    
    if sub.get("status") != "past_due":
        raise ValueError("Only past_due subscriptions can have dunning")
    
    # Get last attempt
    last_attempt = dunning_repo.get_last_attempt(sub_id)
    attempt_number = (last_attempt.get("attempt_number", 0) if last_attempt else 0) + 1
    
    # Determine action based on attempt number
    if attempt_number == 1:
        action = "reminder_email"
    elif attempt_number == 2:
        action = "second_notice"
    elif attempt_number == 3:
        action = "final_notice"
    else:
        action = "suspend"
        sub_repo.update(sub_id, {"status": "cancelled"})
    
    # Create dunning attempt
    attempt = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "subscription_id": sub_id,
        "invoice_id": sub.get("last_invoice_id"),
        "attempt_number": attempt_number,
        "action": action,
        "sent_at": datetime.utcnow().isoformat(),
        "status": "sent",
    }
    dunning_repo.create(attempt)
    
    return {"attempt": attempt, "subscription_status": sub_repo.get(sub_id).get("status")}


# ═══════════════════════════════════════════════════════════════════════════
# Plans CRUD
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/plans")
def list_plans(user: dict = Depends(get_current_user)):
    """List all subscription plans."""
    items, total = SubscriptionPlanRepository(user["org_id"]).list(limit=200)
    return {"items": items, "total": total}


@router.post("/plans", status_code=201)
def create_plan(body: PlanCreate, user: dict = Depends(get_current_user)):
    """Create a new subscription plan."""
    repo = SubscriptionPlanRepository(user["org_id"])
    data = body.model_dump()
    data["id"] = str(uuid.uuid4())
    return repo.create(data)


@router.get("/plans/{pid}")
def get_plan(pid: str = Path(...), user: dict = Depends(get_current_user)):
    """Get a specific plan."""
    return _own(SubscriptionPlanRepository(user["org_id"]), pid, user["org_id"])


@router.put("/plans/{pid}")
def update_plan(body: PlanUpdate, pid: str = Path(...), user: dict = Depends(get_current_user)):
    """Update a plan."""
    repo = SubscriptionPlanRepository(user["org_id"])
    _own(repo, pid, user["org_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return repo.update(pid, updates)


@router.delete("/plans/{pid}", status_code=204)
def delete_plan(pid: str = Path(...), user: dict = Depends(get_current_user)):
    """Delete a plan."""
    repo = SubscriptionPlanRepository(user["org_id"])
    _own(repo, pid, user["org_id"])
    repo.delete(pid)


# Addons
@router.get("/addons")
def list_addons(user: dict = Depends(get_current_user)):
    items, total = SubAddonRepo(user["org_id"]).list(limit=200)
    return {"items": items, "total": total}


@router.post("/addons", status_code=201)
def create_addon(body: AddonCreate, user: dict = Depends(get_current_user)):
    return SubAddonRepo(user["org_id"]).create(body.model_dump())


@router.delete("/addons/{aid}", status_code=204)
def delete_addon(aid: str, user: dict = Depends(get_current_user)):
    repo = SubAddonRepo(user["org_id"])
    _own(repo, aid, user["org_id"])
    repo.delete(aid)


# Coupons
@router.get("/coupons")
def list_coupons(user: dict = Depends(get_current_user)):
    items, total = SubCouponRepo(user["org_id"]).list(limit=500)
    return {"items": items, "total": total}


@router.post("/coupons", status_code=201)
def create_coupon(body: CouponCreate, user: dict = Depends(get_current_user)):
    return SubCouponRepo(user["org_id"]).create(body.model_dump())


@router.delete("/coupons/{cid}", status_code=204)
def delete_coupon(cid: str, user: dict = Depends(get_current_user)):
    repo = SubCouponRepo(user["org_id"])
    _own(repo, cid, user["org_id"])
    repo.delete(cid)


# ═══════════════════════════════════════════════════════════════════════════
# Subscriptions CRUD & Lifecycle
# ═══════════════════════════════════════════════════════════════════════════

@router.get("")
def list_subs(
    user: dict = Depends(get_current_user),
    status: Optional[str] = Query(None),
    plan_id: Optional[str] = Query(None),
):
    """List subscriptions with optional filters."""
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    if plan_id:
        filters.append({"field": "plan_id", "op": "==", "value": plan_id})
    items, total = SubscriptionRepository(user["org_id"]).list(filters=filters, limit=500)
    return {"items": items, "total": total}


@router.post("", status_code=201)
def create_sub(body: SubscriptionCreate, user: dict = Depends(get_current_user)):
    """Create a new subscription."""
    repo = SubscriptionRepository(user["org_id"])
    plan_repo = SubscriptionPlanRepository(user["org_id"])
    plan = plan_repo.get(body.plan_id)
    if not plan or not plan.get("active"):
        raise HTTPException(400, "پلانەکە نەدۆزرایەوە یان ناچالاکە")
    
    data = body.model_dump()
    data["id"] = str(uuid.uuid4())
    now = datetime.utcnow()
    
    # Determine trial period
    trial_days = body.trial_days_override if body.trial_days_override is not None else plan.get("trial_days", 0)
    data["status"] = "trial" if trial_days > 0 else "active"
    
    # Calculate billing cycle days
    cycle = plan.get("billing_cycle", "monthly")
    interval = plan.get("billing_interval", 1)
    if cycle == "monthly":
        cycle_days = 30 * interval
    elif cycle == "quarterly":
        cycle_days = 90 * interval
    elif cycle == "yearly":
        cycle_days = 365 * interval
    else:
        cycle_days = 30
    
    # Set period dates
    start = datetime.fromisoformat(body.start_date) if body.start_date else now
    data["start_date"] = start.isoformat()
    data["current_period_start"] = start.isoformat()
    data["current_period_end"] = (start + timedelta(days=trial_days + cycle_days)).isoformat()
    data["next_invoice_date"] = (start + timedelta(days=trial_days)).isoformat()
    
    if trial_days > 0:
        data["trial_end"] = (start + timedelta(days=trial_days)).isoformat()
    
    data["created_at"] = now.isoformat()
    return repo.create(data)


@router.get("/{sid}")
def get_sub(sid: str = Path(...), user: dict = Depends(get_current_user)):
    """Get a specific subscription."""
    return _own(SubscriptionRepository(user["org_id"]), sid, user["org_id"])


@router.put("/{sid}")
def update_sub(body: SubscriptionUpdate, sid: str = Path(...), user: dict = Depends(get_current_user)):
    """Update a subscription."""
    repo = SubscriptionRepository(user["org_id"])
    _own(repo, sid, user["org_id"])
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return repo.update(sid, updates)


@router.post("/{sid}/pause")
def pause_sub(sid: str = Path(...), user: dict = Depends(get_current_user)):
    """Pause a subscription."""
    repo = SubscriptionRepository(user["org_id"])
    _own(repo, sid, user["org_id"])
    return repo.update(sid, {
        "status": "paused",
        "paused_at": datetime.utcnow().isoformat()
    })


@router.post("/{sid}/resume")
def resume_sub(sid: str = Path(...), user: dict = Depends(get_current_user)):
    """Resume a paused subscription."""
    repo = SubscriptionRepository(user["org_id"])
    sub = _own(repo, sid, user["org_id"])
    if sub.get("status") != "paused":
        raise HTTPException(400, "تەنها بەشداربوونی وەستێنراو دەتوانیت دووبارە دەستپێبکەیتەوە")
    return repo.update(sid, {"status": "active"})


@router.post("/{sid}/cancel")
def cancel_sub(
    body: SubscriptionCancelRequest,
    sid: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Cancel a subscription."""
    repo = SubscriptionRepository(user["org_id"])
    sub = _own(repo, sid, user["org_id"])
    
    updates = {"cancel_reason": body.reason}
    if body.at_period_end:
        # Schedule cancellation at period end
        updates["cancel_at"] = sub.get("current_period_end")
    else:
        # Cancel immediately
        updates["status"] = "cancelled"
        updates["cancelled_at"] = datetime.utcnow().isoformat()
    
    return repo.update(sid, updates)


@router.post("/{sid}/generate-invoice")
def generate_invoice(sid: str = Path(...), user: dict = Depends(get_current_user)):
    """Generate an invoice for the current billing period."""
    _own(SubscriptionRepository(user["org_id"]), sid, user["org_id"])
    invoice = _generate_invoice_for_sub(user["org_id"], sid)
    return {"invoice": invoice}


@router.post("/{sid}/upgrade")
def upgrade_sub(
    body: SubscriptionUpgrade,
    sid: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Upgrade subscription to a new plan with proration."""
    sub_repo = SubscriptionRepository(user["org_id"])
    plan_repo = SubscriptionPlanRepository(user["org_id"])
    inv_repo = InvoiceRepository(user["org_id"])
    
    sub = _own(sub_repo, sid, user["org_id"])
    old_plan = plan_repo.get(sub.get("plan_id"))
    new_plan = plan_repo.get(body.new_plan_id)
    
    if not old_plan or not new_plan:
        raise HTTPException(400, "پلانەکان نەدۆزرانەوە")
    
    if not new_plan.get("active"):
        raise HTTPException(400, "پلانی نوێ ناچالاکە")
    
    # Calculate proration
    now = datetime.utcnow()
    period_start = datetime.fromisoformat(sub.get("current_period_start", now.isoformat()))
    _cpe = sub.get("current_period_end")
    period_end = _cpe if isinstance(_cpe, datetime) else (
        datetime.fromisoformat(_cpe) if isinstance(_cpe, str) and _cpe else now
    )
    total_days = (period_end - period_start).days
    remaining_days = (period_end - now).days
    
    if total_days > 0 and remaining_days > 0:
        proration_pct = remaining_days / total_days
        price_diff = float(new_plan.get("price", 0)) - float(old_plan.get("price", 0))
        prorated_amount = ceil(price_diff * proration_pct * 100) / 100
    else:
        prorated_amount = 0.0
    
    # Create proration invoice if there's a difference
    if prorated_amount > 0:
        proration_inv = {
            "id": str(uuid.uuid4()),
            "contact_id": sub.get("contact_id"),
            "invoice_number": f"PRO-{sid[:8]}-{now.strftime('%Y%m%d')}",
            "date": now.isoformat(),
            "due_date": (now + timedelta(days=7)).isoformat(),
            "status": "draft",
            "currency": new_plan.get("currency", "IQD"),
            "subtotal": prorated_amount,
            "total": prorated_amount,
            "balance_due": prorated_amount,
            "notes": f"نرخی جیاوازی گواستنەوە بۆ {new_plan.get('name')}",
            "subscription_id": sid,
            "created_at": now.isoformat(),
        }
        proration_invoice = inv_repo.create(proration_inv)
        proration_line = {
            "id": str(uuid.uuid4()),
            "description": f"گواستنەوە بۆ {new_plan.get('name')} ({remaining_days} ڕۆژی ماوە)",
            "quantity": 1,
            "rate": prorated_amount,
            "amount": prorated_amount,
        }
        inv_repo.set_lines(proration_invoice["id"], [proration_line])
        last_invoice_id = proration_invoice["id"]
    else:
        last_invoice_id = sub.get("last_invoice_id")
    
    # Update subscription
    sub_repo.update(sid, {
        "plan_id": body.new_plan_id,
        "last_invoice_id": last_invoice_id,
    })
    
    return {"subscription": sub_repo.get(sid), "proration_amount": prorated_amount}


# Invoices
@router.get("/invoices/list")
def list_sub_invoices(user: dict = Depends(get_current_user), status: Optional[str] = None):
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = SubInvoiceRepo(user["org_id"]).list(filters=filters, limit=1000)
    return {"items": items, "total": total}


@router.post("/invoices/{iid}/mark-paid")
def mark_inv_paid(iid: str, user: dict = Depends(get_current_user)):
    repo = SubInvoiceRepo(user["org_id"])
    _own(repo, iid, user["org_id"])
    return repo.update(iid, {"status": "paid", "paid_at": datetime.utcnow().isoformat()})


# ═══════════════════════════════════════════════════════════════════════════
# Dunning Workflow
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/dunning/queue")
def get_dunning_queue(user: dict = Depends(get_current_user)):
    """Get all past-due subscriptions for dunning."""
    sub_repo = SubscriptionRepository(user["org_id"])
    items, total = sub_repo.list_past_due()
    return {"items": items, "total": total}


@router.post("/{sid}/dunning/run")
def run_dunning(sid: str = Path(...), user: dict = Depends(get_current_user)):
    """Run the next dunning step for a subscription."""
    _own(SubscriptionRepository(user["org_id"]), sid, user["org_id"])
    return _run_dunning_step(user["org_id"], sid)


@router.get("/{sid}/dunning")
def list_dunning(sid: str = Path(...), user: dict = Depends(get_current_user)):
    """List dunning history for a subscription."""
    dunning_repo = DunningAttemptRepository(user["org_id"])
    items, total = dunning_repo.list_by_subscription(sid)
    return {"items": items, "total": total}


# ═══════════════════════════════════════════════════════════════════════════
# Reports & Metrics
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/reports/mrr")
def mrr_report(user: dict = Depends(get_current_user)):
    """Monthly Recurring Revenue report."""
    sub_repo = SubscriptionRepository(user["org_id"])
    plan_repo = SubscriptionPlanRepository(user["org_id"])
    
    # Get all active/trial subscriptions
    active_subs, _ = sub_repo.list(
        filters=[{"field": "status", "op": "in", "value": ["active", "trial"]}],
        limit=10000
    )
    
    # Calculate MRR by plan
    plan_mrr = {}
    total_mrr = 0.0
    
    for sub in active_subs:
        plan_id = sub.get("plan_id")
        plan = plan_repo.get(plan_id) if plan_id else None
        if not plan:
            continue
        
        price = float(plan.get("price", 0))
        cycle = plan.get("billing_cycle", "monthly")
        interval = plan.get("billing_interval", 1)
        
        # Normalize to monthly
        if cycle == "monthly":
            monthly_price = price / interval
        elif cycle == "quarterly":
            monthly_price = price / (3 * interval)
        elif cycle == "yearly":
            monthly_price = price / (12 * interval)
        else:
            monthly_price = price
        
        total_mrr += monthly_price
        
        plan_name = plan.get("name", "Unknown")
        if plan_name not in plan_mrr:
            plan_mrr[plan_name] = {"plan": plan_name, "mrr": 0.0, "count": 0}
        plan_mrr[plan_name]["mrr"] += monthly_price
        plan_mrr[plan_name]["count"] += 1
    
    # Get previous month's MRR (simplified - would need historical data)
    previous_mrr = total_mrr * 0.95  # Placeholder - in production, query historical data
    growth_pct = ((total_mrr - previous_mrr) / previous_mrr * 100) if previous_mrr > 0 else 0.0
    
    by_plan = [
        {"plan": v["plan"], "mrr": round(v["mrr"], 2), "count": v["count"]}
        for v in sorted(plan_mrr.values(), key=lambda x: x["mrr"], reverse=True)
    ]
    
    return {
        "current_mrr": round(total_mrr, 2),
        "previous_mrr": round(previous_mrr, 2),
        "growth_pct": round(growth_pct, 2),
        "active_count": len(active_subs),
        "by_plan": by_plan,
    }


@router.get("/reports/arr")
def arr_report(user: dict = Depends(get_current_user)):
    """Annual Recurring Revenue report."""
    mrr_data = mrr_report(user)
    return {
        "arr": round(mrr_data["current_mrr"] * 12, 2),
        "mrr": mrr_data["current_mrr"],
        "growth_pct": mrr_data["growth_pct"],
    }


@router.get("/reports/churn")
def churn_report(user: dict = Depends(get_current_user), period: int = Query(30, ge=1, le=365)):
    """Churn rate report for a given period."""
    sub_repo = SubscriptionRepository(user["org_id"])
    
    now = datetime.utcnow()
    period_start = (now - timedelta(days=period)).isoformat()
    
    # Get all subscriptions
    all_subs = collect_stream(sub_repo, max_docs=10000)
    
    # Count active at period start and cancellations during period
    active_at_start = 0
    cancelled_in_period = 0
    
    for sub in all_subs:
        start_date = sub.get("start_date", "")
        cancelled_at = sub.get("cancelled_at", "")
        
        if start_date and start_date < period_start:
            active_at_start += 1
            
            if cancelled_at and cancelled_at >= period_start:
                cancelled_in_period += 1
    
    churn_pct = (cancelled_in_period / active_at_start * 100) if active_at_start > 0 else 0.0
    
    return {
        "period_days": period,
        "active_at_start": active_at_start,
        "cancelled": cancelled_in_period,
        "churn_pct": round(churn_pct, 2),
        "remaining": active_at_start - cancelled_in_period,
    }

