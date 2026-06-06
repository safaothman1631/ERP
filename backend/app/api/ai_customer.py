"""Customer-intelligence AI endpoints (Pool 4.6+).

Thin FastAPI surface over :mod:`app.analytics.ai.customer`. Serves per-customer
RFM segments, churn risk, CLV, and AR late-payment risk from the BigQuery
warehouse.

Contract — mirrors :mod:`app.api.forecast`:
  * Each endpoint is gated behind ``get_current_user`` + ``require_perm
    ("reports.read")`` (an existing permission code — no new codes).
  * Each returns ``{"rows": [...], "status": ...}`` and **always** HTTP 200.
    When the warehouse is not configured (``ANALYTICS_BQ_DATASET`` unset), the
    BQ SDK is missing, or BigQuery raises, it degrades to ``rows: []`` with an
    explanatory ``status`` — **never 500**.
  * ``org_id`` comes from the authenticated user and is bound as a BQ query
    parameter downstream (never interpolated into SQL).
"""
from __future__ import annotations

import logging
from typing import Callable

from fastapi import APIRouter, Depends

from app.analytics.ai import customer as ci
from app.services.auth import get_current_user
from app.services.permissions import require_perm

log = logging.getLogger("api.ai_customer")

router = APIRouter(prefix="/api/ai", tags=["AI — Customers"])


def _serve(name: str, fn: Callable[[str], list[dict]], org_id: str) -> dict:
    """Run a customer-AI query, degrading gracefully to an empty result.

    Returns ``{"rows", "status"}``: ``status`` is ``"ok"`` on success,
    ``"warehouse_not_configured"`` when the feature is off, and the same
    not-configured shape (empty rows) on any BQ failure — the endpoint never
    surfaces a 500 for an analytics hiccup.
    """
    if not ci.warehouse_enabled():
        return {"rows": [], "status": ci.STATUS_NOT_CONFIGURED}
    try:
        rows = fn(org_id)
    except Exception as e:  # noqa: BLE001 - never 500 on an analytics failure
        log.warning("ai_customer.%s_failed", name, extra={"org_id": org_id, "err": str(e)})
        return {"rows": [], "status": ci.STATUS_NOT_CONFIGURED}
    return {"rows": rows, "status": ci.STATUS_OK}


@router.get(
    "/customers/segments",
    dependencies=[Depends(require_perm("reports.read"))],
)
def customers_segments(user: dict = Depends(get_current_user)):
    """RFM segments (Champions, Loyal, Potential, New, At-Risk, Lost) per customer."""
    return _serve("segments", ci.rfm_segments, user["org_id"])


@router.get(
    "/customers/churn",
    dependencies=[Depends(require_perm("reports.read"))],
)
def customers_churn(user: dict = Depends(get_current_user)):
    """Churn risk per customer (dormancy vs. their usual purchase cadence)."""
    return _serve("churn", ci.churn_risk, user["org_id"])


@router.get(
    "/customers/clv",
    dependencies=[Depends(require_perm("reports.read"))],
)
def customers_clv(user: dict = Depends(get_current_user)):
    """Customer lifetime value: historical spend + a simple 24-month projection."""
    return _serve("clv", ci.customer_clv, user["org_id"])


@router.get(
    "/customers/ar-risk",
    dependencies=[Depends(require_perm("reports.read"))],
)
def customers_ar_risk(user: dict = Depends(get_current_user)):
    """Open-invoice AR late-payment risk, blended with each customer's history."""
    return _serve("ar_risk", ci.ar_late_risk, user["org_id"])
