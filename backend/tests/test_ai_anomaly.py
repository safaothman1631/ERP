"""Tests for the AI anomaly-detection API (Pool 4.7).

We never touch real BigQuery: ``app.analytics.ai.anomaly._bigquery`` is patched
to hand back a fake ``bigquery`` module whose ``Client()`` is a ``MagicMock`` we
drive. That lets us:
  * capture the SQL handed to ``client.query(...)`` and assert the stats SQL
    (AVG / STDDEV / APPROX_QUANTILES + the moving-average window) is well-formed,
  * prove ``org_id`` is bound as a parameter (never string-interpolated),
  * verify the fact-name whitelist (an unknown fact is rejected, no query runs),
  * check the endpoint response shape, and
  * verify graceful HTTP-200 empty results when the env is unset or BQ raises.

Mirrors the mocking style of ``tests/test_forecast_api.py``.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.analytics.ai import anomaly as anomaly_mod
from app.api.ai_anomaly import router as anomaly_router
from app.services.auth import get_current_user

DATASET = "test-proj.test_ds"


def _user():
    # ``role: owner`` resolves to the "*" permission set, satisfying the
    # ``require_perm("reports.read")`` gate on both endpoints.
    return {
        "id": "user-1",
        "org_id": "org-1",
        "email": "user@example.com",
        "name": "Test User",
        "role": "owner",
    }


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", DATASET)
    app = FastAPI()
    app.include_router(anomaly_router)
    app.dependency_overrides[get_current_user] = _user
    return TestClient(app, raise_server_exceptions=False)


# ── fake BigQuery plumbing ────────────────────────────────────────


def _tx_rows():
    """Two transaction-anomaly rows as plain dicts (Row supports mapping)."""
    return [
        {
            "id": "inv-1",
            "date": "2026-05-01",
            "amount": 999999.0,
            "party": "Acme Corp",
            "z_score": 4.2,
            "reason": "z_score_outlier",
        },
        {
            "id": "inv-2",
            "date": "2026-05-02",
            "amount": 1.0,
            "party": "Beta LLC",
            "z_score": -3.5,
            "reason": "very_small",
        },
    ]


def _cf_rows():
    """One cash-flow-anomaly row as a plain dict."""
    return [
        {
            "month": "2026-04-01",
            "metric": "revenue",
            "value": 50000.0,
            "expected": 10000.0,
            "deviation": 40000.0,
        },
    ]


def _make_fake_bq(rows=None, query_side_effect=None):
    """Build a fake ``bigquery`` module + the client/query-job mocks.

    Returns ``(fake_bq_module, client, captured)`` where ``captured`` collects
    the SQL strings + job configs passed to ``client.query``.
    """
    captured: dict = {"sql": [], "job_configs": [], "params": []}

    job = MagicMock(name="QueryJob")
    job.result.return_value = list(rows if rows is not None else _tx_rows())

    client = MagicMock(name="Client")

    def _query(sql, job_config=None, **kw):
        captured["sql"].append(sql)
        captured["job_configs"].append(job_config)
        if query_side_effect is not None:
            return query_side_effect(sql, job_config)
        return job

    client.query.side_effect = _query

    fake_bq = MagicMock(name="bigquery")
    fake_bq.Client.return_value = client

    def _scalar_param(name, typ, val):
        rec = {"name": name, "type": typ, "value": val}
        captured["params"].append(rec)
        return rec

    fake_bq.ScalarQueryParameter.side_effect = _scalar_param
    fake_bq.QueryJobConfig.side_effect = lambda **kw: {"_job_config": kw}
    return fake_bq, client, captured


# ── fact-name whitelist (injection / 400 boundary) ────────────────


def test_resolve_fact_whitelist():
    assert anomaly_mod._resolve_fact("fact_invoices") == "contact_name"
    assert anomaly_mod._resolve_fact("fact_bills") == "vendor_name"


def test_resolve_fact_rejects_unknown():
    with pytest.raises(anomaly_mod.InvalidFact):
        anomaly_mod._resolve_fact("fact_pos_orders")
    with pytest.raises(anomaly_mod.InvalidFact):
        anomaly_mod._resolve_fact("users; DROP TABLE fact_invoices")


def test_transaction_anomalies_rejects_unknown_fact_before_query():
    """An unknown fact raises InvalidFact and never builds/runs a query."""
    fake_bq, client, captured = _make_fake_bq()
    with patch.object(anomaly_mod, "_bigquery", return_value=fake_bq):
        with pytest.raises(anomaly_mod.InvalidFact):
            anomaly_mod.transaction_anomalies("org-1", fact="fact_secret")
    assert captured["sql"] == []  # rejected before any SQL was emitted
    client.query.assert_not_called()


# ── SQL well-formedness ───────────────────────────────────────────


def test_transaction_sql_has_stats_and_is_parameterized():
    sql = anomaly_mod._transaction_sql("fact_invoices")
    # robust + parametric stats are computed in BigQuery
    assert "AVG(total)" in sql
    assert "STDDEV_POP(total)" in sql
    assert "APPROX_QUANTILES(total, 4)" in sql
    # z-score expression present
    assert "SAFE_DIVIDE(b.total - s.mean_total, s.std_total)" in sql
    assert "z_score" in sql
    # org filter is parameterised, never interpolated
    assert "@org_id" in sql
    assert "org-1" not in sql  # the call arg is org-id of the *table* only here
    # correct table + party column for invoices
    assert "fact_invoices" in sql
    assert "contact_name AS party" in sql
    assert "status NOT IN ('draft', 'void')" in sql


def test_transaction_sql_maps_party_for_bills():
    sql = anomaly_mod._transaction_sql("fact_bills")
    assert "fact_bills" in sql
    assert "vendor_name AS party" in sql
    assert "contact_name" not in sql


def test_cashflow_sql_has_moving_average_window():
    sql = anomaly_mod._cashflow_sql()
    # trailing moving-average control band over preceding months
    assert "AVG(value) OVER w" in sql
    assert "STDDEV_POP(value) OVER w" in sql
    assert "ROWS BETWEEN 6 PRECEDING AND 1 PRECEDING" in sql
    # both metrics + both fact tables
    assert "'revenue'" in sql and "'expense'" in sql
    assert "fact_invoices" in sql and "fact_bills" in sql
    assert "DATE_TRUNC(date, MONTH)" in sql
    # parameterised org filter, returns the documented columns
    assert "@org_id" in sql
    assert "value - trailing_avg AS deviation" in sql


# ── core logic: org_id is bound, never interpolated ───────────────


def test_transaction_anomalies_binds_org_param():
    fake_bq, client, captured = _make_fake_bq()
    with patch.object(anomaly_mod, "_bigquery", return_value=fake_bq):
        rows = anomaly_mod.transaction_anomalies("org-XYZ", fact="fact_invoices")
    # org reaches SQL only as a bound parameter
    fake_bq.ScalarQueryParameter.assert_any_call("org_id", "STRING", "org-XYZ")
    assert len(captured["sql"]) == 1
    assert "org-XYZ" not in captured["sql"][0]  # not interpolated
    # rows mapped to the documented shape
    assert rows[0] == {
        "id": "inv-1",
        "date": "2026-05-01",
        "amount": 999999.0,
        "party": "Acme Corp",
        "z_score": 4.2,
        "reason": "z_score_outlier",
    }
    assert set(rows[0]) == {"id", "date", "amount", "party", "z_score", "reason"}


def test_cashflow_anomalies_binds_org_param_and_maps_rows():
    fake_bq, client, captured = _make_fake_bq(rows=_cf_rows())
    with patch.object(anomaly_mod, "_bigquery", return_value=fake_bq):
        rows = anomaly_mod.cashflow_anomalies("org-1")
    fake_bq.ScalarQueryParameter.assert_any_call("org_id", "STRING", "org-1")
    assert "org-1" not in captured["sql"][0]
    assert rows == [
        {
            "month": "2026-04-01",
            "metric": "revenue",
            "value": 50000.0,
            "expected": 10000.0,
            "deviation": 40000.0,
        }
    ]
    assert set(rows[0]) == {"month", "metric", "value", "expected", "deviation"}


def test_transaction_anomalies_raises_when_bq_lib_missing():
    with patch.object(anomaly_mod, "_bigquery", return_value=None):
        with pytest.raises(RuntimeError):
            anomaly_mod.transaction_anomalies("org-1", fact="fact_invoices")


# ── endpoint: happy path ──────────────────────────────────────────


def test_transactions_endpoint_shape(client):
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(anomaly_mod, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/ai/anomalies/transactions?fact=fact_invoices")
    assert resp.status_code == 200
    body = resp.json()
    assert body["org_id"] == "org-1"
    assert body["fact"] == "fact_invoices"
    assert body["status"] == "ok"
    assert len(body["rows"]) == 2
    row = body["rows"][0]
    assert set(row) == {"id", "date", "amount", "party", "z_score", "reason"}
    assert row["reason"] == "z_score_outlier"


def test_cashflow_endpoint_shape(client):
    fake_bq, _client, _captured = _make_fake_bq(rows=_cf_rows())
    with patch.object(anomaly_mod, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/ai/anomalies/cashflow")
    assert resp.status_code == 200
    body = resp.json()
    assert body["org_id"] == "org-1"
    assert body["status"] == "ok"
    assert len(body["rows"]) == 1
    assert set(body["rows"][0]) == {"month", "metric", "value", "expected", "deviation"}


# ── endpoint: invalid fact (400-style status, never 500) ──────────


def test_transactions_endpoint_invalid_fact(client):
    # whitelist rejects unknown fact -> empty rows + invalid_fact status, 200.
    fake_bq, _client, captured = _make_fake_bq()
    with patch.object(anomaly_mod, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/ai/anomalies/transactions?fact=fact_pos_orders")
    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    assert body["status"] == "invalid_fact"
    # the bad fact never produced a query
    assert captured["sql"] == []


# ── endpoint: graceful degradation (never 500) ────────────────────


def test_transactions_endpoint_warehouse_not_configured(monkeypatch):
    monkeypatch.delenv("ANALYTICS_BQ_DATASET", raising=False)
    app = FastAPI()
    app.include_router(anomaly_router)
    app.dependency_overrides[get_current_user] = _user
    c = TestClient(app, raise_server_exceptions=False)
    resp = c.get("/api/ai/anomalies/transactions")
    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    assert body["status"] == "warehouse_not_configured"


def test_cashflow_endpoint_warehouse_not_configured(monkeypatch):
    monkeypatch.delenv("ANALYTICS_BQ_DATASET", raising=False)
    app = FastAPI()
    app.include_router(anomaly_router)
    app.dependency_overrides[get_current_user] = _user
    c = TestClient(app, raise_server_exceptions=False)
    resp = c.get("/api/ai/anomalies/cashflow")
    assert resp.status_code == 200
    assert resp.json()["status"] == "warehouse_not_configured"


def test_transactions_endpoint_error_when_bq_raises(client):
    def _side_effect(sql, job_config):
        raise RuntimeError("BigQuery exploded")

    fake_bq, _client, _captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(anomaly_mod, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/ai/anomalies/transactions?fact=fact_invoices")
    # graceful: HTTP 200, empty rows, status explains why — never 500
    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    assert body["status"] == "error"


def test_cashflow_endpoint_error_when_bq_raises(client):
    def _side_effect(sql, job_config):
        raise RuntimeError("BigQuery exploded")

    fake_bq, _client, _captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(anomaly_mod, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/ai/anomalies/cashflow")
    assert resp.status_code == 200
    assert resp.json()["status"] == "error"


def test_transactions_endpoint_graceful_when_bq_lib_missing(client):
    with patch.object(anomaly_mod, "_bigquery", return_value=None):
        resp = client.get("/api/ai/anomalies/transactions?fact=fact_invoices")
    assert resp.status_code == 200
    assert resp.json()["status"] == "error"


def test_transactions_endpoint_no_injection_via_org_id(client):
    """org_id with SQL metacharacters must never appear raw in emitted SQL."""
    app = FastAPI()
    app.include_router(anomaly_router)
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "u", "org_id": "'; DROP TABLE fact_invoices; --",
        "email": "x", "name": "x", "role": "owner",
    }
    monkeypatch_env = {"ANALYTICS_BQ_DATASET": DATASET}
    with patch.dict("os.environ", monkeypatch_env):
        c = TestClient(app, raise_server_exceptions=False)
        fake_bq, _client, captured = _make_fake_bq()
        with patch.object(anomaly_mod, "_bigquery", return_value=fake_bq):
            resp = c.get("/api/ai/anomalies/transactions?fact=fact_invoices")
    assert resp.status_code == 200
    assert captured["sql"], "expected at least one query"
    for sql in captured["sql"]:
        assert "DROP TABLE" not in sql
        assert "'; " not in sql
    # org went through a bound parameter
    assert any(
        p["name"] == "org_id" and "DROP TABLE" in str(p["value"])
        for p in captured["params"]
    )


# ── auth gate ─────────────────────────────────────────────────────


def test_endpoints_forbidden_without_reports_read(monkeypatch):
    """A user whose role lacks ``reports.read`` is rejected with 403."""
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", DATASET)
    app = FastAPI()
    app.include_router(anomaly_router)
    # cashier role: POS perms only, no reports.read
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "u", "org_id": "org-1", "email": "x", "name": "x", "role": "cashier",
    }
    c = TestClient(app, raise_server_exceptions=False)
    assert c.get("/api/ai/anomalies/transactions").status_code == 403
    assert c.get("/api/ai/anomalies/cashflow").status_code == 403


# ── router contract ───────────────────────────────────────────────


def test_router_prefix_and_paths():
    assert anomaly_router.prefix == "/api/ai"
    paths = {r.path for r in anomaly_router.routes}
    assert "/api/ai/anomalies/transactions" in paths
    assert "/api/ai/anomalies/cashflow" in paths
