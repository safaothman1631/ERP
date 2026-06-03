"""AI/ML revenue + cash-flow forecasting on the BigQuery warehouse (Pool 4.6).

Trains a **per-org BQML ``ARIMA_PLUS``** model from the monthly revenue series in
``fact_invoices`` and serves forecasts from ``ML.FORECAST``. The warehouse is the
same one declared in :mod:`app.analytics.warehouse_schema` (single source of
truth for ``project.dataset`` + table names).

Design — mirrors :mod:`app.services.rum_ingest`:
  * **Lazy BigQuery import.** ``google.cloud.bigquery`` is imported inside the
    functions, never at module load, so this module stays importable (and the
    rest of the app boots) on machines without the BQ SDK.
  * **Flag-gated + graceful.** Nothing touches BigQuery unless
    ``ANALYTICS_BQ_DATASET`` is set. If it is unset, the SDK is missing, or BQML
    raises (e.g. not enough history to fit ARIMA), the endpoints return HTTP 200
    with an empty ``points`` list and a ``status`` explaining why — **never 500**.

Security:
  * ``org_id`` reaches the SQL only through a bound ``ScalarQueryParameter`` —
    never string-interpolated into the query text.
  * The per-org BQML model **name** cannot be parameterised (it is an
    identifier), so it is built from a strictly sanitised slug
    (``[a-z0-9_]`` only). Raw ``org_id`` is never interpolated into any
    identifier; only the sanitised slug is.

Endpoints (prefix ``/api/analytics``):
    GET /api/analytics/forecast/revenue?periods=N    monthly revenue forecast
    GET /api/analytics/forecast/cashflow?days=N       naive cash-in projection
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from app.analytics.warehouse_schema import dataset_ref, project_id, table_ref
from app.services.auth import get_current_user
from app.services.permissions import require_perm

log = logging.getLogger("analytics.forecast")

router = APIRouter(prefix="/api/analytics", tags=["Analytics — Forecast"])

# Statuses returned alongside an empty point list when we degrade gracefully.
STATUS_OK = "ok"
STATUS_NOT_CONFIGURED = "warehouse_not_configured"
STATUS_INSUFFICIENT = "insufficient_data"

_SLUG_RE = re.compile(r"[^a-z0-9_]+")


# ──────────────────────────── helpers ─────────────────────────────


def _warehouse_enabled() -> bool:
    """Forecasting only runs when the warehouse dataset is explicitly set.

    ``warehouse_schema.dataset_ref()`` falls back to a default name, but the
    *feature* is gated on the operator having opted in via the env var (same
    contract as ``app/analytics/__init__`` and the rum ingest service).
    """
    return bool(os.environ.get("ANALYTICS_BQ_DATASET"))


def org_slug(org_id: str) -> str:
    """Sanitise an ``org_id`` into a BQML-identifier-safe slug.

    Only ``[a-z0-9_]`` survive; everything else collapses to ``_``. This is the
    *only* value derived from ``org_id`` that is ever interpolated into a BQ
    identifier, so it is the SQL-injection boundary for the model name. An
    ``org_id`` that sanitises to empty (or would be unstable) is replaced by a
    deterministic hash so every org still maps to a distinct, valid model name.
    """
    raw = str(org_id or "")
    slug = _SLUG_RE.sub("_", raw.lower()).strip("_")
    if not slug:
        slug = "org_" + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]
    # Guard against pathological length (BQ identifiers are bounded); keep a
    # hash suffix so distinct long ids never collide after truncation.
    if len(slug) > 48:
        slug = slug[:36] + "_" + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:8]
    return slug


def _model_ref(org_id: str) -> str:
    """Fully-qualified ``project.dataset.revenue_arima_<slug>`` model name."""
    return f"{dataset_ref()}.revenue_arima_{org_slug(org_id)}"


def _bigquery():
    """Return the ``google.cloud.bigquery`` module or ``None`` if unavailable."""
    try:
        from google.cloud import bigquery  # type: ignore

        return bigquery
    except Exception:  # pragma: no cover - lib optional in dev/CI
        log.warning("forecast.bigquery_lib_missing — install google-cloud-bigquery")
        return None


def _train_sql(org_id: str) -> str:
    """``CREATE OR REPLACE MODEL`` DDL for the per-org monthly ARIMA_PLUS model.

    ``@org_id`` is bound as a query parameter; the model name uses the sanitised
    slug only. Draft/void invoices and null dates are excluded so the series
    reflects real, dated revenue.
    """
    return f"""
