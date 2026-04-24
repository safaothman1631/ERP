"""Sprint 38: Subscription Management — plans, subscriptions, billing, dunning, MRR.

FIX-1081..FIX-1110.
"""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/subscriptions", tags=["Subscriptions"])


class SubPlanRepo(BaseRepository):
    collection_name = "sub_plans"


class SubAddonRepo(BaseRepository):
    collection_name = "sub_addons"


class SubCouponRepo(BaseRepository):
    collection_name = "sub_coupons"


class SubscriptionRepo(BaseRepository):
    collection_name = "subscriptions"


class SubInvoiceRepo(BaseRepository):
    collection_name = "sub_invoices"


class SubDunningRepo(BaseRepository):
    collection_name = "sub_dunning_events"


class PlanCreate(BaseModel):
    name: str
    price: float = Field(..., ge=0)
    currency: str = "IQD"
    interval: str = Field("month", pattern=r"^(day|week|month|year)$")
    interval_count: int = Field(1, ge=1, le=12)
    trial_days: int = Field(0, ge=0, le=365)
    description: Optional[str] = None
    is_active: bool = True


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
    addon_ids: list[str] = Field(default_factory=list)
    coupon_code: Optional[str] = None
    start_date: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class SubscriptionUpdate(BaseModel):
    plan_id: Optional[str] = None
    addon_ids: Optional[list[str]] = None
    status: Optional[str] = Field(None, pattern=r"^(trialing|active|past_due|cancelled|paused)$")


def _own(repo, doc_id, org_id):
    item = repo.get(doc_id)
    if not item or item.get("org_id") != org_id:
        raise HTTPException(404, "نەدۆزرایەوە")
    return item


# Plans CRUD
@router.get("/plans")
def list_plans(user: dict = Depends(get_current_user)):
    items, total = SubPlanRepo(user["org_id"]).list(limit=200)
    return {"items": items, "total": total}


@router.post("/plans", status_code=201)
def create_plan(body: PlanCreate, user: dict = Depends(get_current_user)):
    return SubPlanRepo(user["org_id"]).create(body.model_dump())


@router.get("/plans/{pid}")
def get_plan(pid: str, user: dict = Depends(get_current_user)):
    return _own(SubPlanRepo(user["org_id"]), pid, user["org_id"])


@router.patch("/plans/{pid}")
def update_plan(pid: str, body: PlanCreate, user: dict = Depends(get_current_user)):
    repo = SubPlanRepo(user["org_id"])
    _own(repo, pid, user["org_id"])
    return repo.update(pid, body.model_dump())


@router.delete("/plans/{pid}", status_code=204)
def delete_plan(pid: str, user: dict = Depends(get_current_user)):
    repo = SubPlanRepo(user["org_id"])
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


# Subscriptions
@router.get("")
def list_subs(user: dict = Depends(get_current_user), status: Optional[str] = None):
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = SubscriptionRepo(user["org_id"]).list(filters=filters, limit=500)
    return {"items": items, "total": total}


@router.post("", status_code=201)
def create_sub(body: SubscriptionCreate, user: dict = Depends(get_current_user)):
    repo = SubscriptionRepo(user["org_id"])
    plan = SubPlanRepo(user["org_id"]).get(body.plan_id)
    if not plan:
        raise HTTPException(400, "پلانەکە نەدۆزرایەوە")
    data = body.model_dump()
    now = datetime.utcnow()
    trial = plan.get("trial_days", 0)
    data["status"] = "trialing" if trial > 0 else "active"
    data["current_period_start"] = now.isoformat()
    data["current_period_end"] = (now + timedelta(days=30)).isoformat()
    if trial > 0:
        data["trial_ends_at"] = (now + timedelta(days=trial)).isoformat()
    data["mrr"] = float(plan.get("price", 0))
    return repo.create(data)


@router.get("/{sid}")
def get_sub(sid: str, user: dict = Depends(get_current_user)):
    return _own(SubscriptionRepo(user["org_id"]), sid, user["org_id"])


