"""Tests for the customer-intelligence AI API (Pool 4.6+).

We never touch real BigQuery: ``app.analytics.ai.customer._bigquery`` is patched
to hand back a fake ``bigquery`` module whose ``Client()`` is a ``MagicMock`` we
drive. That lets us:
  * capture the SQL handed to ``client.query(...)`` and assert each of the
    RFM / churn / CLV / AR-risk queries is well-formed,
  * prove ``org_id`` is bound as a ``ScalarQueryParameter`` and never
    string-interpolated into the SQL text (no injection),
  * check the endpoint response shape (``{rows, status}``), and
  * verify graceful HTTP-200 empty results when the env is unset or BQ raises.

Mirrors the mocking style of ``tests/test_forecast_api.py``.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.analytics.ai import customer as ci
from app.api.ai_customer import router as ai_router
from app.services.auth import get_current_user

DATASET = "test-proj.test_ds"

# Endpoint path -> (logic fn name on the customer module, fake row dict).
ENDPOINTS = {
    "/api/ai/customers/segments": "rfm_segments",
    "/api/ai/customers/churn": "churn_risk",
    "/api/ai/customers/clv": "customer_clv",
    "/api/ai/customers/ar-risk": "ar_late_risk",
}


def _user():
    # ``role: owner`` resolves to the "*" permission set, satisfying the
    # ``require_perm("reports.read")`` gate on every endpoint.
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
    app.include_router(ai_router)
    app.dependency_overrides[get_current_user] = _user
    return TestClient(app, raise_server_exceptions=False)


# ── fake BigQuery plumbing ────────────────────────────────────────


def _fake_rows():
    """Two generic rows as plain dicts (Row supports mapping access).

    Each query reads only the columns it cares about via ``_get``, so a single
    superset row works for every endpoint's mapper.
    """
    return [
        {
            "customer": "Acme",
            "recency": 5,
            "frequency": 12,
            "monetary": 1234.567,
            "r": 5,
            "f": 5,
            "m": 5,
            "segment": "Champions",
            "last_purchase": "2026-05-30",
            "days_since": 5,
            "avg_gap_days": 10.4,
            "risk": "low",
            "historical": 9000.0,
            "avg_monthly": 750.0,
            "projected_clv": 18000.0,
            "invoice_id": "inv-1",
            "balance_due": 300.0,
            "days_outstanding": 45,
        },
        {
            "customer": "Globex",
            "recency": 200,
            "frequency": 1,
            "monetary": 50.0,
            "r": 1,
            "f": 1,
            "m": 1,
            "segment": "Lost",
            "last_purchase": "2025-11-10",
            "days_since": 200,
            "avg_gap_days": 90.0,
            "risk": "high",
            "historical": 50.0,
            "avg_monthly": 50.0,
            "projected_clv": 0.0,
            "invoice_id": "inv-2",
            "balance_due": 75.0,
            "days_outstanding": 120,
        },
    ]


def _make_fake_bq(rows=None, query_side_effect=None):
    """Build a fake ``bigquery`` module + the client/query-job mocks.

    Returns ``(fake_bq_module, client, captured)`` where ``captured`` collects
    the SQL strings + job configs passed to ``client.query``.
    """
    captured: dict = {"sql": [], "job_configs": []}

    job = MagicMock(name="QueryJob")
    job.result.return_value = list(rows if rows is not None else _fake_rows())

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
    # ScalarQueryParameter / QueryJobConfig just need to be callable + record.
    fake_bq.ScalarQueryParameter.side_effect = (
        lambda name, typ, val: {"name": name, "type": typ, "value": val}
    )
    fake_bq.QueryJobConfig.side_effect = lambda **kw: {"_job_config": kw}
    return fake_bq, client, captured


# ── SQL well-formedness ───────────────────────────────────────────


def test_rfm_sql_is_well_formed():
    sql = ci._rfm_sql()
    assert "fact_invoices" in sql
    assert "GROUP BY customer" in sql
    # RFM building blocks
    assert "DATE_DIFF(CURRENT_DATE(), MAX(date), DAY) AS recency" in sql
    assert "COUNT(*) AS frequency" in sql
    assert "SUM(total) AS monetary" in sql
    assert "NTILE(5)" in sql
    # all six named segments are mapped
    for seg in ("Champions", "Loyal", "Potential", "New", "At-Risk", "Lost"):
        assert seg in sql
    # draft/void excluded; org bound, never interpolated
    assert "status NOT IN ('draft', 'void')" in sql
    assert "@org_id" in sql
    assert "org-1" not in sql


def test_churn_sql_is_well_formed():
    sql = ci._churn_sql()
    assert "fact_invoices" in sql
    # inter-purchase gap via LAG + a median (APPROX_QUANTILES)
    assert "LAG(date)" in sql
    assert "APPROX_QUANTILES(gap_days, 2)" in sql
    assert "avg_gap_days" in sql
    assert "days_since" in sql
    assert "last_purchase" in sql
    # risk buckets present
    assert "'high'" in sql and "'medium'" in sql and "'low'" in sql
    assert "@org_id" in sql
    assert "org-1" not in sql


def test_clv_sql_is_well_formed():
    sql = ci._clv_sql()
    assert "fact_invoices" in sql
    assert "SUM(total) AS historical" in sql
    assert "avg_monthly" in sql
    assert "projected_clv" in sql
    # 24-month horizon, only for non-churned (recent) customers
    assert "* 24" in sql
    assert "days_since <= 90" in sql
    assert "@org_id" in sql
    assert "org-1" not in sql


def test_ar_late_sql_is_well_formed():
    sql = ci._ar_late_sql()
    assert "fact_invoices" in sql
    # only OPEN invoices: positive balance, not paid/void
    assert "balance_due > 0" in sql
    assert "status NOT IN ('paid', 'void')" in sql
    assert "days_outstanding" in sql
    assert "invoice_id" in sql
    # blends with the customer's historical lateness pattern
    assert "late_ratio" in sql
    assert "'high'" in sql and "'medium'" in sql and "'low'" in sql
    assert "@org_id" in sql
    assert "org-1" not in sql


# ── parameter binding (SQL-injection boundary) ────────────────────


@pytest.mark.parametrize("fn_name", list(ENDPOINTS.values()))
def test_logic_binds_org_param(fn_name):
    fake_bq, client, captured = _make_fake_bq()
    with patch.object(ci, "_bigquery", return_value=fake_bq):
        rows = getattr(ci, fn_name)("org-1")
    # exactly one query, org bound as a STRING parameter (never interpolated)
    assert len(captured["sql"]) == 1
    fake_bq.ScalarQueryParameter.assert_any_call("org_id", "STRING", "org-1")
    assert "org-1" not in captured["sql"][0]
    assert len(rows) == 2


def test_logic_never_interpolates_malicious_org_id():
    """An org_id full of SQL metacharacters must never reach the SQL text."""
    evil = "'; DROP TABLE fact_invoices; --"
    fake_bq, client, captured = _make_fake_bq()
    with patch.object(ci, "_bigquery", return_value=fake_bq):
        for fn_name in ENDPOINTS.values():
            getattr(ci, fn_name)(evil)
    assert captured["sql"], "expected queries"
    for sql in captured["sql"]:
        assert "DROP TABLE" not in sql
        assert "'; " not in sql
    # the raw value is carried only as a bound parameter
    fake_bq.ScalarQueryParameter.assert_any_call("org_id", "STRING", evil)


def test_logic_uses_project_pinned_client():
    """Client is constructed with an explicit project (not ambient ADC)."""
    fake_bq, client, captured = _make_fake_bq()
    with patch.object(ci, "_bigquery", return_value=fake_bq):
        ci.rfm_segments("org-1")
    # project= kwarg present and non-empty (parsed from the dataset ref)
    _, kwargs = fake_bq.Client.call_args
    assert kwargs.get("project")


# ── row mapping ───────────────────────────────────────────────────


def test_rfm_maps_rows():
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(ci, "_bigquery", return_value=fake_bq):
        rows = ci.rfm_segments("org-1")
    assert rows[0] == {
        "customer": "Acme",
        "recency": 5,
        "frequency": 12,
        "monetary": 1234.57,
        "r": 5,
        "f": 5,
        "m": 5,
        "segment": "Champions",
    }


def test_churn_maps_rows():
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(ci, "_bigquery", return_value=fake_bq):
        rows = ci.churn_risk("org-1")
    assert rows[1] == {
        "customer": "Globex",
        "last_purchase": "2025-11-10",
        "days_since": 200,
        "avg_gap_days": 90.0,
        "risk": "high",
    }


def test_clv_maps_rows():
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(ci, "_bigquery", return_value=fake_bq):
        rows = ci.customer_clv("org-1")
    assert rows[0] == {
        "customer": "Acme",
        "historical": 9000.0,
        "avg_monthly": 750.0,
        "projected_clv": 18000.0,
    }


def test_ar_maps_rows():
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(ci, "_bigquery", return_value=fake_bq):
        rows = ci.ar_late_risk("org-1")
    assert rows[0] == {
        "invoice_id": "inv-1",
        "customer": "Acme",
        "balance_due": 300.0,
        "days_outstanding": 45,
        "risk": "low",
    }


# ── endpoints: happy path ─────────────────────────────────────────


@pytest.mark.parametrize("path", list(ENDPOINTS))
def test_endpoint_shape_ok(client, path):
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(ci, "_bigquery", return_value=fake_bq):
        resp = client.get(path)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert isinstance(body["rows"], list)
    assert len(body["rows"]) == 2
    assert set(body) == {"rows", "status"}


def test_segments_endpoint_returns_segment_rows(client):
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(ci, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/ai/customers/segments")
    rows = resp.json()["rows"]
    assert rows[0]["segment"] == "Champions"
    assert set(rows[0]) == {
        "customer", "recency", "frequency", "monetary", "r", "f", "m", "segment",
    }


# ── endpoints: graceful degradation (never 500) ───────────────────


@pytest.mark.parametrize("path", list(ENDPOINTS))
def test_endpoint_warehouse_not_configured(monkeypatch, path):
    monkeypatch.delenv("ANALYTICS_BQ_DATASET", raising=False)
    app = FastAPI()
    app.include_router(ai_router)
    app.dependency_overrides[get_current_user] = _user
    c = TestClient(app, raise_server_exceptions=False)
    resp = c.get(path)
    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    assert body["status"] == "warehouse_not_configured"


@pytest.mark.parametrize("path", list(ENDPOINTS))
def test_endpoint_graceful_when_bq_raises(client, path):
    def _side_effect(sql, job_config):
        raise RuntimeError("BigQuery exploded")

    fake_bq, _client, _captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(ci, "_bigquery", return_value=fake_bq):
        resp = client.get(path)
    # graceful: HTTP 200, empty rows, status explains why — never 500
    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    assert body["status"] == "warehouse_not_configured"


@pytest.mark.parametrize("path", list(ENDPOINTS))
def test_endpoint_graceful_when_bq_lib_missing(client, path):
    with patch.object(ci, "_bigquery", return_value=None):
        resp = client.get(path)
    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    assert body["status"] == "warehouse_not_configured"


def test_endpoint_no_injection_via_user_org_id(monkeypatch):
    """An authenticated org_id with metacharacters must not reach the SQL text."""
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", DATASET)
    app = FastAPI()
    app.include_router(ai_router)
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "u", "org_id": "'; DROP TABLE fact_invoices; --",
        "email": "x", "name": "x", "role": "owner",
    }
    c = TestClient(app, raise_server_exceptions=False)
    fake_bq, _client, captured = _make_fake_bq()
    with patch.object(ci, "_bigquery", return_value=fake_bq):
        resp = c.get("/api/ai/customers/segments")
    assert resp.status_code == 200
    assert captured["sql"], "expected at least one query"
    for sql in captured["sql"]:
        assert "DROP TABLE" not in sql
        assert "'; " not in sql


# ── auth gate ─────────────────────────────────────────────────────


@pytest.mark.parametrize("path", list(ENDPOINTS))
def test_endpoint_forbidden_without_reports_read(monkeypatch, path):
    """A user whose role lacks ``reports.read`` is rejected with 403."""
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", DATASET)
    app = FastAPI()
    app.include_router(ai_router)
    # cashier role: POS perms only, no reports.read
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "u", "org_id": "org-1", "email": "x", "name": "x", "role": "cashier",
    }
    c = TestClient(app, raise_server_exceptions=False)
    assert c.get(path).status_code == 403


# ── router contract ───────────────────────────────────────────────


def test_router_prefix_and_paths():
    assert ai_router.prefix == "/api/ai"
    paths = {r.path for r in ai_router.routes}
    assert paths == {
        "/api/ai/customers/segments",
        "/api/ai/customers/churn",
        "/api/ai/customers/clv",
        "/api/ai/customers/ar-risk",
    }