CREATE OR REPLACE MODEL `{_model_ref(org_id)}`
OPTIONS(
  model_type='ARIMA_PLUS',
  time_series_timestamp_col='month',
  time_series_data_col='revenue',
  horizon=12,
  auto_arima=TRUE,
  data_frequency='MONTHLY'
) AS
SELECT
  DATE_TRUNC(date, MONTH) AS month,
  SUM(total) AS revenue
FROM `{table_ref("fact_invoices")}`
WHERE org_id = @org_id
  AND status NOT IN ('draft', 'void')
  AND date IS NOT NULL
GROUP BY month
""".strip()


def _forecast_sql(org_id: str, horizon: int) -> str:
    """``ML.FORECAST`` query against the per-org model. ``horizon`` is inlined as
    a literal int — ML.FORECAST's settings STRUCT must be constants, not query
    parameters (BQML rejects @params there). It is a validated 1..24 integer
    (``int()`` coerced), so inlining is injection-safe."""
    return f"""
SELECT
  forecast_timestamp,
  forecast_value,
  prediction_interval_lower_bound,
  prediction_interval_upper_bound
FROM ML.FORECAST(
  MODEL `{_model_ref(org_id)}`,
  STRUCT({int(horizon)} AS horizon, 0.8 AS confidence_level)
)
ORDER BY forecast_timestamp
""".strip()


def _period_str(value: Any) -> Optional[str]:
    """Coerce a BQ forecast_timestamp (datetime/date/str) to an ISO string."""
    if value is None:
        return None
    iso = getattr(value, "isoformat", None)
    if callable(iso):
        return iso()
    return str(value)


def _row_to_point(row: Any) -> dict:
    """Map one ML.FORECAST row -> ``{period, forecast, lower, upper}``.

    BQ ``Row`` objects support both attribute and mapping access; tests use a
    plain dict, so we read via ``[]`` with attribute fallback.
    """

    def _get(name: str) -> Any:
        try:
            return row[name]
        except (KeyError, TypeError, IndexError):
            return getattr(row, name, None)

    def _num(v: Any) -> float:
        try:
            return round(float(v), 2)
        except (TypeError, ValueError):
            return 0.0

    return {
        "period": _period_str(_get("forecast_timestamp")),
        "forecast": _num(_get("forecast_value")),
        "lower": _num(_get("prediction_interval_lower_bound")),
        "upper": _num(_get("prediction_interval_upper_bound")),
    }


# ─────────────────────────── core logic ───────────────────────────


def train_revenue_model(org_id: str) -> None:
    """Train (CREATE OR REPLACE) the per-org ARIMA_PLUS revenue model.

    Raises on a BQ/BQML error so callers can decide how to degrade. Assumes the
    caller has already verified ``_warehouse_enabled()`` and a live BQ client.
    """
    bigquery = _bigquery()
    if bigquery is None:
        raise RuntimeError("google-cloud-bigquery not available")
    client = bigquery.Client(project=project_id())
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", str(org_id)),
        ]
    )
    client.query(_train_sql(org_id), job_config=job_config).result()


def forecast_revenue(org_id: str, periods: int = 6) -> list[dict]:
    """Return monthly revenue forecast points, training the model on demand.

    Tries ``ML.FORECAST`` first; if the model does not exist yet, trains it and
    retries once. Any BQML error (including "not enough data to fit") propagates
    so the endpoint can return ``insufficient_data`` rather than a 500.
    """
    bigquery = _bigquery()
    if bigquery is None:
        raise RuntimeError("google-cloud-bigquery not available")
    client = bigquery.Client(project=project_id())
    horizon = max(1, int(periods))

    def _run() -> list[dict]:
        rows = client.query(_forecast_sql(org_id, horizon)).result()
        return [_row_to_point(r) for r in rows]

    try:
        return _run()
    except Exception as first_err:  # noqa: BLE001 - model likely not trained yet
        log.info(
            "forecast.model_miss — training on demand",
            extra={"org_id": org_id, "err": str(first_err)},
        )
        # Train (may raise on insufficient history -> caller degrades), retry.
        train_revenue_model(org_id)
        return _run()


def _cashflow_projection(org_id: str, days: int) -> list[dict]:
    """Naive forward cash-in projection from outstanding ``balance_due``.

    Not an ML model: it spreads the currently-open receivables evenly across the
    requested window as a simple daily expected cash-in. Returns one point per
    bucket ``{period, forecast, lower, upper}`` so the shape matches the revenue
    endpoint.
    """
    bigquery = _bigquery()
    if bigquery is None:
        raise RuntimeError("google-cloud-bigquery not available")
    client = bigquery.Client(project=project_id())
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", str(org_id)),
        ]
    )
    sql = f"""
