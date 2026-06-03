"""Tests for the BQML revenue/cash-flow forecast API (Pool 4.6).

We never touch real BigQuery: ``app.api.forecast._bigquery`` is patched to hand
back a fake ``bigquery`` module whose ``Client()`` is a ``MagicMock`` we drive.
That lets us:
  * capture the SQL handed to ``client.query(...)`` and assert the ARIMA_PLUS
    DDL + ``ML.FORECAST`` are well-formed,
  * prove ``org_id`` is sanitised into the model identifier (no SQL injection),
  * check the endpoint response shape, and
  * verify graceful HTTP-200 empty results when the env is unset or BQ raises.

Mirrors the mocking style of ``tests/test_wms_api.py`` (FastAPI app +
``dependency_overrides[get_current_user]`` + ``unittest.mock``).
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import forecast as forecast_mod
from app.api.forecast import router as forecast_router
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
    app.include_router(forecast_router)
    app.dependency_overrides[get_current_user] = _user
    return TestClient(app, raise_server_exceptions=False)


# ── fake BigQuery plumbing ────────────────────────────────────────


def _fake_rows():
    """Two ML.FORECAST rows as plain dicts (Row supports mapping access)."""
    return [
        {
            "forecast_timestamp": "2026-07-01T00:00:00",
            "forecast_value": 1234.567,
            "prediction_interval_lower_bound": 1000.0,
            "prediction_interval_upper_bound": 1500.0,
        },
        {
            "forecast_timestamp": "2026-08-01T00:00:00",
            "forecast_value": 2000.0,
            "prediction_interval_lower_bound": 1800.0,
            "prediction_interval_upper_bound": 2200.0,
        },
    ]


def _make_fake_bq(rows=None, query_side_effect=None):
    """Build a fake ``bigquery`` module + the client/query-job mocks.

    Returns ``(fake_bq_module, client, captured)`` where ``captured`` collects
    the SQL strings passed to ``client.query``.
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


# ── org-slug sanitization (SQL-injection boundary) ────────────────


def test_org_slug_strips_unsafe_chars():
    # Anything outside [a-z0-9_] collapses to '_'; nothing injectable survives.
    assert forecast_mod.org_slug("Org-1") == "org_1"
    assert forecast_mod.org_slug("ABC_123") == "abc_123"
    assert forecast_mod.org_slug("a`b;c--d") == "a_b_c_d"
    slug = forecast_mod.org_slug("'; DROP TABLE fact_invoices; --")
    assert all(c.isalnum() or c == "_" for c in slug)
    assert "DROP" not in slug and "'" not in slug and ";" not in slug


def test_org_slug_empty_falls_back_to_hash():
    slug = forecast_mod.org_slug("///")
    assert slug and all(c.isalnum() or c == "_" for c in slug)
    # Distinct empties stay distinct, deterministic.
    assert forecast_mod.org_slug("///") == slug
    assert forecast_mod.org_slug("???") != slug


def test_model_name_uses_sanitized_slug_only():
    ref = forecast_mod._model_ref("Org/1; DROP")
    assert ref.endswith("revenue_arima_org_1_drop")
    # raw org id never appears verbatim in the identifier
    assert "Org/1" not in ref and ";" not in ref and " " not in ref


# ── SQL well-formedness ───────────────────────────────────────────


def test_train_sql_is_well_formed():
    sql = forecast_mod._train_sql("org-1")
    assert "CREATE OR REPLACE MODEL" in sql
    assert "ARIMA_PLUS" in sql
    assert "data_frequency='MONTHLY'" in sql
    assert "time_series_timestamp_col='month'" in sql
    assert "time_series_data_col='revenue'" in sql
    # org filter is parameterised, never interpolated
    assert "@org_id" in sql
    assert "org-1" not in sql  # raw value must not leak into SQL text
    assert "DATE_TRUNC(date, MONTH)" in sql
    assert "fact_invoices" in sql
    assert "status NOT IN ('draft', 'void')" in sql
    # model name carries the sanitised slug
    assert "revenue_arima_org_1" in sql


