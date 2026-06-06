"""Customer-intelligence AI on the BigQuery warehouse (Pool 4.6+).

Derives per-customer insight from ``fact_invoices`` — RFM segmentation, churn
risk, customer lifetime value (CLV), and accounts-receivable late-payment risk.
The warehouse is the same one declared in
:mod:`app.analytics.warehouse_schema` (single source of truth for
``project.dataset`` + table names).

Design — mirrors :mod:`app.api.forecast`:
  * **Lazy BigQuery import.** ``google.cloud.bigquery`` is imported inside the
    functions, never at module load, so this module stays importable (and the
    rest of the app boots) on machines without the BQ SDK.
  * **Flag-gated + graceful.** Nothing touches BigQuery unless
    ``ANALYTICS_BQ_DATASET`` is set. If it is unset, the SDK is missing, or BQ
    raises, the callers return an empty list with an explanatory ``status`` —
    **never 500**.

Security:
  * ``org_id`` reaches the SQL only through a bound ``ScalarQueryParameter``
    (``@org_id``) — never string-interpolated into the query text. There are no
    other user-derived identifiers, so there is no model-name slug to sanitise
    (unlike the BQML forecast module).
"""
from __future__ import annotations

import logging
import os
from typing import Any, Callable, Optional

from app.analytics.warehouse_schema import project_id, table_ref

log = logging.getLogger("analytics.ai.customer")

# Statuses returned alongside an empty row list when we degrade gracefully.
STATUS_OK = "ok"
STATUS_NOT_CONFIGURED = "warehouse_not_configured"

# Invoice statuses that must NOT count toward a customer's real, billed history.
_EXCLUDED_STATUSES = "('draft', 'void')"
# OPEN-invoice statuses (still owed) excluded from AR risk (already settled/dead).
_SETTLED_STATUSES = "('paid', 'void')"


# ──────────────────────────── helpers ─────────────────────────────


def warehouse_enabled() -> bool:
    """Customer AI only runs when the warehouse dataset is explicitly set.

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
        log.warning("ai.customer.bigquery_lib_missing — install google-cloud-bigquery")
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


# ──────────────────────────── SQL builders ────────────────────────
# Kept as standalone builders (no I/O) so tests can assert the SQL is
# parameterised + well-formed without touching BigQuery.


def _rfm_sql() -> str:
    """RFM per customer (``GROUP BY contact_name``) from ``fact_invoices``.

    Recency = days since last invoice; Frequency = invoice count; Monetary =
    total billed. Each is scored 1..5 via ``NTILE(5)`` over the customer
    population (Recency reversed: more-recent ⇒ higher R). The 5×5 grid maps to
    named segments. Draft/void invoices and null dates are excluded so the
    series reflects real, dated revenue. ``@org_id`` filters the tenant.
    """
    return f"""
WITH base AS (
  SELECT
    contact_name AS customer,
    DATE_DIFF(CURRENT_DATE(), MAX(date), DAY) AS recency,
    COUNT(*) AS frequency,
    SUM(total) AS monetary
  FROM `{table_ref("fact_invoices")}`
  WHERE org_id = @org_id
    AND status NOT IN {_EXCLUDED_STATUSES}
    AND date IS NOT NULL
    AND contact_name IS NOT NULL
  GROUP BY customer
),
scored AS (
  SELECT
    customer,
    recency,
    frequency,
    monetary,
    -- More-recent (smaller recency) ⇒ higher R score, so order DESC by recency.
    NTILE(5) OVER (ORDER BY recency DESC) AS r,
    NTILE(5) OVER (ORDER BY frequency ASC) AS f,
    NTILE(5) OVER (ORDER BY monetary ASC) AS m
  FROM base
)
SELECT
  customer,
  recency,
  frequency,
  monetary,
  r,
  f,
  m,
  CASE
    WHEN r >= 4 AND f >= 4 AND m >= 4 THEN 'Champions'
    WHEN r >= 3 AND f >= 3 THEN 'Loyal'
    WHEN r >= 4 AND f <= 2 THEN 'New'
    WHEN r >= 3 AND f <= 3 THEN 'Potential'
    WHEN r = 2 THEN 'At-Risk'
    ELSE 'Lost'
  END AS segment
