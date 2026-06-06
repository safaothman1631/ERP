"""Demand & inventory prediction AI on the BigQuery warehouse (Pool 4.6+).

Derives item-level operational intelligence from the warehouse:
  * **demand_forecast** — per-item monthly demand via a single BQML
    ``ARIMA_PLUS`` model that forecasts *all* items at once
    (``time_series_id_col='item_id'``), trained on the monthly sold-quantity
    series in ``fact_invoice_lines``.
  * **reorder_suggestions** — join the live stock snapshot (``fact_items``) with
    each item's recent demand rate and flag what to reorder (and how much).
  * **stockout_prediction** — days-until-stockout from a daily demand rate vs.
    current stock, plus the projected stockout date.
  * **abc_analysis** — Pareto revenue classification (A=top 80%, B=next 15%,
    C=last 5%).
  * **dead_stock** — items holding stock that have not sold in ``days`` days.

The warehouse is the same one declared in
:mod:`app.analytics.warehouse_schema` (single source of truth for
``project.dataset`` + table names).

Design — mirrors :mod:`app.api.forecast` and :mod:`app.analytics.ai.customer`:
  * **Lazy BigQuery import.** ``google.cloud.bigquery`` is imported inside the
    functions, never at module load, so this module stays importable (and the
    rest of the app boots) on machines without the BQ SDK.
  * **Flag-gated + graceful.** Nothing touches BigQuery unless
    ``ANALYTICS_BQ_DATASET`` is set. If it is unset, the SDK is missing, or BQ
    raises, the callers return an empty list with an explanatory ``status`` —
    **never 500**.

Security:
  * ``org_id`` reaches the SQL only through a bound ``ScalarQueryParameter``
    (``@org_id``) — never string-interpolated into the query text.
  * The per-org BQML model **name** cannot be parameterised (it is an
    identifier), so it is built from a strictly sanitised slug (``[a-z0-9_]``
    only) via :func:`app.api.forecast.org_slug`. Raw ``org_id`` is never
    interpolated into any identifier; only the sanitised slug is.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Callable, Optional

from app.analytics.warehouse_schema import dataset_ref, project_id, table_ref
from app.api.forecast import org_slug

log = logging.getLogger("analytics.ai.inventory")

# Statuses returned alongside an empty row list when we degrade gracefully.
STATUS_OK = "ok"
STATUS_NOT_CONFIGURED = "warehouse_not_configured"
STATUS_INSUFFICIENT = "insufficient_data"

# Sold lines that must NOT count toward real demand (unconfirmed / cancelled).
_EXCLUDED_STATUSES = "('draft', 'void')"


# ──────────────────────────── helpers ─────────────────────────────


def warehouse_enabled() -> bool:
    """Inventory AI only runs when the warehouse dataset is explicitly set.

    ``warehouse_schema.dataset_ref()`` falls back to a default name, but the
    *feature* is gated on the operator having opted in via the env var (same
    contract as :mod:`app.api.forecast` and :mod:`app.analytics.ai.customer`).
    """
    return bool(os.environ.get("ANALYTICS_BQ_DATASET"))


def _bigquery():
    """Return the ``google.cloud.bigquery`` module or ``None`` if unavailable."""
    try:
        from google.cloud import bigquery  # type: ignore

        return bigquery
    except Exception:  # pragma: no cover - lib optional in dev/CI
        log.warning("ai.inventory.bigquery_lib_missing — install google-cloud-bigquery")
        return None


def _run_org_query(sql: str, org_id: str, mapper: Callable[[Any], dict]) -> list[dict]:
    """Execute ``sql`` with ``@org_id`` bound, mapping each row via ``mapper``.

    The project-pinned client bills jobs to the warehouse project explicitly
    (not an ambient ADC default). ``org_id`` is passed *only* as a bound
    ``ScalarQueryParameter`` — it never appears in the SQL text. Raises on a
    BQ error so callers can decide how to degrade (they return empty + a status,
    never 500).
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
    rows = client.query(sql, job_config=job_config).result()
    return [mapper(r) for r in rows]


