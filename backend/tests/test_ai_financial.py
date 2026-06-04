"""Tests for the financial-prediction AI API (Pool 4.6+).

We never touch real BigQuery: ``app.analytics.ai.financial._bigquery`` is patched
to hand back a fake ``bigquery`` module whose ``Client()`` is a ``MagicMock`` we
drive (the same plumbing as ``tests/test_forecast_api.py``). That lets us:
  * capture the SQL handed to ``client.query(...)`` and assert the expense
    ARIMA_PLUS DDL targets ``fact_bills`` with a *literal* horizon (not @param),
  * prove ``org_id`` is bound as a parameter (never interpolated),
  * assert the payment-date proxy SQL is well-formed,
  * check the margin endpoint aligns the revenue + expense series, and
  * verify graceful HTTP-200 empty results when the env is unset or BQ raises.

Mirrors the mocking style of ``tests/test_forecast_api.py``.
"""
from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.analytics.ai import financial as fin
from app.api import forecast as forecast_mod
from app.api.ai_financial import router as ai_financial_router
from app.services.auth import get_current_user

DATASET = "test-proj.test_ds"


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
    app.include_router(ai_financial_router)
    app.dependency_overrides[get_current_user] = _user
    return TestClient(app, raise_server_exceptions=False)


# ── fake BigQuery plumbing ────────────────────────────────────────


def _fake_forecast_rows():
    """Two ML.FORECAST rows as plain dicts (Row supports mapping access)."""
    return [
        {
            "forecast_timestamp": "2026-07-01T00:00:00",
            "forecast_value": 400.0,
            "prediction_interval_lower_bound": 350.0,
            "prediction_interval_upper_bound": 450.0,
        },
        {
            "forecast_timestamp": "2026-08-01T00:00:00",
            "forecast_value": 600.5,
            "prediction_interval_lower_bound": 500.0,
            "prediction_interval_upper_bound": 700.0,
        },
    ]


def _make_fake_bq(rows=None, query_side_effect=None):
    """Build a fake ``bigquery`` module + the client/query-job mocks.

    Returns ``(fake_bq_module, client, captured)`` where ``captured`` collects
    the SQL strings + job_configs passed to ``client.query``.
    """
    captured: dict = {"sql": [], "job_configs": []}

    job = MagicMock(name="QueryJob")
    job.result.return_value = list(rows if rows is not None else _fake_forecast_rows())

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
    fake_bq.ScalarQueryParameter.side_effect = (
        lambda name, typ, val: {"name": name, "type": typ, "value": val}
    )
    fake_bq.QueryJobConfig.side_effect = lambda **kw: {"_job_config": kw}
    return fake_bq, client, captured


# ── model-name slug (SQL-injection boundary) ──────────────────────


def test_expense_model_ref_uses_sanitized_slug_only():
    ref = fin._expense_model_ref("Org/1; DROP")
    assert ref.endswith("expense_arima_org_1_drop")
    # raw org id never appears verbatim in the identifier
    assert "Org/1" not in ref and ";" not in ref and " " not in ref


# ── expense ARIMA SQL well-formedness (on fact_bills) ─────────────


def test_expense_train_sql_is_well_formed():
    sql = fin._expense_train_sql("org-1")
    assert "CREATE OR REPLACE MODEL" in sql
    assert "ARIMA_PLUS" in sql
    assert "data_frequency='MONTHLY'" in sql
    assert "time_series_timestamp_col='month'" in sql
    assert "time_series_data_col='expense'" in sql
    # expense series comes from fact_bills (NOT fact_invoices)
    assert "fact_bills" in sql
    assert "fact_invoices" not in sql
    assert "DATE_TRUNC(date, MONTH)" in sql
    assert "SUM(total)" in sql
    assert "status NOT IN ('draft', 'void')" in sql
    # org filter is parameterised, never interpolated
    assert "@org_id" in sql
    assert "org-1" not in sql  # raw value must not leak into SQL text
    # model name carries the sanitised slug
    assert "expense_arima_org_1" in sql


