"""Statistical anomaly detection on the BigQuery warehouse (Pool 4.7 — AI).

Surfaces two classes of anomaly entirely in SQL (no model training, no Python
number-crunching — BigQuery does the stats):

  * **transaction_anomalies** — per-org outlier transactions on ``total``.
    Computes the org's mean + population stddev of ``total`` (with AVG/STDDEV
    analytic functions) and flags rows whose |total - mean| exceeds
    ``3 * stddev`` (the classic z-score rule), and additionally rows that are
    extreme relative to the population's robust IQR fences (APPROX_QUANTILES).
  * **cashflow_anomalies** — month-over-month revenue (``fact_invoices``) and
    expense (``fact_bills``) series, flagging any month whose value strays far
    from the trailing moving average ± stddev (a simple control-band model).

Design — mirrors :mod:`app.api.forecast`:
  * **Lazy BigQuery import.** ``google.cloud.bigquery`` is imported inside the
    functions, never at module load, so this module imports (and the app boots)
    on machines without the BQ SDK.
  * **Flag-gated + graceful.** Nothing queries BigQuery unless
    ``ANALYTICS_BQ_DATASET`` is set. When it is unset, the SDK is missing, or BQ
    raises, the callers return an empty list + a ``status`` explaining why —
    **never raise to the HTTP layer**.

Security:
  * ``org_id`` reaches SQL only through a bound ``ScalarQueryParameter`` — it is
    *never* string-interpolated into the query text.
  * The only identifiers interpolated into SQL are the fully-qualified fact
    table names, and those come from a **hard whitelist** (``ALLOWED_FACTS``);
    any other ``fact`` value is rejected before a query is ever built.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional

from app.analytics.warehouse_schema import project_id, table_ref

log = logging.getLogger("analytics.anomaly")

# Statuses returned alongside an (empty) row list when we degrade gracefully.
STATUS_OK = "ok"
STATUS_NOT_CONFIGURED = "warehouse_not_configured"
STATUS_ERROR = "error"
STATUS_INVALID_FACT = "invalid_fact"

# Hard whitelist: fact table -> the column naming the counterparty ("party").
# This map is BOTH the injection boundary for the interpolated table identifier
# AND the source of the party-column name, so an unknown ``fact`` can never
# produce a query.
ALLOWED_FACTS: dict[str, str] = {
    "fact_invoices": "contact_name",
    "fact_bills": "vendor_name",
}

# Z-score threshold: a transaction is an outlier when it sits more than this
# many population standard deviations from the org mean.
Z_THRESHOLD = 3.0


class InvalidFact(ValueError):
    """Raised when an unknown / non-whitelisted fact table is requested."""


# ──────────────────────────── helpers ─────────────────────────────


def warehouse_enabled() -> bool:
    """Anomaly detection only runs when the warehouse dataset is opted into.

    ``warehouse_schema.dataset_ref()`` falls back to a default name, but the
    *feature* is gated on the operator setting the env var (same contract as
    :mod:`app.api.forecast`)."""
    return bool(os.environ.get("ANALYTICS_BQ_DATASET"))


def _resolve_fact(fact: str) -> str:
    """Validate ``fact`` against the whitelist, returning its party column.

    Raises :class:`InvalidFact` for anything not explicitly allowed — this runs
    *before* any SQL is constructed, so a bad value never reaches a query.
    """
    party_col = ALLOWED_FACTS.get(str(fact))
    if party_col is None:
        raise InvalidFact(fact)
    return party_col


def _bigquery():
    """Return the ``google.cloud.bigquery`` module or ``None`` if unavailable."""
    try:
        from google.cloud import bigquery  # type: ignore

        return bigquery
    except Exception:  # pragma: no cover - lib optional in dev/CI
        log.warning("anomaly.bigquery_lib_missing — install google-cloud-bigquery")
        return None


def _num(v: Any, ndigits: int = 2) -> float:
    """Coerce a BQ numeric (None/Decimal/float/str) to a rounded float."""
    try:
        return round(float(v), ndigits)
    except (TypeError, ValueError):
        return 0.0


def _get(row: Any, name: str) -> Any:
    """Read a field from a BQ ``Row`` (mapping access) or a plain dict/object.

    BQ ``Row`` supports both ``row[name]`` and attribute access; tests pass plain
    dicts, so we try mapping first then fall back to ``getattr``.
    """
    try:
        return row[name]
    except (KeyError, TypeError, IndexError):
        return getattr(row, name, None)


def _iso(value: Any) -> Optional[str]:
    """Coerce a BQ DATE/TIMESTAMP/str to an ISO string (or ``None``)."""
    if value is None:
        return None
    iso = getattr(value, "isoformat", None)
    if callable(iso):
        return iso()
    return str(value)


# ──────────────────────────── SQL builders ────────────────────────


def _transaction_sql(fact: str) -> str:
    """Outlier-detection SQL for ``fact`` (already whitelisted by the caller).

    Strategy (all stats computed in BigQuery):
      * ``stats`` CTE — population AVG + STDDEV_POP of ``total`` over the org's
        non-draft/void rows, plus the robust IQR fences from APPROX_QUANTILES
        (Q1, Q3 -> fences at ±1.5*IQR). The mean/stddev drive the z-score; the
        IQR fences give a distribution-shape-robust very-large / very-small test.
      * the outer query computes ``z_score = (total - mean) / stddev`` per row
        and keeps any row that is a z-score outlier OR outside the IQR fences,
        attaching a human ``reason``.

    ``@org_id`` is bound as a parameter (never interpolated). The table name is
    the only interpolated identifier and comes from the whitelist.
    """
    tbl = table_ref(fact)
    party_col = ALLOWED_FACTS[fact]
    return f"""