def test_forecast_sql_is_well_formed():
    sql = forecast_mod._forecast_sql("org-1", 6)
    assert "ML.FORECAST" in sql
    assert "revenue_arima_org_1" in sql
    # ML.FORECAST settings must be literal constants (no @params) — horizon is
    # the validated int inlined directly.
    assert "6 AS horizon" in sql
    assert "@periods" not in sql
    assert "0.8 AS confidence_level" in sql


# ── train / forecast core ─────────────────────────────────────────


def test_train_revenue_model_binds_org_param():
    fake_bq, client, captured = _make_fake_bq()
    with patch.object(forecast_mod, "_bigquery", return_value=fake_bq):
        forecast_mod.train_revenue_model("org-1")
    # exactly one CREATE MODEL query, org bound as a parameter
    assert len(captured["sql"]) == 1
    assert "CREATE OR REPLACE MODEL" in captured["sql"][0]
    fake_bq.ScalarQueryParameter.assert_any_call("org_id", "STRING", "org-1")


def test_forecast_revenue_maps_rows():
    fake_bq, client, captured = _make_fake_bq()
    with patch.object(forecast_mod, "_bigquery", return_value=fake_bq):
        points = forecast_mod.forecast_revenue("org-1", periods=2)
    assert points == [
        {"period": "2026-07-01T00:00:00", "forecast": 1234.57, "lower": 1000.0, "upper": 1500.0},
        {"period": "2026-08-01T00:00:00", "forecast": 2000.0, "lower": 1800.0, "upper": 2200.0},
    ]
    # horizon is inlined as a literal in the ML.FORECAST settings (not a @param).
    assert any("2 AS horizon" in s for s in captured["sql"])


def test_forecast_revenue_trains_on_model_miss_then_retries():
    """First ML.FORECAST raises (model absent) -> train -> retry succeeds."""
    state = {"forecast_calls": 0}
    job = MagicMock()
    job.result.return_value = _fake_rows()

    def _side_effect(sql, job_config):
        if "ML.FORECAST" in sql:
            state["forecast_calls"] += 1
            if state["forecast_calls"] == 1:
                raise RuntimeError("Not found: Model revenue_arima_org_1")
            return job
        # the CREATE MODEL training call
        return job

    fake_bq, client, captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(forecast_mod, "_bigquery", return_value=fake_bq):
        points = forecast_mod.forecast_revenue("org-1", periods=6)

    assert state["forecast_calls"] == 2  # retried after training
    assert any("CREATE OR REPLACE MODEL" in s for s in captured["sql"])
    assert len(points) == 2


def test_forecast_revenue_propagates_insufficient_data():
    """If training also raises (e.g. too little history), it propagates."""

    def _side_effect(sql, job_config):
        raise RuntimeError("Not enough data points to train ARIMA model")

    fake_bq, client, captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(forecast_mod, "_bigquery", return_value=fake_bq):
        with pytest.raises(RuntimeError):
            forecast_mod.forecast_revenue("org-1", periods=6)


# ── endpoint: happy path ──────────────────────────────────────────