def test_expense_forecast_sql_literal_horizon_not_param():
    sql = fin._expense_forecast_sql("org-1", 6)
    assert "ML.FORECAST" in sql
    assert "expense_arima_org_1" in sql
    # ML.FORECAST settings must be literal constants (no @params) — horizon is
    # the validated int inlined directly.
    assert "6 AS horizon" in sql
    assert "@periods" not in sql
    assert "@horizon" not in sql
    assert "0.8 AS confidence_level" in sql


# ── expense train / forecast core ─────────────────────────────────


def test_train_expense_model_binds_org_param():
    fake_bq, client, captured = _make_fake_bq()
    with patch.object(fin, "_bigquery", return_value=fake_bq):
        fin.train_expense_model("org-1")
    # project-pinned client
    fake_bq.Client.assert_called_once_with(project=forecast_mod.project_id())
    # exactly one CREATE MODEL query, org bound as a parameter
    assert len(captured["sql"]) == 1
    assert "CREATE OR REPLACE MODEL" in captured["sql"][0]
    fake_bq.ScalarQueryParameter.assert_any_call("org_id", "STRING", "org-1")


def test_expense_forecast_maps_rows():
    fake_bq, client, captured = _make_fake_bq()
    with patch.object(fin, "_bigquery", return_value=fake_bq):
        points = fin.expense_forecast("org-1", periods=2)
    assert points == [
        {"period": "2026-07-01T00:00:00", "forecast": 400.0, "lower": 350.0, "upper": 450.0},
        {"period": "2026-08-01T00:00:00", "forecast": 600.5, "lower": 500.0, "upper": 700.0},
    ]
    # horizon inlined as a literal in ML.FORECAST settings (not a @param)
    assert any("2 AS horizon" in s for s in captured["sql"])


def test_expense_forecast_trains_on_model_miss_then_retries():
    """First ML.FORECAST raises (model absent) -> train -> retry succeeds."""
    state = {"forecast_calls": 0}
    job = MagicMock()
    job.result.return_value = _fake_forecast_rows()

    def _side_effect(sql, job_config):
        if "ML.FORECAST" in sql:
            state["forecast_calls"] += 1
            if state["forecast_calls"] == 1:
                raise RuntimeError("Not found: Model expense_arima_org_1")
            return job
        return job  # the CREATE MODEL training call

    fake_bq, client, captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(fin, "_bigquery", return_value=fake_bq):
        points = fin.expense_forecast("org-1", periods=6)

    assert state["forecast_calls"] == 2  # retried after training
    assert any("CREATE OR REPLACE MODEL" in s for s in captured["sql"])
    assert len(points) == 2


def test_expense_forecast_propagates_insufficient_data():
    """If training also raises (too little history), it propagates."""

    def _side_effect(sql, job_config):
        raise RuntimeError("Not enough data points to train ARIMA model")

    fake_bq, client, captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(fin, "_bigquery", return_value=fake_bq):
        with pytest.raises(RuntimeError):
            fin.expense_forecast("org-1", periods=6)


# ── payment-date proxy SQL ────────────────────────────────────────


def test_settlement_lag_sql_well_formed():
    sql = fin._settlement_lag_sql()
    # median age of currently-paid invoices = the settlement-lag proxy
    assert "fact_invoices" in sql
    assert "status = 'paid'" in sql
    assert "APPROX_QUANTILES" in sql
    assert "DATE_DIFF(CURRENT_DATE()" in sql
    assert "@org_id" in sql


def test_open_invoices_sql_well_formed():
    sql = fin._open_invoices_sql()
    assert "fact_invoices" in sql
    assert "balance_due > 0" in sql
    # OPEN means not already settled (paid/void)
    assert "status NOT IN ('paid', 'void')" in sql
    assert "@org_id" in sql
    assert "days_open" in sql