WITH base AS (
  SELECT id, date, total, {party_col} AS party
  FROM `{tbl}`
  WHERE org_id = @org_id
    AND status NOT IN ('draft', 'void')
    AND total IS NOT NULL
),
stats AS (
  SELECT
    AVG(total) AS mean_total,
    STDDEV_POP(total) AS std_total,
    APPROX_QUANTILES(total, 4) AS quartiles
  FROM base
)
SELECT
  b.id,
  b.date,
  b.total AS amount,
  b.party,
  SAFE_DIVIDE(b.total - s.mean_total, s.std_total) AS z_score,
  CASE
    WHEN s.std_total > 0
         AND ABS(b.total - s.mean_total) > {Z_THRESHOLD} * s.std_total
      THEN 'z_score_outlier'
    WHEN b.total > s.quartiles[OFFSET(3)]
                   + 1.5 * (s.quartiles[OFFSET(3)] - s.quartiles[OFFSET(1)])
      THEN 'very_large'
    WHEN b.total < s.quartiles[OFFSET(1)]
                   - 1.5 * (s.quartiles[OFFSET(3)] - s.quartiles[OFFSET(1)])
      THEN 'very_small'
    ELSE NULL
  END AS reason
FROM base b
CROSS JOIN stats s
WHERE
  (s.std_total > 0
   AND ABS(b.total - s.mean_total) > {Z_THRESHOLD} * s.std_total)
  OR b.total > s.quartiles[OFFSET(3)]
               + 1.5 * (s.quartiles[OFFSET(3)] - s.quartiles[OFFSET(1)])
  OR b.total < s.quartiles[OFFSET(1)]
               - 1.5 * (s.quartiles[OFFSET(3)] - s.quartiles[OFFSET(1)])
ORDER BY ABS(z_score) DESC
LIMIT 200
""".strip()


def _cashflow_sql() -> str:
    """Monthly revenue + expense series with trailing control-band flags.

    Revenue comes from ``fact_invoices``, expense from ``fact_bills``; the two
    are unioned into one monthly ``(metric, month, value)`` series. A window over
    the **preceding** 6 months (``ROWS BETWEEN 6 PRECEDING AND 1 PRECEDING``)
    gives a trailing moving average + stddev per metric; a month is flagged when
    its value strays more than 2 trailing stddevs from that average.

    Both fact tables are constant identifiers here (this endpoint is not
    fact-parameterised); ``@org_id`` is bound as a parameter.
    """
    inv = table_ref("fact_invoices")
    bil = table_ref("fact_bills")
    return f"""
WITH monthly AS (
  SELECT 'revenue' AS metric, DATE_TRUNC(date, MONTH) AS month, SUM(total) AS value
  FROM `{inv}`
  WHERE org_id = @org_id
    AND status NOT IN ('draft', 'void')
    AND date IS NOT NULL
  GROUP BY month
  UNION ALL
  SELECT 'expense' AS metric, DATE_TRUNC(date, MONTH) AS month, SUM(total) AS value
  FROM `{bil}`
  WHERE org_id = @org_id
    AND status NOT IN ('draft', 'void')
    AND date IS NOT NULL
  GROUP BY month
),
banded AS (
  SELECT
    metric,
    month,
    value,
    AVG(value) OVER w AS trailing_avg,
    STDDEV_POP(value) OVER w AS trailing_std
  FROM monthly
  WINDOW w AS (
    PARTITION BY metric ORDER BY month
    ROWS BETWEEN 6 PRECEDING AND 1 PRECEDING
  )
)
SELECT
  month,
  metric,
  value,
  trailing_avg AS expected,
  value - trailing_avg AS deviation
FROM banded
WHERE trailing_std IS NOT NULL
  AND trailing_std > 0
  AND ABS(value - trailing_avg) > 2 * trailing_std
ORDER BY month DESC, metric
LIMIT 200
""".strip()


# ─────────────────────────── core logic ───────────────────────────


def transaction_anomalies(org_id: str, fact: str = "fact_invoices") -> list[dict]:
    """Flag per-org outlier transactions on ``total`` for a whitelisted fact.

    Returns a list of ``{id, date, amount, party, z_score, reason}``. Raises
    :class:`InvalidFact` for a non-whitelisted ``fact`` (the endpoint maps this
    to a 400-style status); any BQ/SDK error propagates so the endpoint can
    degrade to an empty list + ``error`` status (never a 500).
    """
    _resolve_fact(fact)  # raises InvalidFact before any query is built
    bigquery = _bigquery()
    if bigquery is None:
        raise RuntimeError("google-cloud-bigquery not available")
    client = bigquery.Client(project=project_id())
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("org_id", "STRING", str(org_id)),
        ]
    )
    rows = client.query(_transaction_sql(fact), job_config=job_config).result()
    out: list[dict] = []
    for r in rows:
        out.append(
            {
                "id": _get(r, "id"),
                "date": _iso(_get(r, "date")),
                "amount": _num(_get(r, "amount")),
                "party": _get(r, "party"),
                "z_score": _num(_get(r, "z_score"), 4),
                "reason": _get(r, "reason"),
            }
        )
    return out


def cashflow_anomalies(org_id: str) -> list[dict]:
    """Flag months whose revenue/expense strays from its trailing control band.

    Returns a list of ``{month, metric, value, expected, deviation}``. Any
    BQ/SDK error propagates so the endpoint can degrade gracefully.
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
    rows = client.query(_cashflow_sql(), job_config=job_config).result()
    out: list[dict] = []
    for r in rows:
        out.append(
            {
                "month": _iso(_get(r, "month")),
                "metric": _get(r, "metric"),
                "value": _num(_get(r, "value")),
                "expected": _num(_get(r, "expected")),
                "deviation": _num(_get(r, "deviation")),
            }
        )
    return out
