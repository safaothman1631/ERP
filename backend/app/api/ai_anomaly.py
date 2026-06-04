"""AI anomaly-detection API on the BigQuery warehouse (Pool 4.7).

Thin HTTP layer over :mod:`app.analytics.ai.anomaly`. Two read-only endpoints,
both gated by ``reports.read`` and both adhering to the analytics graceful
contract: always HTTP 200, degrading to an empty ``rows`` list + a ``status``
that explains why (warehouse not configured / invalid fact / BQ error) instead
of ever returning a 500.

Endpoints (prefix ``/api/ai``):
    GET /api/ai/anomalies/transactions?fact=fact_invoices   outlier transactions
    GET /api/ai/anomalies/cashflow                          off-trend months
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query

from app.analytics.ai import anomaly as anomaly_mod
from app.services.auth import get_current_user
from app.services.permissions import require_perm

log = logging.getLogger("api.ai_anomaly")

router = APIRouter(prefix="/api/ai", tags=["AI — Anomalies"])


@router.get(
    "/anomalies/transactions",
    dependencies=[Depends(require_perm("reports.read"))],
)
def transaction_anomalies_endpoint(
    fact: str = Query(
        "fact_invoices",
        description="Warehouse fact to scan (fact_invoices | fact_bills)",
    ),
    user: dict = Depends(get_current_user),
):
    """Per-org outlier transactions on ``total`` (z-score + IQR fences).

    Always HTTP 200. ``fact`` is whitelisted to ``fact_invoices``/``fact_bills``;
    anything else returns an empty list with ``status='invalid_fact'`` (a
    400-style signal carried in the body, not an exception). The warehouse being
    unconfigured or BigQuery raising likewise degrade to an empty list.
    """
    org_id = user["org_id"]
    base = {"org_id": org_id, "fact": fact}
    if not anomaly_mod.warehouse_enabled():
        return {**base, "rows": [], "status": anomaly_mod.STATUS_NOT_CONFIGURED}
    try:
        rows = anomaly_mod.transaction_anomalies(org_id, fact=fact)
    except anomaly_mod.InvalidFact:
        return {**base, "rows": [], "status": anomaly_mod.STATUS_INVALID_FACT}
    except Exception as e:  # noqa: BLE001 - never 500 on an analytics failure
        log.warning(
            "anomaly.transactions_failed",
            extra={"org_id": org_id, "fact": fact, "err": str(e)},
        )
        return {**base, "rows": [], "status": anomaly_mod.STATUS_ERROR}
    return {**base, "rows": rows, "status": anomaly_mod.STATUS_OK}


@router.get(
    "/anomalies/cashflow",
    dependencies=[Depends(require_perm("reports.read"))],
)
def cashflow_anomalies_endpoint(
    user: dict = Depends(get_current_user),
):
    """Months whose revenue/expense strays from its trailing control band.

    Same graceful contract: always HTTP 200, empty ``rows`` + a ``status`` when
    the warehouse is unconfigured or BigQuery raises.
    """
    org_id = user["org_id"]
    base = {"org_id": org_id}
    if not anomaly_mod.warehouse_enabled():
        return {**base, "rows": [], "status": anomaly_mod.STATUS_NOT_CONFIGURED}
    try:
        rows = anomaly_mod.cashflow_anomalies(org_id)
    except Exception as e:  # noqa: BLE001 - never 500
        log.warning(
            "anomaly.cashflow_failed", extra={"org_id": org_id, "err": str(e)}
        )
        return {**base, "rows": [], "status": anomaly_mod.STATUS_ERROR}
    return {**base, "rows": rows, "status": anomaly_mod.STATUS_OK}