def test_payment_date_prediction_uses_settlement_lag():
    """avg lag (median paid-invoice age) + invoice_date -> predicted date."""
    inv_date = "2026-01-01"

    def _side_effect(sql, job_config):
        j = MagicMock()
        if "status = 'paid'" in sql:
            # org settles in ~20 days historically
            j.result.return_value = [{"avg_settle_days": 20, "paid_count": 5}]
        else:
            j.result.return_value = [
                {
                    "invoice_id": "inv-9",
                    "customer": "Acme",
                    "balance_due": 500.0,
                    "invoice_date": inv_date,
                    "days_open": 999,
                }
            ]
        return j

    fake_bq, client, captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(fin, "_bigquery", return_value=fake_bq):
        rows = fin.payment_date_prediction("org-1")

    assert len(rows) == 1
    r = rows[0]
    assert set(r) == {
        "invoice_id", "customer", "balance_due", "invoice_date",
        "predicted_payment_date", "days_overdue",
    }
    assert r["invoice_id"] == "inv-9"
    assert r["balance_due"] == 500.0
    assert r["invoice_date"] == inv_date
    # predicted = invoice_date + 20 days
    assert r["predicted_payment_date"] == "2026-01-21"
    # both queries bound org_id as a parameter
    fake_bq.ScalarQueryParameter.assert_any_call("org_id", "STRING", "org-1")
    # days_overdue is the gap from predicted to today (predicted is far in past)
    expected_overdue = (date.today() - date(2026, 1, 21)).days
    assert r["days_overdue"] == expected_overdue


def test_payment_date_prediction_falls_back_when_no_paid_history():
    """No paid invoices -> documented 30-day fallback lag."""
    inv_date = (date.today() - timedelta(days=5)).isoformat()

    def _side_effect(sql, job_config):
        j = MagicMock()
        if "status = 'paid'" in sql:
            j.result.return_value = [{"avg_settle_days": None, "paid_count": 0}]
        else:
            j.result.return_value = [
                {
                    "invoice_id": "inv-1",
                    "customer": "Beta",
                    "balance_due": 100.0,
                    "invoice_date": inv_date,
                    "days_open": 5,
                }
            ]
        return j

    fake_bq, client, captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(fin, "_bigquery", return_value=fake_bq):
        rows = fin.payment_date_prediction("org-1")

    expected = (date.fromisoformat(inv_date) + timedelta(days=fin.DEFAULT_SETTLEMENT_DAYS)).isoformat()
    assert rows[0]["predicted_payment_date"] == expected
    # predicted is in the future (invoice 5 days ago + 30) -> not overdue
    assert rows[0]["days_overdue"] == 0


# ── margin alignment (revenue + expense) ──────────────────────────


def test_margin_forecast_aligns_revenue_and_expense():
    """margin = revenue − expense, joined by month; patches forecast_revenue."""
    revenue_pts = [
        {"period": "2026-07-01T00:00:00", "forecast": 1000.0, "lower": 0, "upper": 0},
        {"period": "2026-08-01T00:00:00", "forecast": 1200.0, "lower": 0, "upper": 0},
    ]
    expense_pts = [
        {"period": "2026-07-01T00:00:00", "forecast": 400.0, "lower": 0, "upper": 0},
        {"period": "2026-08-01T00:00:00", "forecast": 600.0, "lower": 0, "upper": 0},
    ]
    with patch.object(forecast_mod, "forecast_revenue", return_value=revenue_pts), \
         patch.object(fin, "expense_forecast", return_value=expense_pts):
        out = fin.margin_forecast("org-1", periods=2)

    assert out == [
        {"period": "2026-07-01T00:00:00", "revenue": 1000.0, "expense": 400.0, "margin": 600.0},
        {"period": "2026-08-01T00:00:00", "revenue": 1200.0, "expense": 600.0, "margin": 600.0},
    ]


def test_margin_forecast_degrades_when_expense_side_insufficient():
    """If expense raises, revenue-only periods still resolve (expense=0)."""
    revenue_pts = [
        {"period": "2026-07-01T00:00:00", "forecast": 1000.0, "lower": 0, "upper": 0},
    ]
    with patch.object(forecast_mod, "forecast_revenue", return_value=revenue_pts), \
         patch.object(fin, "expense_forecast", side_effect=RuntimeError("insufficient")):
        out = fin.margin_forecast("org-1", periods=6)

    assert out == [
        {"period": "2026-07-01T00:00:00", "revenue": 1000.0, "expense": 0.0, "margin": 1000.0},
    ]


