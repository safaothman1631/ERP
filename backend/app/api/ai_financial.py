"""Financial-prediction AI endpoints (Pool 4.6+).

Thin FastAPI surface over :mod:`app.analytics.ai.financial`. Serves forward
finance models from the BigQuery warehouse:

    GET /api/ai/predict/expenses?periods=N    monthly expense forecast (BQML ARIMA)
    GET /api/ai/predict/margin?periods=N       projected gross margin (revenue − expense)
    GET /api/ai/predict/payment-dates          likely payment date per OPEN invoice

Contract — mirrors :mod:`app.api.forecast` and :mod:`app.api.ai_customer`:
  * Each endpoint is gated behind ``get_current_user`` + ``require_perm
    ("reports.read")`` (an existing permission code — no new codes).
  * Each returns ``{"rows"|"points": [...], "status": ...}`` and **always**
    HTTP 200. When the warehouse is not configured (``ANALYTICS_BQ_DATASET``
    unset), the BQ SDK is missing, or BigQuery/BQML raises (e.g. not enough
    history to fit ARIMA), it degrades to an empty list with an explanatory
    ``status`` — **never 500**.
  * ``org_id`` comes from the authenticated user and is bound as a BQ query
    parameter downstream (never interpolated into SQL).

Paths intentionally live under ``/api/ai/predict/*`` to avoid colliding with the
existing ``/api/ai/*`` routes (``/customers/*``, ``/anomalies/*``, ``/ask``,
``/insights``) and the ``/api/analytics/forecast/*`` revenue/cashflow routes.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query

from app.analytics.ai import financial as fin
from app.services.auth import get_current_user
from app.services.permissions import require_perm

log = logging.getLogger("api.ai_financial")

router = APIRouter(prefix="/api/ai", tags=["AI — Financial Forecast"])


@router.get(
    "/predict/expenses",
    dependencies=[Depends(require_perm("reports.read"))],
)
def predict_expenses_endpoint(
    periods: int = Query(6, ge=1, le=24, description="Months to forecast (1..24)"),
    user: dict = Depends(get_current_user),
):
    """Per-org monthly expense forecast via BQML ARIMA_PLUS on ``fact_bills``.

    Always returns HTTP 200. Degrades to an empty ``points`` list with an
    explanatory ``status`` when the warehouse is not configured, the BQ SDK is
    missing, or there is not enough history to train the model.
    """
    org_id = user["org_id"]
    base = {"org_id": org_id, "periods": periods, "model": "bqml_arima_plus"}
    if not fin.warehouse_enabled():
        return {**base, "points": [], "status": fin.STATUS_NOT_CONFIGURED}
    try:
        points = fin.expense_forecast(org_id, periods=periods)
    except Exception as e:  # noqa: BLE001 - never 500 on a forecasting failure
        log.warning(
            "ai_financial.expenses_failed", extra={"org_id": org_id, "err": str(e)}
        )
        return {**base, "points": [], "status": fin.STATUS_INSUFFICIENT}
    return {**base, "points": points, "status": fin.STATUS_OK}


@router.get(
    "/predict/margin",
    dependencies=[Depends(require_perm("reports.read"))],
)
def predict_margin_endpoint(
    periods: int = Query(6, ge=1, le=24, description="Months to forecast (1..24)"),
    user: dict = Depends(get_current_user),
):
    """Projected gross margin: revenue forecast − expense forecast, by period.

    Always returns HTTP 200. Degrades to an empty ``points`` list when the
    warehouse is off or *both* the revenue and expense series are insufficient
    (a single missing side is tolerated — it contributes 0 to its periods).
    """
    org_id = user["org_id"]
    base = {"org_id": org_id, "periods": periods, "model": "revenue_minus_expense"}
    if not fin.warehouse_enabled():
        return {**base, "points": [], "status": fin.STATUS_NOT_CONFIGURED}
    try:
        points = fin.margin_forecast(org_id, periods=periods)
    except Exception as e:  # noqa: BLE001 - never 500
        log.warning(
            "ai_financial.margin_failed", extra={"org_id": org_id, "err": str(e)}
        )
        return {**base, "points": [], "status": fin.STATUS_INSUFFICIENT}
    # Both sides insufficient -> empty alignment -> report insufficient_data.
    status = fin.STATUS_OK if points else fin.STATUS_INSUFFICIENT
    return {**base, "points": points, "status": status}


@router.get(
    "/predict/payment-dates",
    dependencies=[Depends(require_perm("reports.read"))],
)
def predict_payment_dates_endpoint(user: dict = Depends(get_current_user)):
    """Predict a likely payment date for each OPEN invoice.

    ``predicted_payment_date = invoice_date + org's avg days-to-settle`` (the lag
    is estimated from the median age of currently-paid invoices, falling back to
    30 days when there is no paid history — see
    :mod:`app.analytics.ai.financial`). Always HTTP 200; degrades to empty
    ``rows`` with a status when the warehouse is off or BigQuery raises.
    """
    org_id = user["org_id"]
    base = {"org_id": org_id, "model": "settlement_lag_proxy"}
    if not fin.warehouse_enabled():
        return {**base, "rows": [], "status": fin.STATUS_NOT_CONFIGURED}
    try:
        rows = fin.payment_date_prediction(org_id)
    except Exception as e:  # noqa: BLE001 - never 500
        log.warning(
            "ai_financial.payment_dates_failed",
            extra={"org_id": org_id, "err": str(e)},
        )
        return {**base, "rows": [], "status": fin.STATUS_INSUFFICIENT}
    return {**base, "rows": rows, "status": fin.STATUS_OK}