def _get(row: Any, name: str) -> Any:
    """Read a column from a BQ ``Row`` (mapping access) or a plain dict/obj.

    BQ ``Row`` objects support both attribute and mapping access; tests use
    plain dicts, so we read via ``[]`` with an attribute fallback.
    """
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


def _str(v: Any) -> Optional[str]:
    if v is None:
        return None
    iso = getattr(v, "isoformat", None)
    if callable(iso):
        return iso()
    return str(v)


# ──────────────────────────── model name (BQML) ───────────────────


def _demand_model_ref(org_id: str) -> str:
    """Fully-qualified ``project.dataset.demand_arima_<slug>`` model name.

    Uses :func:`app.api.forecast.org_slug` so the SQL-injection boundary for the
    identifier is identical to the proven revenue-forecast module: raw ``org_id``
    never reaches an identifier — only the ``[a-z0-9_]`` slug does.
    """
    return f"{dataset_ref()}.demand_arima_{org_slug(org_id)}"


# ──────────────────────────── SQL builders ────────────────────────
# Kept as standalone builders (no I/O) so tests can assert the SQL is
# parameterised + well-formed without touching BigQuery.


def _demand_train_sql(org_id: str) -> str:
    """``CREATE OR REPLACE MODEL`` DDL for the per-org, all-items demand model.

    ONE ``ARIMA_PLUS`` model forecasts every item at once via
    ``time_series_id_col='item_id'`` (far cheaper than one model per item). The
    series is monthly summed sold quantity per item from ``fact_invoice_lines``.
    ``@org_id`` is bound as a query parameter; the model name uses the sanitised
    slug only. Draft/void lines, null dates, and null item ids are excluded so
    the series reflects real, dated, item-attributable demand.
    """
    return f"""
CREATE OR REPLACE MODEL `{_demand_model_ref(org_id)}`
OPTIONS(
  model_type='ARIMA_PLUS',
  time_series_timestamp_col='month',
  time_series_data_col='demand',
  time_series_id_col='item_id',
  horizon=12,
  auto_arima=TRUE,
  data_frequency='MONTHLY'
) AS
SELECT
  item_id,
  DATE_TRUNC(date, MONTH) AS month,
  SUM(quantity) AS demand
FROM `{table_ref("fact_invoice_lines")}`
WHERE org_id = @org_id
  AND status NOT IN {_EXCLUDED_STATUSES}
  AND date IS NOT NULL
  AND item_id IS NOT NULL
GROUP BY item_id, month
""".strip()


def _demand_forecast_sql(org_id: str, horizon: int) -> str:
    """``ML.FORECAST`` query against the per-org all-items demand model.

    Joins each forecast row back to ``fact_items`` for a human-readable
    description (falls back to the line description if the item is gone).
    ``horizon`` is inlined as a literal int — ML.FORECAST's settings STRUCT must
    be constants, not query parameters (BQML rejects @params there). It is a
    validated 1..24 integer (``int()`` coerced), so inlining is injection-safe.
    """
    return f"""
SELECT
  f.item_id AS item_id,
  COALESCE(it.name, f.item_id) AS description,
  f.forecast_timestamp AS period,
  f.forecast_value AS forecast_qty
FROM ML.FORECAST(
  MODEL `{_demand_model_ref(org_id)}`,
  STRUCT({int(horizon)} AS horizon, 0.8 AS confidence_level)
) AS f
LEFT JOIN `{table_ref("fact_items")}` AS it
  ON it.org_id = @org_id AND it.id = f.item_id
ORDER BY f.item_id, f.forecast_timestamp
""".strip()


