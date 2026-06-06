"""Financial-prediction AI on the BigQuery warehouse (Pool 4.6+).

Forward-looking finance models derived from the warehouse facts:

  * **expense_forecast** — a per-org BQML ``ARIMA_PLUS`` model fit on the
    *monthly* expense series in ``fact_bills`` (the AP mirror of the revenue
    model in :mod:`app.api.forecast`). Trained on demand and served from
    ``ML.FORECAST``.
  * **margin_forecast** — projected gross margin: it calls *both* the revenue
    forecast (:func:`app.api.forecast.forecast_revenue`) and the expense
    forecast above, aligns them by period, and reports ``revenue - expense``.
  * **payment_date_prediction** — for each OPEN invoice, a likely payment date
    = invoice date + the org's historical average days-to-settle.

The warehouse is the same one declared in :mod:`app.analytics.warehouse_schema`
(single source of truth for ``project.dataset`` + table names).

Design — mirrors :mod:`app.api.forecast` exactly:
  * **Lazy BigQuery import.** ``google.cloud.bigquery`` is imported inside the
    functions, never at module load, so this module stays importable (and the
    rest of the app boots) on machines without the BQ SDK.
  * **Flag-gated + graceful.** Nothing touches BigQuery unless
    ``ANALYTICS_BQ_DATASET`` is set. If it is unset, the SDK is missing, or BQML
    raises (e.g. not enough history to fit ARIMA), the callers raise and the
    endpoints degrade to an empty list with an explanatory ``status`` —
    **never 500**.

Security:
  * ``org_id`` reaches the SQL only through a bound ``ScalarQueryParameter``
    (``@org_id``) — never string-interpolated into the query text.
  * The per-org BQML model **name** cannot be parameterised (it is an
    identifier), so it is built from the strictly sanitised slug produced by
    :func:`app.api.forecast.org_slug` (``[a-z0-9_]`` only). Raw ``org_id`` is
    never interpolated into any identifier; only the sanitised slug is.
  * ``ML.FORECAST`` settings (horizon, confidence_level) must be literal
    constants — BQML rejects ``@params`` there — so the validated integer
    horizon is inlined directly (it is ``int()``-coerced, so injection-safe).
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

from app.analytics.warehouse_schema import dataset_ref, project_id, table_ref

# Reuse the revenue module's slug sanitiser (SQL-injection boundary for the
# model identifier) and revenue forecast (for the margin projection) so the two
# stay in lock-step. ``org_slug`` is the *only* value derived from ``org_id``
# that is ever interpolated into a BQ identifier. We import the *module* (not a
# bound ``forecast_revenue`` name) and call ``forecast_mod.forecast_revenue`` so
# tests can ``patch.object(forecast, "forecast_revenue", ...)`` and have it take
# effect here (a bound import would not see the patch).
from app.api import forecast as forecast_mod
from app.api.forecast import org_slug

log = logging.getLogger("analytics.ai.financial")

# Statuses returned alongside an empty row list when we degrade gracefully.
STATUS_OK = "ok"
STATUS_NOT_CONFIGURED = "warehouse_not_configured"
STATUS_INSUFFICIENT = "insufficient_data"

# Bill statuses that must NOT count toward real, dated expense (matches the
# draft/void exclusion the revenue model applies to invoices).
_EXCLUDED_STATUSES = "('draft', 'void')"
# OPEN-invoice statuses (still owed) excluded when sampling the settlement lag /
# already-settled invoices: an invoice that is paid or void is no longer open.
_SETTLED_STATUSES = "('paid', 'void')"

# Documented fallback settlement lag (days) used when the org has no paid-invoice
# signal to estimate a typical days-to-settle from.
DEFAULT_SETTLEMENT_DAYS = 30


# ──────────────────────────── helpers ─────────────────────────────


def warehouse_enabled() -> bool:
    """Financial AI only runs when the warehouse dataset is explicitly set.

    ``warehouse_schema.dataset_ref()`` falls back to a default name, but the
    *feature* is gated on the operator having opted in via the env var (same
    contract as :mod:`app.api.forecast`).
    """
    return bool(os.environ.get("ANALYTICS_BQ_DATASET"))


def _bigquery():
    """Return the ``google.cloud.bigquery`` module or ``None`` if unavailable."""
    try:
        from google.cloud import bigquery  # type: ignore

        return bigquery
    except Exception:  # pragma: no cover - lib optional in dev/CI
        log.warning("ai.financial.bigquery_lib_missing — install google-cloud-bigquery")
        return None


def _expense_model_ref(org_id: str) -> str:
    """Fully-qualified ``project.dataset.expense_arima_<slug>`` model name."""
    return f"{dataset_ref()}.expense_arima_{org_slug(org_id)}"


# ── value coercers (BQ Row supports mapping + attribute access; tests use dicts)


def _get(row: Any, name: str) -> Any:
    try:
        return row[name]
    except (KeyError, TypeError, IndexError):
        return getattr(row, name, None)


def _num(v: Any, ndigits: int = 2) -> float:
    try:
        return round(float(v), ndigits)
    except (TypeError, ValueError):
        return 0.0


def _int(v: Any) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def _period_str(value: Any) -> Optional[str]:
    """Coerce a BQ timestamp/date (datetime/date/str) to an ISO string."""
    if value is None:
        return None
    iso = getattr(value, "isoformat", None)
    if callable(iso):
        return iso()
    return str(value)


def _period_key(value: Any) -> Optional[str]:
    """Normalise a forecast period to a ``YYYY-MM`` month key for alignment.

    Revenue and expense forecasts are both *monthly* ARIMA series, but their
    timestamps may differ in time component / formatting. Truncating to the
    year-month makes the two joinable regardless of representation.
    """
    iso = _period_str(value)
    if not iso:
        return None
    return iso[:7]  # 'YYYY-MM'


# ──────────────────────────── SQL builders ────────────────────────
# Standalone builders (no I/O) so tests can assert the SQL is parameterised +
# well-formed without touching BigQuery.


def _expense_train_sql(org_id: str) -> str:
    """``CREATE OR REPLACE MODEL`` DDL for the per-org monthly expense ARIMA_PLUS.

    The AP mirror of ``app.api.forecast._train_sql`` — same model shape, but the
    monthly series is ``SUM(total)`` of ``fact_bills`` (draft/void + null dates
    excluded). ``@org_id`` is bound as a query parameter; the model name uses the
    sanitised slug only.
    """
    return f"""