FROM scored
ORDER BY monetary DESC
""".strip()


def _churn_sql() -> str:
    """Churn risk per customer: does current dormancy dwarf the usual cadence?

    For each customer we derive the median inter-purchase gap (days between
    consecutive invoice dates) and compare ``days_since`` last purchase to it.
    Single-purchase customers have no gap history, so we fall back to a 90-day
    cadence assumption. A ratio ≥ 3× ⇒ high risk, ≥ 1.5× ⇒ medium, else low.
    """
    return f"""
WITH dated AS (
  SELECT
    contact_name AS customer,
    date AS d,
    LAG(date) OVER (PARTITION BY contact_name ORDER BY date) AS prev_d
  FROM `{table_ref("fact_invoices")}`
  WHERE org_id = @org_id
    AND status NOT IN {_EXCLUDED_STATUSES}
    AND date IS NOT NULL
    AND contact_name IS NOT NULL
),
gaps AS (
  SELECT
    customer,
    DATE_DIFF(d, prev_d, DAY) AS gap_days
  FROM dated
  WHERE prev_d IS NOT NULL
),
agg AS (
  SELECT
    customer,
    MAX(d) AS last_purchase,
    DATE_DIFF(CURRENT_DATE(), MAX(d), DAY) AS days_since
  FROM dated
  GROUP BY customer
),
median_gap AS (
  SELECT
    customer,
    APPROX_QUANTILES(gap_days, 2)[OFFSET(1)] AS avg_gap_days
  FROM gaps
  GROUP BY customer
)
SELECT
  a.customer AS customer,
  a.last_purchase AS last_purchase,
  a.days_since AS days_since,
  COALESCE(mg.avg_gap_days, 90) AS avg_gap_days,
  CASE
    WHEN a.days_since >= COALESCE(mg.avg_gap_days, 90) * 3 THEN 'high'
    WHEN a.days_since >= COALESCE(mg.avg_gap_days, 90) * 1.5 THEN 'medium'
    ELSE 'low'
  END AS risk
FROM agg a
LEFT JOIN median_gap mg USING (customer)
ORDER BY a.days_since DESC
""".strip()


def _clv_sql() -> str:
    """Historical value + a simple projected CLV per customer.

    Historical = total billed. ``avg_monthly`` = total / active months (span
    between first and last invoice, floored at 1 month). Projected CLV = average
    monthly spend × a 24-month horizon, but **only for non-churned** customers
    (last purchase within ~90 days); churned customers project to 0 so we don't
    book value for a relationship that has likely ended.
    """
    return f"""
WITH base AS (
  SELECT
    contact_name AS customer,
    SUM(total) AS historical,
    MIN(date) AS first_d,
    MAX(date) AS last_d,
    DATE_DIFF(CURRENT_DATE(), MAX(date), DAY) AS days_since
  FROM `{table_ref("fact_invoices")}`
  WHERE org_id = @org_id
    AND status NOT IN {_EXCLUDED_STATUSES}
    AND date IS NOT NULL
    AND contact_name IS NOT NULL
  GROUP BY customer
),
spread AS (
  SELECT
    customer,
    historical,
    days_since,
    -- active month span (>= 1 so a single-month customer divides by 1)
    GREATEST(
      DATE_DIFF(last_d, first_d, MONTH) + 1,
      1
    ) AS active_months
  FROM base
)
SELECT
  customer,
  historical,
  SAFE_DIVIDE(historical, active_months) AS avg_monthly,
  CASE
    WHEN days_since <= 90
      THEN SAFE_DIVIDE(historical, active_months) * 24
    ELSE 0
  END AS projected_clv
FROM spread
ORDER BY historical DESC
""".strip()


def _ar_late_sql() -> str:
    """Open-invoice AR late-payment risk.

    Considers only OPEN invoices (``balance_due > 0`` and status not
    paid/void). ``days_outstanding`` = days since the invoice ``date`` (proxy
    for age, since the warehouse fact table has no due-date column). The risk
    flag blends invoice age with the customer's historical lateness — the share
    of that customer's *other* invoices still carrying a balance. ``@org_id``
    scopes the tenant.
    """
    return f"""