def _reorder_sql() -> str:
    """Reorder suggestions: live stock vs. recent (≈3-month) demand rate.

    Per item, ``monthly_demand`` is the average monthly sold quantity over the
    last ~3 months (total recent qty / 3). An item is flagged when it is already
    at/below its reorder point, OR projected to drop below it within a month at
    the current rate. ``suggested_qty`` covers the next 2 months of demand above
    the reorder buffer (floored at 0). Urgency escalates on how deep below the
    reorder point the projection lands. Only inventory-tracked items.
    """
    return f"""
WITH recent_demand AS (
  SELECT
    item_id,
    SUM(quantity) / 3 AS monthly_demand
  FROM `{table_ref("fact_invoice_lines")}`
  WHERE org_id = @org_id
    AND status NOT IN {_EXCLUDED_STATUSES}
    AND item_id IS NOT NULL
    AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 3 MONTH)
  GROUP BY item_id
),
joined AS (
  SELECT
    i.id AS item_id,
    i.name AS name,
    i.stock_on_hand AS stock_on_hand,
    i.reorder_point AS reorder_point,
    COALESCE(rd.monthly_demand, 0) AS monthly_demand,
    -- projected on-hand one month out at the current monthly burn rate
    i.stock_on_hand - COALESCE(rd.monthly_demand, 0) AS projected_next_month
  FROM `{table_ref("fact_items")}` AS i
  LEFT JOIN recent_demand AS rd ON rd.item_id = i.id
  WHERE i.org_id = @org_id
    AND i.track_inventory = TRUE
)
SELECT
  item_id,
  name,
  stock_on_hand,
  reorder_point,
  monthly_demand,
  -- cover next 2 months of demand, refill the reorder buffer, net of stock
  GREATEST(
    CEIL(monthly_demand * 2 + reorder_point - stock_on_hand),
    0
  ) AS suggested_qty,
  CASE
    WHEN stock_on_hand <= reorder_point THEN 'high'
    WHEN projected_next_month <= reorder_point THEN 'medium'
    ELSE 'low'
  END AS urgency
FROM joined
WHERE stock_on_hand <= reorder_point
   OR projected_next_month <= reorder_point
ORDER BY
  CASE
    WHEN stock_on_hand <= reorder_point THEN 0
    WHEN projected_next_month <= reorder_point THEN 1
    ELSE 2
  END,
  stock_on_hand
""".strip()


def _stockout_sql() -> str:
    """Days-until-stockout from a daily demand rate vs. current stock.

    ``daily_rate`` = total sold quantity / number of distinct active sale days
    (so sporadic sellers are not over-projected). ``days_until_stockout`` =
    floor(stock_on_hand / daily_rate); ``predicted_stockout_date`` =
    ``CURRENT_DATE`` + that many days. Only inventory-tracked items that have
    actually sold (``daily_rate > 0``) are returned, soonest stockout first.
    """
    return f"""
WITH demand AS (
  SELECT
    item_id,
    SUM(quantity) AS total_qty,
    COUNT(DISTINCT date) AS active_days
  FROM `{table_ref("fact_invoice_lines")}`
  WHERE org_id = @org_id
    AND status NOT IN {_EXCLUDED_STATUSES}
    AND item_id IS NOT NULL
    AND date IS NOT NULL
  GROUP BY item_id
),
rated AS (
  SELECT
    item_id,
    SAFE_DIVIDE(total_qty, active_days) AS daily_rate
  FROM demand
)
SELECT
  i.id AS item_id,
  i.name AS name,
  i.stock_on_hand AS stock_on_hand,
  r.daily_rate AS daily_rate,
  CAST(FLOOR(SAFE_DIVIDE(i.stock_on_hand, r.daily_rate)) AS INT64) AS days_until_stockout,
  DATE_ADD(
    CURRENT_DATE(),
    INTERVAL CAST(FLOOR(SAFE_DIVIDE(i.stock_on_hand, r.daily_rate)) AS INT64) DAY
  ) AS predicted_stockout_date
FROM `{table_ref("fact_items")}` AS i
JOIN rated AS r ON r.item_id = i.id
WHERE i.org_id = @org_id
  AND i.track_inventory = TRUE
  AND r.daily_rate > 0
ORDER BY days_until_stockout
""".strip()