CREATE OR REPLACE MODEL `{_expense_model_ref(org_id)}`
OPTIONS(
  model_type='ARIMA_PLUS',
  time_series_timestamp_col='month',
  time_series_data_col='expense',
  horizon=12,
  auto_arima=TRUE,
  data_frequency='MONTHLY'
) AS
SELECT
  DATE_TRUNC(date, MONTH) AS month,
  SUM(total) AS expense
FROM `{table_ref("fact_bills")}`
WHERE org_id = @org_id
  AND status NOT IN {_EXCLUDED_STATUSES}
  AND date IS NOT NULL
GROUP BY month
""".strip()


def _expense_forecast_sql(org_id: str, horizon: int) -> str:
    """``ML.FORECAST`` query against the per-org expense model.

    ``horizon`` is inlined as a literal int — ML.FORECAST's settings STRUCT must
    be constants, not query parameters (BQML rejects ``@params`` there). It is a
    validated ``int()``-coerced integer, so inlining is injection-safe.
    """
    return f"""
SELECT
  forecast_timestamp,
  forecast_value,
  prediction_interval_lower_bound,
  prediction_interval_upper_bound
FROM ML.FORECAST(
  MODEL `{_expense_model_ref(org_id)}`,
  STRUCT({int(horizon)} AS horizon, 0.8 AS confidence_level)
)
ORDER BY forecast_timestamp
""".strip()


def _settlement_lag_sql() -> str:
    """Estimate the org's typical days-to-settle from currently-paid invoices.

    PROXY — documented:
        ``fact_invoices`` has **no paid-date column**, so we cannot measure the
        true invoice-date → payment-date interval. As a proxy we take the AGE of
        invoices that are *currently* ``status = 'paid'`` (``CURRENT_DATE - date``)
        and use the **median** age as the org's typical settlement lag. This
        approximates how long, historically, invoices have sat before being
        marked paid. It is only a signal, not an exact measurement; callers fall
        back to :data:`DEFAULT_SETTLEMENT_DAYS` when there is no paid history.

    ``@org_id`` scopes the tenant. The median is clamped to a sane non-negative
    floor downstream.
    """
    return f"""
SELECT
  APPROX_QUANTILES(DATE_DIFF(CURRENT_DATE(), date, DAY), 2)[OFFSET(1)] AS avg_settle_days,
  COUNT(*) AS paid_count
