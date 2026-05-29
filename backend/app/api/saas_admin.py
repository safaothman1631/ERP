"""Super-Admin SaaS billing endpoints (launch-readiness § R5.7).

Tenant-facing endpoints live in ``saas_billing.py``. This module holds
endpoints that aggregate across **all** tenants — only platform admins are
allowed in. Every route uses ``_require_platform_admin`` directly rather
than the generic ``require_perm`` to make the access boundary obvious.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.services.auth import get_current_user

from app.billing.plans import PLANS, get_plan
from app.firestore.tenant_billing_repo import (
    SaasBillingAdminRepository,
    TenantBillingRepository,
)

from app.schemas.saas_billing import (
    AdminDashboardResponse,
    AdminTenantListResponse,
    AdminTenantRow,
    ManualPaymentRequest,
    ManualPaymentResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/saas-billing/admin", tags=["saas-billing-admin"])


def _require_platform_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_platform_admin") and user.get("role") != "super_admin":
        raise HTTPException(
            status_code=403,
            detail={"code": "platform_admin_required"},
        )
    return user


def _mrr_value_iqd(state: Dict[str, Any]) -> int:
    """Normalize MRR per tenant to whole IQD for sorting/aggregation."""
    slug = state.get("plan_slug")
    if not slug or slug not in PLANS:
        return 0
    plan = get_plan(slug)
    cycle = state.get("billing_cycle") or "monthly"
    currency = (state.get("currency") or "IQD").upper()
    price = plan.price(currency=currency, cycle=cycle)
    if cycle == "annual":
        # Convert to a monthly equivalent for MRR aggregation.
        price = Decimal(price) / Decimal(12)
    if currency == "USD":
        # USD → IQD using a rough 1500 IQD/USD anchor. TODO: pull real FX.
        price = Decimal(price) * Decimal(1500)
    return int(price)


# ── Dashboard KPIs ──────────────────────────────────────────────────────

@router.get("/dashboard", response_model=AdminDashboardResponse)
def get_dashboard(_: dict = Depends(_require_platform_admin)):
    repo = SaasBillingAdminRepository()
    states = list(repo.iter_states())

    counts: Dict[str, int] = defaultdict(int)
    mrr_iqd_sum = 0
    mrr_usd_sum = Decimal("0")
    for s in states:
        st = s.get("status") or "trialing"
        counts[st] += 1
        if st == "active":
            mrr_iqd_sum += _mrr_value_iqd(s)
            # Track USD plans separately for transparency.
            if (s.get("currency") or "IQD").upper() == "USD":
                slug = s.get("plan_slug")
                if slug in PLANS:
                    plan = get_plan(slug)
                    cycle = s.get("billing_cycle") or "monthly"
                    price = plan.price(currency="USD", cycle=cycle)
                    if cycle == "annual":
                        price = Decimal(price) / Decimal(12)
                    mrr_usd_sum += Decimal(price)

    active = counts.get("active", 0)
    trialing = counts.get("trialing", 0)
    cancelled = counts.get("cancelled", 0)
    past_due = counts.get("past_due", 0)
    suspended = counts.get("suspended", 0)

    # Trial-to-paid conversion = active / (active + cancelled + currently trialing).
    denom = active + cancelled + trialing
    conversion = (active / denom) if denom > 0 else 0.0

    # Monthly churn = cancelled / max(1, active + cancelled).
    churn_denom = active + cancelled
    churn = (cancelled / churn_denom) if churn_denom > 0 else 0.0

    return AdminDashboardResponse(
        mrr_iqd=mrr_iqd_sum,
        mrr_usd=mrr_usd_sum,
        arr_iqd=mrr_iqd_sum * 12,
        arr_usd=mrr_usd_sum * Decimal(12),
        active_tenants=active,
        trialing_tenants=trialing,
        past_due_tenants=past_due,
        suspended_tenants=suspended,
        cancelled_tenants=cancelled,
        trial_to_paid_conversion=round(conversion, 4),
        churn_rate_monthly=round(churn, 4),
    )


# ── Tenant list (paginated) ─────────────────────────────────────────────

@router.get("/tenants", response_model=AdminTenantListResponse)
def list_tenants(
    page: int = 1,
    page_size: int = 50,
    status_filter: Optional[str] = None,
    _: dict = Depends(_require_platform_admin),
):
    if page < 1 or page_size < 1 or page_size > 200:
        raise HTTPException(status_code=400, detail={"code": "bad_paging"})
    repo = SaasBillingAdminRepository()
    rows: List[AdminTenantRow] = []
    for s in repo.iter_states():
        if status_filter and s.get("status") != status_filter:
            continue
        rows.append(AdminTenantRow(
            tenant_id=s.get("tenant_id") or "",
            plan_slug=s.get("plan_slug"),
            status=s.get("status"),
            billing_cycle=s.get("billing_cycle"),
            trial_ends_at=_iso(s.get("trial_ends_at")),
            last_payment_at=_iso(s.get("last_payment_at")),
            mrr_value=_mrr_value_iqd(s),
        ))
    rows.sort(key=lambda r: r.mrr_value, reverse=True)
    total = len(rows)
    start = (page - 1) * page_size
    page_items = rows[start:start + page_size]
    return AdminTenantListResponse(
        items=page_items, total=total, page=page, page_size=page_size,
    )


# ── Manual payment recording (Iraqi/cash flows) ─────────────────────────

@router.post("/tenants/{tid}/manual-payment",
             response_model=ManualPaymentResponse)
def record_manual_payment(
    tid: str,
    req: ManualPaymentRequest,
    _: dict = Depends(_require_platform_admin),
):
    repo = TenantBillingRepository(tid)
    if repo.get() is None:
        raise HTTPException(status_code=404, detail={"code": "no_state"})
    new_state = repo.record_payment(payment_method_type=req.provider)
    return ManualPaymentResponse(
        ok=True,
        new_status=new_state["status"],
        recorded_at=datetime.utcnow().isoformat(),
    )


def _iso(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    try:
        return value.isoformat()
    except Exception:
        return str(value)


# Aggregate router export used by ``main.py`` integration.
ALL_ROUTERS = [router]