WITH cust_pattern AS (
  -- Per customer: share of invoices that still carry a balance (a proxy for
  -- "this customer tends to pay late / leave balances open").
  SELECT
    contact_name AS customer,
    SAFE_DIVIDE(
      COUNTIF(balance_due > 0),
      COUNT(*)
    ) AS late_ratio
  FROM `{table_ref("fact_invoices")}`
  WHERE org_id = @org_id
    AND status NOT IN {_EXCLUDED_STATUSES}
    AND contact_name IS NOT NULL
  GROUP BY customer
),
open_inv AS (
  SELECT
    id AS invoice_id,
    contact_name AS customer,
    balance_due,
    DATE_DIFF(CURRENT_DATE(), date, DAY) AS days_outstanding
  FROM `{table_ref("fact_invoices")}`
  WHERE org_id = @org_id
    AND balance_due > 0
    AND status NOT IN {_SETTLED_STATUSES}
    AND date IS NOT NULL
)
SELECT
  o.invoice_id AS invoice_id,
  o.customer AS customer,
  o.balance_due AS balance_due,
  o.days_outstanding AS days_outstanding,
  CASE
    WHEN o.days_outstanding >= 60
      OR (o.days_outstanding >= 30 AND COALESCE(cp.late_ratio, 0) >= 0.5)
      THEN 'high'
    WHEN o.days_outstanding >= 30
      OR COALESCE(cp.late_ratio, 0) >= 0.5
      THEN 'medium'
    ELSE 'low'
  END AS risk
FROM open_inv o
LEFT JOIN cust_pattern cp USING (customer)
ORDER BY o.days_outstanding DESC
""".strip()


# ──────────────────────────── row mappers ─────────────────────────


def _map_rfm(row: Any) -> dict:
    return {
        "customer": _str(_get(row, "customer")),
        "recency": _int(_get(row, "recency")),
        "frequency": _int(_get(row, "frequency")),
        "monetary": _num(_get(row, "monetary")),
        "r": _int(_get(row, "r")),
        "f": _int(_get(row, "f")),
        "m": _int(_get(row, "m")),
        "segment": _str(_get(row, "segment")),
    }


def _map_churn(row: Any) -> dict:
    return {
        "customer": _str(_get(row, "customer")),
        "last_purchase": _str(_get(row, "last_purchase")),
        "days_since": _int(_get(row, "days_since")),
        "avg_gap_days": _num(_get(row, "avg_gap_days"), 1),
        "risk": _str(_get(row, "risk")),
    }


def _map_clv(row: Any) -> dict:
    return {
        "customer": _str(_get(row, "customer")),
        "historical": _num(_get(row, "historical")),
        "avg_monthly": _num(_get(row, "avg_monthly")),
        "projected_clv": _num(_get(row, "projected_clv")),
    }


def _map_ar(row: Any) -> dict:
    return {
        "invoice_id": _str(_get(row, "invoice_id")),
        "customer": _str(_get(row, "customer")),
        "balance_due": _num(_get(row, "balance_due")),
        "days_outstanding": _int(_get(row, "days_outstanding")),
        "risk": _str(_get(row, "risk")),
    }


# ──────────────────────────── public API ──────────────────────────


def rfm_segments(org_id: str) -> list[dict]:
    """RFM scores + segment per customer. Raises on BQ error (caller degrades)."""
    return _run_org_query(_rfm_sql(), org_id, _map_rfm)


def churn_risk(org_id: str) -> list[dict]:
    """Per-customer churn risk vs. their usual cadence. Raises on BQ error."""
    return _run_org_query(_churn_sql(), org_id, _map_churn)


def customer_clv(org_id: str) -> list[dict]:
    """Historical + projected customer lifetime value. Raises on BQ error."""
    return _run_org_query(_clv_sql(), org_id, _map_clv)


def ar_late_risk(org_id: str) -> list[dict]:
    """Open-invoice late-payment risk. Raises on BQ error (caller degrades)."""
    return _run_org_query(_ar_late_sql(), org_id, _map_ar)
