"""Demand & inventory prediction AI endpoints (Pool 4.6+).

Thin FastAPI surface over :mod:`app.analytics.ai.inventory`. Serves per-item
demand forecasts (BQML ARIMA_PLUS), reorder suggestions, stockout prediction,
ABC analysis, and dead-stock detection from the BigQuery warehouse.

Contract — mirrors :mod:`app.api.forecast` and :mod:`app.api.ai_customer`:
  * Each endpoint is gated behind ``get_current_user`` + ``require_perm
    ("reports.read")`` (an existing permission code — no new codes).
  * Each returns ``{"rows": [...], "status": ...}`` and **always** HTTP 200.
    When the warehouse is not configured (``ANALYTICS_BQ_DATASET`` unset), the
    BQ SDK is missing, or BigQuery raises, it degrades to ``rows: []`` with an
    explanatory ``status`` — **never 500**. The demand-forecast endpoint uses
    ``insufficient_data`` for a model/training failure (the BQML model may not
    have enough history); the snapshot-based endpoints use the
    not-configured shape on any BQ failure.
  * ``org_id`` comes from the authenticated user and is bound as a BQ query
    parameter downstream (never interpolated into SQL).

Paths live under ``/api/ai/inventory/*`` to avoid colliding with the sibling
``/api/ai/*`` routers (``/ask``, ``/insights``, ``/anomalies/*``,
``/customers/*``).
"""
from __future__ import annotations

import logging
from typing import Callable

from fastapi import APIRouter, Depends, Query

from app.analytics.ai import inventory as inv
from app.services.auth import get_current_user
from app.services.permissions import require_perm

log = logging.getLogger("api.ai_inventory")

router = APIRouter(prefix="/api/ai", tags=["AI — Inventory"])


def _serve(name: str, fn: Callable[[str], list[dict]], org_id: str) -> dict:
    """Run a snapshot-based inventory query, degrading gracefully to empty.

    Returns ``{"rows", "status"}``: ``status`` is ``"ok"`` on success,
    ``"warehouse_not_configured"`` when the feature is off, and the same
    not-configured shape (empty rows) on any BQ failure — the endpoint never
    surfaces a 500 for an analytics hiccup.
    """
    if not inv.warehouse_enabled():
        return {"rows": [], "status": inv.STATUS_NOT_CONFIGURED}
    try:
        rows = fn(org_id)
    except Exception as e:  # noqa: BLE001 - never 500 on an analytics failure
        log.warning("ai_inventory.%s_failed", name, extra={"org_id": org_id, "err": str(e)})
        return {"rows": [], "status": inv.STATUS_NOT_CONFIGURED}
    return {"rows": rows, "status": inv.STATUS_OK}


@router.get(
    "/inventory/demand-forecast",
    dependencies=[Depends(require_perm("reports.read"))],
)
def inventory_demand_forecast(
    periods: int = Query(3, ge=1, le=24, description="Months to forecast (1..24)"),
    user: dict = Depends(get_current_user),
):
    """Per-item monthly demand forecast via a single BQML ARIMA_PLUS model.

    Always returns HTTP 200. Degrades to an empty ``rows`` list with an
    explanatory ``status`` when the warehouse is not configured, the BQ SDK is
    missing, or there is not enough history to train the model
    (``insufficient_data``).
    """
    org_id = user["org_id"]
    if not inv.warehouse_enabled():
        return {"rows": [], "status": inv.STATUS_NOT_CONFIGURED}
    try:
        rows = inv.demand_forecast(org_id, periods=periods)
    except Exception as e:  # noqa: BLE001 - never 500; model may lack history
        log.warning(
            "ai_inventory.demand_forecast_failed",
            extra={"org_id": org_id, "err": str(e)},
        )
        return {"rows": [], "status": inv.STATUS_INSUFFICIENT}
    return {"rows": rows, "status": inv.STATUS_OK}


@router.get(
    "/inventory/reorder",
    dependencies=[Depends(require_perm("reports.read"))],
)
def inventory_reorder(user: dict = Depends(get_current_user)):
    """Items at/below (or about to drop below) their reorder point + suggested qty."""
    return _serve("reorder", inv.reorder_suggestions, user["org_id"])


@router.get(
    "/inventory/stockout",
    dependencies=[Depends(require_perm("reports.read"))],
)
def inventory_stockout(user: dict = Depends(get_current_user)):
    """Per-item days-until-stockout + predicted stockout date (tracked items only)."""
    return _serve("stockout", inv.stockout_prediction, user["org_id"])


@router.get(
    "/inventory/abc",
    dependencies=[Depends(require_perm("reports.read"))],
)
def inventory_abc(user: dict = Depends(get_current_user)):
    """ABC (Pareto) classification of items by revenue contribution."""
    return _serve("abc", inv.abc_analysis, user["org_id"])


@router.get(
    "/inventory/dead-stock",
    dependencies=[Depends(require_perm("reports.read"))],
)
def inventory_dead_stock(
    days: int = Query(90, ge=1, le=3650, description="No-sale window in days (1..3650)"),
    user: dict = Depends(get_current_user),
):
    """Items holding stock that have not sold in the last ``days`` days."""
    org_id = user["org_id"]
    return _serve("dead_stock", lambda oid: inv.dead_stock(oid, days=days), org_id)