def _abc_sql() -> str:
    """ABC (Pareto) classification by revenue contribution.

    Per item, ``revenue`` = total ``line_total`` over real (non-draft/void)
    sold lines. A running cumulative share of total revenue (descending by
    revenue) buckets items: ``cumulative_pct <= 80`` ⇒ A, ``<= 95`` ⇒ B, else
    C. ``@org_id`` scopes the tenant.
    """
    return f"""
WITH per_item AS (
  SELECT
    item_id,
    ANY_VALUE(description) AS description,
    SUM(line_total) AS revenue
  FROM `{table_ref("fact_invoice_lines")}`
  WHERE org_id = @org_id
    AND status NOT IN {_EXCLUDED_STATUSES}
    AND item_id IS NOT NULL
  GROUP BY item_id
),
ranked AS (
  SELECT
    item_id,
    description,
    revenue,
    SUM(revenue) OVER (ORDER BY revenue DESC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_revenue,
    SUM(revenue) OVER () AS total_revenue
  FROM per_item
)
SELECT
  item_id,
  description AS name,
  revenue,
  ROUND(SAFE_DIVIDE(running_revenue, total_revenue) * 100, 2) AS cumulative_pct,
  CASE
    WHEN SAFE_DIVIDE(running_revenue, total_revenue) * 100 <= 80 THEN 'A'
    WHEN SAFE_DIVIDE(running_revenue, total_revenue) * 100 <= 95 THEN 'B'
    ELSE 'C'
  END AS abc_class
FROM ranked
ORDER BY revenue DESC
""".strip()


def _dead_stock_sql(days: int) -> str:
    """Items holding stock that have not sold in the last ``days`` days.

    LEFT JOIN ``fact_items`` to a per-item ``last_sold`` aggregate over
    ``fact_invoice_lines``; an item is dead stock when it still has
    ``stock_on_hand > 0`` and either never sold or its last sale predates the
    cutoff. ``value`` = on-hand × cost price. ``days`` is a validated int
    inlined into ``DATE_SUB`` (BQ ``INTERVAL`` needs a literal, not a @param);
    it is ``int()``-coerced upstream so inlining is injection-safe. ``@org_id``
    scopes the tenant.
    """
    return f"""
WITH last_sale AS (
  SELECT
    item_id,
    MAX(date) AS last_sold
  FROM `{table_ref("fact_invoice_lines")}`
  WHERE org_id = @org_id
    AND status NOT IN {_EXCLUDED_STATUSES}
    AND item_id IS NOT NULL
    AND date IS NOT NULL
  GROUP BY item_id
)
SELECT
  i.id AS item_id,
  i.name AS name,
  i.stock_on_hand AS stock_on_hand,
  i.stock_on_hand * i.cost_price AS value,
  ls.last_sold AS last_sold
FROM `{table_ref("fact_items")}` AS i
LEFT JOIN last_sale AS ls ON ls.item_id = i.id
WHERE i.org_id = @org_id
  AND i.stock_on_hand > 0
  AND (
    ls.last_sold IS NULL
    OR ls.last_sold < DATE_SUB(CURRENT_DATE(), INTERVAL {int(days)} DAY)
  )
ORDER BY value DESC
""".strip()


# ──────────────────────────── row mappers ─────────────────────────


def _map_forecast(row: Any) -> dict:
    return {
        "item_id": _str(_get(row, "item_id")),
        "description": _str(_get(row, "description")),
        "forecast_qty": _num(_get(row, "forecast_qty")),
        "period": _str(_get(row, "period")),
    }


def _map_reorder(row: Any) -> dict:
    return {
        "item_id": _str(_get(row, "item_id")),
        "name": _str(_get(row, "name")),
        "stock_on_hand": _num(_get(row, "stock_on_hand")),
        "reorder_point": _num(_get(row, "reorder_point")),
        "monthly_demand": _num(_get(row, "monthly_demand")),
        "suggested_qty": _num(_get(row, "suggested_qty")),
        "urgency": _str(_get(row, "urgency")),
    }