FROM `{table_ref("fact_invoices")}`
WHERE org_id = @org_id
  AND status = 'paid'
  AND date IS NOT NULL
""".strip()


def _open_invoices_sql() -> str:
    """OPEN invoices (``balance_due > 0`` and status not paid/void) for an org.

    Returns one row per open invoice with the invoice ``date`` and ``days_open``
    (age since the invoice date — a proxy for how overdue it might be, since the
    fact table has no due-date column). ``@org_id`` scopes the tenant.
    """
    return f"""
SELECT
  id AS invoice_id,
  contact_name AS customer,
  balance_due,
  date AS invoice_date,
  DATE_DIFF(CURRENT_DATE(), date, DAY) AS days_open
FROM `{table_ref("fact_invoices")}`
WHERE org_id = @org_id
  AND balance_due > 0
  AND status NOT IN {_SETTLED_STATUSES}
  AND date IS NOT NULL
ORDER BY date ASC
""".strip()


# ──────────────────────────── row mappers ─────────────────────────


def _row_to_point(row: Any) -> dict:
    """Map one ML.FORECAST row -> ``{period, forecast, lower, upper}``."""
    return {
        "period": _period_str(_get(row, "forecast_timestamp")),
        "forecast": _num(_get(row, "forecast_value")),
        "lower": _num(_get(row, "prediction_interval_lower_bound")),
        "upper": _num(_get(row, "prediction_interval_upper_bound")),
    }


# ──────────────────────────── core logic ──────────────────────────


def train_expense_model(org_id: str) -> None:
    """Train (CREATE OR REPLACE) the per-org ARIMA_PLUS expense model.

    Raises on a BQ/BQML error so callers can decide how to degrade. Assumes the
    caller has already verified :func:`warehouse_enabled` and a live BQ client.
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
    client.query(_expense_train_sql(org_id), job_config=job_config).result()


def expense_forecast(org_id: str, periods: int = 6) -> list[dict]:
    """Return monthly expense forecast points, training the model on demand.

    Tries ``ML.FORECAST`` first; if the model does not exist yet, trains it and
    retries once. Any BQML error (including "not enough data to fit") propagates
    so the endpoint can return ``insufficient_data`` rather than a 500.

    Returns a list of ``{period, forecast, lower, upper}`` dicts.
    """
    bigquery = _bigquery()
    if bigquery is None:
        raise RuntimeError("google-cloud-bigquery not available")
    client = bigquery.Client(project=project_id())
    horizon = max(1, int(periods))

    def _run() -> list[dict]:
        rows = client.query(_expense_forecast_sql(org_id, horizon)).result()
        return [_row_to_point(r) for r in rows]

    try:
        return _run()
    except Exception as first_err:  # noqa: BLE001 - model likely not trained yet
        log.info(
            "ai.financial.expense_model_miss — training on demand",
            extra={"org_id": org_id, "err": str(first_err)},
        )
        # Train (may raise on insufficient history -> caller degrades), retry.
        train_expense_model(org_id)
        return _run()


def margin_forecast(org_id: str, periods: int = 6) -> list[dict]:
    """Projected gross margin = revenue forecast − expense forecast, by period.

    Calls *both* :func:`app.api.forecast.forecast_revenue` and
    :func:`expense_forecast`, aligns the two monthly series by their
    year-month key, and returns ``{period, revenue, expense, margin}`` for each
    aligned period.

    Degrades gracefully if *either* side is insufficient: a side that raises (or
    returns nothing) is treated as an empty series, so the missing component
    contributes 0 to that period. If neither side yields any period, the result
    is an empty list (the endpoint then reports ``insufficient_data``).
    """
    horizon = max(1, int(periods))

    def _safe(fn) -> list[dict]:
        try:
            return fn() or []
        except Exception as e:  # noqa: BLE001 - one side may be insufficient
            log.info(
                "ai.financial.margin_side_unavailable",
                extra={"org_id": org_id, "err": str(e)},
            )
            return []

    revenue_pts = _safe(lambda: forecast_mod.forecast_revenue(org_id, periods=horizon))
    expense_pts = _safe(lambda: expense_forecast(org_id, periods=horizon))

    # Index each side by month key. Preserve a representative ISO period label
    # per key (first seen) and the original ordering so the output is stable.
    order: list[str] = []
    rev_by_key: dict[str, float] = {}
    exp_by_key: dict[str, float] = {}
    label_by_key: dict[str, str] = {}

    def _ingest(points: list[dict], sink: dict[str, float]) -> None:
        for pt in points:
            key = _period_key(pt.get("period"))
            if key is None:
                continue
            if key not in label_by_key:
                label_by_key[key] = pt.get("period") or key
                order.append(key)
            sink[key] = _num(pt.get("forecast"))

    _ingest(revenue_pts, rev_by_key)
    _ingest(expense_pts, exp_by_key)

    order.sort()  # chronological by 'YYYY-MM'
    out: list[dict] = []
    for key in order:
        revenue = rev_by_key.get(key, 0.0)
        expense = exp_by_key.get(key, 0.0)
        out.append(
            {
                "period": label_by_key.get(key, key),
                "revenue": _num(revenue),
                "expense": _num(expense),
                "margin": _num(revenue - expense),
            }
        )
    return out