SELECT COALESCE(SUM(balance_due), 0) AS outstanding
FROM `{table_ref("fact_invoices")}`
WHERE org_id = @org_id
  AND status NOT IN ('draft', 'void')
  AND balance_due > 0
""".strip()
    rows = list(client.query(sql, job_config=job_config).result())
    outstanding = 0.0
    if rows:
        try:
            outstanding = float(rows[0]["outstanding"])
        except (KeyError, TypeError, ValueError, IndexError):
            outstanding = float(getattr(rows[0], "outstanding", 0) or 0)

    horizon = max(1, int(days))
    per_day = round(outstanding / horizon, 2) if horizon else 0.0
    return [
        {
            "period": f"day_{i + 1}",
            "forecast": per_day,
            "lower": round(per_day * 0.7, 2),
            "upper": round(per_day * 1.3, 2),
        }
        for i in range(horizon)
    ]


# ───────────────────────────── routes ─────────────────────────────


@router.get(
    "/forecast/revenue",
    dependencies=[Depends(require_perm("reports.read"))],
)
def revenue_forecast_endpoint(
    periods: int = Query(6, ge=1, le=24, description="Months to forecast (1..24)"),
    user: dict = Depends(get_current_user),
):
    """Per-org monthly revenue forecast via BQML ARIMA_PLUS.

    Always returns HTTP 200. Degrades to an empty ``points`` list with an
    explanatory ``status`` when the warehouse is not configured, the BQ SDK is
    missing, or there is not enough history to train the model.
    """
    org_id = user["org_id"]
    base = {
        "org_id": org_id,
        "periods": periods,
        "model": "bqml_arima_plus",
    }
    if not _warehouse_enabled():
        return {**base, "points": [], "status": STATUS_NOT_CONFIGURED}
    try:
        points = forecast_revenue(org_id, periods=periods)
    except Exception as e:  # noqa: BLE001 - never 500 on a forecasting failure
        log.warning(
            "forecast.revenue_failed", extra={"org_id": org_id, "err": str(e)}
        )
        return {**base, "points": [], "status": STATUS_INSUFFICIENT}
    return {**base, "points": points, "status": STATUS_OK}


@router.get(
    "/forecast/cashflow",
    dependencies=[Depends(require_perm("reports.read"))],
)
def cashflow_forecast_endpoint(
    days: int = Query(30, ge=1, le=365, description="Days to project (1..365)"),
    user: dict = Depends(get_current_user),
):
    """Naive cash-in projection from outstanding receivables (``balance_due``).

    Simpler than the revenue model (no ML); same graceful-degradation contract
    and the same ``{period, forecast, lower, upper}`` point shape.
    """
    org_id = user["org_id"]
    base = {"org_id": org_id, "days": days, "model": "naive_balance_projection"}
    if not _warehouse_enabled():
        return {**base, "points": [], "status": STATUS_NOT_CONFIGURED}
    try:
        points = _cashflow_projection(org_id, days)
    except Exception as e:  # noqa: BLE001 - never 500
        log.warning(
            "forecast.cashflow_failed", extra={"org_id": org_id, "err": str(e)}
        )
        return {**base, "points": [], "status": STATUS_INSUFFICIENT}
    return {**base, "points": points, "status": STATUS_OK}