def test_margin_forecast_empty_when_both_sides_insufficient():
    with patch.object(forecast_mod, "forecast_revenue", side_effect=RuntimeError("x")), \
         patch.object(fin, "expense_forecast", side_effect=RuntimeError("y")):
        assert fin.margin_forecast("org-1", periods=6) == []


# ── endpoints: happy path ─────────────────────────────────────────


def test_expenses_endpoint_shape(client):
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(fin, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/ai/predict/expenses?periods=2")
    assert resp.status_code == 200
    body = resp.json()
    assert body["org_id"] == "org-1"
    assert body["periods"] == 2
    assert body["model"] == "bqml_arima_plus"
    assert body["status"] == "ok"
    assert len(body["points"]) == 2
    pt = body["points"][0]
    assert set(pt) == {"period", "forecast", "lower", "upper"}
    assert pt["forecast"] == 400.0


def test_margin_endpoint_shape(client):
    revenue_pts = [{"period": "2026-07-01T00:00:00", "forecast": 1000.0, "lower": 0, "upper": 0}]
    expense_pts = [{"period": "2026-07-01T00:00:00", "forecast": 400.0, "lower": 0, "upper": 0}]
    with patch.object(forecast_mod, "forecast_revenue", return_value=revenue_pts), \
         patch.object(fin, "expense_forecast", return_value=expense_pts):
        resp = client.get("/api/ai/predict/margin?periods=2")
    assert resp.status_code == 200
    body = resp.json()
    assert body["model"] == "revenue_minus_expense"
    assert body["status"] == "ok"
    assert body["points"] == [
        {"period": "2026-07-01T00:00:00", "revenue": 1000.0, "expense": 400.0, "margin": 600.0},
    ]


def test_payment_dates_endpoint_shape(client):
    def _side_effect(sql, job_config):
        j = MagicMock()
        if "status = 'paid'" in sql:
            j.result.return_value = [{"avg_settle_days": 15, "paid_count": 3}]
        else:
            j.result.return_value = [
                {
                    "invoice_id": "inv-7",
                    "customer": "Gamma",
                    "balance_due": 250.0,
                    "invoice_date": "2026-02-01",
                    "days_open": 100,
                }
            ]
        return j

    fake_bq, _client, _captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(fin, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/ai/predict/payment-dates")
    assert resp.status_code == 200
    body = resp.json()
    assert body["model"] == "settlement_lag_proxy"
    assert body["status"] == "ok"
    assert len(body["rows"]) == 1
    assert body["rows"][0]["predicted_payment_date"] == "2026-02-16"


# ── endpoints: validation ─────────────────────────────────────────


def test_expenses_endpoint_periods_bounds(client):
    # ge=1, le=24 enforced by FastAPI Query validation -> 422.
    assert client.get("/api/ai/predict/expenses?periods=0").status_code == 422
    assert client.get("/api/ai/predict/expenses?periods=25").status_code == 422


# ── endpoints: graceful degradation (never 500) ───────────────────


def test_expenses_endpoint_warehouse_not_configured(monkeypatch):
    monkeypatch.delenv("ANALYTICS_BQ_DATASET", raising=False)
    app = FastAPI()
    app.include_router(ai_financial_router)
    app.dependency_overrides[get_current_user] = _user
    c = TestClient(app, raise_server_exceptions=False)
    resp = c.get("/api/ai/predict/expenses")
    assert resp.status_code == 200
    body = resp.json()
    assert body["points"] == []
    assert body["status"] == "warehouse_not_configured"


def test_margin_endpoint_warehouse_not_configured(monkeypatch):
    monkeypatch.delenv("ANALYTICS_BQ_DATASET", raising=False)
    app = FastAPI()
    app.include_router(ai_financial_router)
    app.dependency_overrides[get_current_user] = _user
    c = TestClient(app, raise_server_exceptions=False)
    resp = c.get("/api/ai/predict/margin")
    assert resp.status_code == 200
    assert resp.json()["points"] == []
    assert resp.json()["status"] == "warehouse_not_configured"


def test_payment_dates_endpoint_warehouse_not_configured(monkeypatch):
    monkeypatch.delenv("ANALYTICS_BQ_DATASET", raising=False)
    app = FastAPI()
    app.include_router(ai_financial_router)
    app.dependency_overrides[get_current_user] = _user
    c = TestClient(app, raise_server_exceptions=False)
    resp = c.get("/api/ai/predict/payment-dates")
    assert resp.status_code == 200
    assert resp.json()["rows"] == []
    assert resp.json()["status"] == "warehouse_not_configured"


def test_expenses_endpoint_insufficient_when_bq_raises(client):
    def _side_effect(sql, job_config):
        raise RuntimeError("Not enough data points to train ARIMA model")

    fake_bq, _client, _captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(fin, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/ai/predict/expenses?periods=6")
    assert resp.status_code == 200
    assert resp.json()["points"] == []
    assert resp.json()["status"] == "insufficient_data"


def test_margin_endpoint_insufficient_when_both_sides_fail(client):
    with patch.object(forecast_mod, "forecast_revenue", side_effect=RuntimeError("x")), \
         patch.object(fin, "expense_forecast", side_effect=RuntimeError("y")):
        resp = client.get("/api/ai/predict/margin?periods=6")
    assert resp.status_code == 200
    assert resp.json()["points"] == []
    assert resp.json()["status"] == "insufficient_data"


def test_payment_dates_endpoint_graceful_when_bq_lib_missing(client):
    with patch.object(fin, "_bigquery", return_value=None):
        resp = client.get("/api/ai/predict/payment-dates")
    assert resp.status_code == 200
    assert resp.json()["rows"] == []
    assert resp.json()["status"] == "insufficient_data"


def test_expenses_endpoint_graceful_when_bq_lib_missing(client):
    with patch.object(fin, "_bigquery", return_value=None):
        resp = client.get("/api/ai/predict/expenses?periods=6")
    assert resp.status_code == 200
    assert resp.json()["status"] == "insufficient_data"


# ── no-injection in emitted SQL ───────────────────────────────────


def test_expenses_endpoint_no_injection_in_model_name(client):
    """org_id with SQL metacharacters must not appear raw in any emitted SQL."""
    app = FastAPI()
    app.include_router(ai_financial_router)
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "u", "org_id": "'; DROP TABLE fact_bills; --",
        "email": "x", "name": "x", "role": "owner",
    }
    c = TestClient(app, raise_server_exceptions=False)
    fake_bq, _client, captured = _make_fake_bq()
    with patch.object(fin, "_bigquery", return_value=fake_bq):
        resp = c.get("/api/ai/predict/expenses?periods=3")
    assert resp.status_code == 200
    assert captured["sql"], "expected at least one query"
    for sql in captured["sql"]:
        assert "DROP TABLE" not in sql
        assert "'; " not in sql
    # the model identifier carries only the sanitised slug
    assert any("expense_arima_drop_table_fact_bills" in s for s in captured["sql"])


# ── auth gate ─────────────────────────────────────────────────────


def test_endpoints_forbidden_without_reports_read(monkeypatch):
    """A user whose role lacks ``reports.read`` is rejected with 403."""
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", DATASET)
    app = FastAPI()
    app.include_router(ai_financial_router)
    # cashier role: POS perms only, no reports.read
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "u", "org_id": "org-1", "email": "x", "name": "x", "role": "cashier",
    }
    c = TestClient(app, raise_server_exceptions=False)
    assert c.get("/api/ai/predict/expenses").status_code == 403
    assert c.get("/api/ai/predict/margin").status_code == 403
    assert c.get("/api/ai/predict/payment-dates").status_code == 403


# ── router contract (no path collisions) ──────────────────────────


def test_router_prefix_and_paths():
    assert ai_financial_router.prefix == "/api/ai"
    paths = {r.path for r in ai_financial_router.routes}
    assert "/api/ai/predict/expenses" in paths
    assert "/api/ai/predict/margin" in paths
    assert "/api/ai/predict/payment-dates" in paths
    # must NOT collide with the sibling AI routers' existing paths
    assert "/api/ai/customers/segments" not in paths
    assert "/api/ai/anomalies/transactions" not in paths
    assert "/api/ai/ask" not in paths
    assert "/api/ai/insights" not in paths
    # nor with the analytics forecast routes
    assert "/api/analytics/forecast/revenue" not in paths