@router.patch("/{sid}")
def update_sub(sid: str, body: SubscriptionUpdate, user: dict = Depends(get_current_user)):
    repo = SubscriptionRepo(user["org_id"])
    _own(repo, sid, user["org_id"])
    return repo.update(sid, {k: v for k, v in body.model_dump().items() if v is not None})


@router.post("/{sid}/cancel")
def cancel_sub(sid: str, body: dict, user: dict = Depends(get_current_user)):
    repo = SubscriptionRepo(user["org_id"])
    _own(repo, sid, user["org_id"])
    return repo.update(sid, {
        "status": "cancelled",
        "cancelled_at": datetime.utcnow().isoformat(),
        "cancel_reason": body.get("reason"),
    })


@router.post("/{sid}/pause")
def pause_sub(sid: str, user: dict = Depends(get_current_user)):
    repo = SubscriptionRepo(user["org_id"])
    _own(repo, sid, user["org_id"])
    return repo.update(sid, {"status": "paused", "paused_at": datetime.utcnow().isoformat()})


@router.post("/{sid}/resume")
def resume_sub(sid: str, user: dict = Depends(get_current_user)):
    repo = SubscriptionRepo(user["org_id"])
    _own(repo, sid, user["org_id"])
    return repo.update(sid, {"status": "active"})


@router.post("/{sid}/renew")
def renew_sub(sid: str, user: dict = Depends(get_current_user)):
    repo = SubscriptionRepo(user["org_id"])
    sub = _own(repo, sid, user["org_id"])
    plan = SubPlanRepo(user["org_id"]).get(sub.get("plan_id"))
    if not plan:
        raise HTTPException(400, "پلانەکە نەدۆزرایەوە")
    now = datetime.utcnow()
    inv = SubInvoiceRepo(user["org_id"]).create({
        "subscription_id": sid,
        "amount": float(plan.get("price", 0)),
        "currency": plan.get("currency", "IQD"),
        "issued_at": now.isoformat(),
        "due_date": (now + timedelta(days=14)).isoformat(),
        "status": "open",
    })
    repo.update(sid, {
        "current_period_start": now.isoformat(),
        "current_period_end": (now + timedelta(days=30)).isoformat(),
        "last_invoice_id": inv["id"],
    })
    return {"invoice": inv}


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


# Dunning
@router.post("/{sid}/dunning")
def create_dunning(sid: str, body: dict, user: dict = Depends(get_current_user)):
    return SubDunningRepo(user["org_id"]).create({
        "subscription_id": sid,
        "level": body.get("level", 1),
        "action": body.get("action", "email_reminder"),
        "triggered_at": datetime.utcnow().isoformat(),
    })


@router.get("/{sid}/dunning")
def list_dunning(sid: str, user: dict = Depends(get_current_user)):
    items, total = SubDunningRepo(user["org_id"]).list(
        filters=[{"field": "subscription_id", "op": "==", "value": sid}], limit=200,
    )
    return {"items": items, "total": total}


# Metrics
@router.get("/metrics/mrr")
def mrr_metrics(user: dict = Depends(get_current_user)):
    items, _ = SubscriptionRepo(user["org_id"]).list(
        filters=[{"field": "status", "op": "in", "value": ["active", "trialing"]}], limit=10000,
    )
    mrr = sum(float(s.get("mrr", 0)) for s in items)
    return {
        "mrr": round(mrr, 2),
        "arr": round(mrr * 12, 2),
        "active_count": len(items),
    }


@router.get("/metrics/churn")
def churn_metrics(user: dict = Depends(get_current_user)):
    items, _ = SubscriptionRepo(user["org_id"]).list(limit=10000)
    cancelled = sum(1 for s in items if s.get("status") == "cancelled")
    total = len(items)
    return {
        "total": total,
        "cancelled": cancelled,
        "churn_pct": round(cancelled * 100 / total, 2) if total else 0.0,
    }