def _map_stockout(row: Any) -> dict:
    return {
        "item_id": _str(_get(row, "item_id")),
        "name": _str(_get(row, "name")),
        "stock_on_hand": _num(_get(row, "stock_on_hand")),
        "daily_rate": _num(_get(row, "daily_rate"), 3),
        "days_until_stockout": _int(_get(row, "days_until_stockout")),
        "predicted_stockout_date": _str(_get(row, "predicted_stockout_date")),
    }


def _map_abc(row: Any) -> dict:
    return {
        "item_id": _str(_get(row, "item_id")),
        "name": _str(_get(row, "name")),
        "revenue": _num(_get(row, "revenue")),
        "cumulative_pct": _num(_get(row, "cumulative_pct")),
        "abc_class": _str(_get(row, "abc_class")),
    }


def _map_dead_stock(row: Any) -> dict:
    return {
        "item_id": _str(_get(row, "item_id")),
        "name": _str(_get(row, "name")),
        "stock_on_hand": _num(_get(row, "stock_on_hand")),
        "value": _num(_get(row, "value")),
        "last_sold": _str(_get(row, "last_sold")),
    }


# ──────────────────────────── public API ──────────────────────────


def train_demand_model(org_id: str) -> None:
    """Train (CREATE OR REPLACE) the per-org all-items ARIMA_PLUS demand model.

    Raises on a BQ/BQML error so callers can decide how to degrade. Assumes the
    caller has already verified ``warehouse_enabled()`` and a live BQ client.
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
    client.query(_demand_train_sql(org_id), job_config=job_config).result()


def demand_forecast(org_id: str, periods: int = 3) -> list[dict]:
    """Per-item monthly demand forecast, training the model on demand.

    Tries ``ML.FORECAST`` first; if the model does not exist yet, trains the
    single all-items model and retries once. Any BQML error (including "not
    enough data to fit") propagates so the endpoint can return
    ``insufficient_data`` rather than a 500. Returns one row per item per
    forecast period: ``{item_id, description, forecast_qty, period}``.
    """
    bigquery = _bigquery()
    if bigquery is None:
        raise RuntimeError("google-cloud-bigquery not available")
    client = bigquery.Client(project=project_id())
    horizon = max(1, int(periods))
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", str(org_id)),
        ]
    )

    def _run() -> list[dict]:
        rows = client.query(
            _demand_forecast_sql(org_id, horizon), job_config=job_config
        ).result()
        return [_map_forecast(r) for r in rows]

    try:
        return _run()
    except Exception as first_err:  # noqa: BLE001 - model likely not trained yet
        log.info(
            "ai.inventory.demand_model_miss — training on demand",
            extra={"org_id": org_id, "err": str(first_err)},
        )
        # Train (may raise on insufficient history -> caller degrades), retry.
        train_demand_model(org_id)
        return _run()


def reorder_suggestions(org_id: str) -> list[dict]:
    """Items to reorder (at/below reorder point or about to be) + suggested qty.

    Raises on BQ error (caller degrades to empty + status, never 500).
    """
    return _run_org_query(_reorder_sql(), org_id, _map_reorder)


def stockout_prediction(org_id: str) -> list[dict]:
    """Per-item days-until-stockout + predicted stockout date. Raises on BQ error."""
    return _run_org_query(_stockout_sql(), org_id, _map_stockout)


def abc_analysis(org_id: str) -> list[dict]:
    """ABC (Pareto) revenue classification per item. Raises on BQ error."""
    return _run_org_query(_abc_sql(), org_id, _map_abc)


def dead_stock(org_id: str, days: int = 90) -> list[dict]:
    """Items holding stock with no sale in the last ``days`` days. Raises on BQ error."""
    return _run_org_query(_dead_stock_sql(max(1, int(days))), org_id, _map_dead_stock)