def test_revenue_endpoint_shape(client):
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(forecast_mod, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/analytics/forecast/revenue?periods=2")
    assert resp.status_code == 200
    body = resp.json()
    assert body["org_id"] == "org-1"
    assert body["periods"] == 2
    assert body["model"] == "bqml_arima_plus"
    assert body["status"] == "ok"
    assert len(body["points"]) == 2
    pt = body["points"][0]
    assert set(pt) == {"period", "forecast", "lower", "upper"}
    assert pt["forecast"] == 1234.57


def test_revenue_endpoint_periods_bounds(client):
    # ge=1, le=24 enforced by FastAPI Query validation -> 422.
    assert client.get("/api/analytics/forecast/revenue?periods=0").status_code == 422
    assert client.get("/api/analytics/forecast/revenue?periods=25").status_code == 422


# ── endpoint: graceful degradation (never 500) ────────────────────


def test_revenue_endpoint_warehouse_not_configured(monkeypatch):
    monkeypatch.delenv("ANALYTICS_BQ_DATASET", raising=False)
    app = FastAPI()
    app.include_router(forecast_router)
    app.dependency_overrides[get_current_user] = _user
    c = TestClient(app, raise_server_exceptions=False)
    resp = c.get("/api/analytics/forecast/revenue")
    assert resp.status_code == 200
    body = resp.json()
    assert body["points"] == []
    assert body["status"] == "warehouse_not_configured"


def test_revenue_endpoint_insufficient_data_when_bq_raises(client):
    def _side_effect(sql, job_config):
        raise RuntimeError("Not enough data points to train ARIMA model")

    fake_bq, _client, _captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(forecast_mod, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/analytics/forecast/revenue?periods=6")
    # graceful: HTTP 200, empty points, status explains why — never 500
    assert resp.status_code == 200
    body = resp.json()
    assert body["points"] == []
    assert body["status"] == "insufficient_data"


def test_revenue_endpoint_graceful_when_bq_lib_missing(client):
    with patch.object(forecast_mod, "_bigquery", return_value=None):
        resp = client.get("/api/analytics/forecast/revenue?periods=6")
    assert resp.status_code == 200
    assert resp.json()["status"] == "insufficient_data"


def test_revenue_endpoint_no_injection_in_model_name(client):
    """org_id with SQL metacharacters must not appear raw in any emitted SQL."""
    app = FastAPI()
    app.include_router(forecast_router)
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "u", "org_id": "'; DROP TABLE fact_invoices; --",
        "email": "x", "name": "x", "role": "owner",
    }
    c = TestClient(app, raise_server_exceptions=False)
    fake_bq, _client, captured = _make_fake_bq()
    with patch.object(forecast_mod, "_bigquery", return_value=fake_bq):
        resp = c.get("/api/analytics/forecast/revenue?periods=3")
    assert resp.status_code == 200
    assert captured["sql"], "expected at least one query"
    for sql in captured["sql"]:
        # raw metacharacters must never reach the SQL text (identifier or filter)
        assert "DROP TABLE" not in sql
        assert "'; " not in sql
    # the model identifier carries only the sanitised slug
    assert any("revenue_arima_drop_table_fact_invoices" in s for s in captured["sql"])


# ── cashflow endpoint ─────────────────────────────────────────────


def test_cashflow_endpoint_projects_balance(client):
    rows = [{"outstanding": 300.0}]
    fake_bq, _client, captured = _make_fake_bq(rows=rows)
    with patch.object(forecast_mod, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/analytics/forecast/cashflow?days=3")
    assert resp.status_code == 200
    body = resp.json()
    assert body["days"] == 3
    assert body["status"] == "ok"
    assert len(body["points"]) == 3
    # 300 spread over 3 days -> 100/day
    assert body["points"][0]["forecast"] == 100.0
    assert set(body["points"][0]) == {"period", "forecast", "lower", "upper"}
    # query filters by org param + balance_due
    assert "balance_due" in captured["sql"][0]


def test_cashflow_endpoint_warehouse_not_configured(monkeypatch):
    monkeypatch.delenv("ANALYTICS_BQ_DATASET", raising=False)
    app = FastAPI()
    app.include_router(forecast_router)
    app.dependency_overrides[get_current_user] = _user
    c = TestClient(app, raise_server_exceptions=False)
    resp = c.get("/api/analytics/forecast/cashflow")
    assert resp.status_code == 200
    assert resp.json()["status"] == "warehouse_not_configured"


# ── auth gate ─────────────────────────────────────────────────────


def test_revenue_endpoint_forbidden_without_reports_read(monkeypatch):
    """A user whose role lacks ``reports.read`` is rejected with 403."""
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", DATASET)
    app = FastAPI()
    app.include_router(forecast_router)
    # cashier role: POS perms only, no reports.read
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "u", "org_id": "org-1", "email": "x", "name": "x", "role": "cashier",
    }
    c = TestClient(app, raise_server_exceptions=False)
    assert c.get("/api/analytics/forecast/revenue").status_code == 403
    assert c.get("/api/analytics/forecast/cashflow").status_code == 403


# ── router contract ───────────────────────────────────────────────


def test_router_prefix_and_paths():
    assert forecast_router.prefix == "/api/analytics"
    paths = {r.path for r in forecast_router.routes}
    assert "/api/analytics/forecast/revenue" in paths
    assert "/api/analytics/forecast/cashflow" in paths
    # must NOT collide with the sibling analytics router's paths
    assert "/api/analytics/query" not in paths
    assert "/api/analytics/saved" not in paths
    assert "/api/analytics/facts" not in paths