def payment_date_prediction(org_id: str) -> list[dict]:
    """Predict a likely payment date for each OPEN invoice.

    ``predicted_payment_date = invoice_date + avg_days_to_settle`` where the lag
    is the org's typical settlement time.

    PROXY (documented): ``fact_invoices`` has **no paid-date column**, so the
    true invoice→payment interval is unknown. We estimate the org's typical lag
    from the **median age of currently-paid invoices** (``CURRENT_DATE - date``
    for ``status = 'paid'`` — see :func:`_settlement_lag_sql`). When the org has
    no paid-invoice signal, we fall back to :data:`DEFAULT_SETTLEMENT_DAYS`
    (30 days).

    Returns ``{invoice_id, customer, balance_due, invoice_date,
    predicted_payment_date, days_overdue}`` per open invoice. ``days_overdue`` is
    how far the *predicted* payment date is already in the past (0 if it is in
    the future).
    """
    from datetime import date as _date, timedelta

    bigquery = _bigquery()
    if bigquery is None:
        raise RuntimeError("google-cloud-bigquery not available")
    client = bigquery.Client(project=project_id())

    def _job_config():
        return bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("org_id", "STRING", str(org_id)),
            ]
        )

    # 1) Estimate the org's typical settlement lag (median age of paid invoices).
    lag_rows = list(client.query(_settlement_lag_sql(), job_config=_job_config()).result())
    avg_days = DEFAULT_SETTLEMENT_DAYS
    if lag_rows:
        paid_count = _int(_get(lag_rows[0], "paid_count"))
        if paid_count > 0:
            candidate = _get(lag_rows[0], "avg_settle_days")
            if candidate is not None:
                # Clamp to a sane non-negative lag; 0-day medians fall back too.
                est = max(0, _int(candidate))
                avg_days = est if est > 0 else DEFAULT_SETTLEMENT_DAYS

    # 2) Open invoices -> predicted payment date = invoice_date + avg_days.
    open_rows = client.query(_open_invoices_sql(), job_config=_job_config()).result()
    today = _date.today()
    out: list[dict] = []
    for row in open_rows:
        inv_date_raw = _get(row, "invoice_date")
        inv_iso = _period_str(inv_date_raw)
        predicted_iso: Optional[str] = None
        days_overdue = 0
        inv_d = _coerce_date(inv_date_raw)
        if inv_d is not None:
            predicted = inv_d + timedelta(days=avg_days)
            predicted_iso = predicted.isoformat()
            days_overdue = max(0, (today - predicted).days)
        out.append(
            {
                "invoice_id": _str(_get(row, "invoice_id")),
                "customer": _str(_get(row, "customer")),
                "balance_due": _num(_get(row, "balance_due")),
                "invoice_date": inv_iso,
                "predicted_payment_date": predicted_iso,
                "days_overdue": days_overdue,
            }
        )
    return out


# ── small coercers used by payment_date_prediction ─────────────────


def _str(v: Any) -> Optional[str]:
    if v is None:
        return None
    iso = getattr(v, "isoformat", None)
    if callable(iso):
        return iso()
    return str(v)


def _coerce_date(v: Any):
    """Coerce a BQ date/datetime/'YYYY-MM-DD' string to a ``datetime.date``."""
    from datetime import date as _date, datetime as _datetime

    if isinstance(v, _datetime):
        return v.date()
    if isinstance(v, _date):
        return v
    if isinstance(v, str) and len(v) >= 10:
        try:
            return _date.fromisoformat(v[:10])
        except ValueError:
            return None
    return None
