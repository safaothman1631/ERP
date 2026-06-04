"""Tests for the demand & inventory prediction AI (Pool 4.6+).

We never touch real BigQuery: ``app.analytics.ai.inventory._bigquery`` is
patched to hand back a fake ``bigquery`` module whose ``Client()`` is a
``MagicMock`` we drive. That lets us:
  * capture the SQL handed to ``client.query(...)`` and assert each of the
    demand-forecast / reorder / stockout / ABC / dead-stock queries is
    well-formed (ARIMA_PLUS + ``time_series_id_col``, reorder JOIN, stockout
    date math, ABC cumulative %),
  * prove ``org_id`` is bound as a ``ScalarQueryParameter`` and never
    string-interpolated into the SQL text (no injection),
  * prove the BQML demand model name carries only a sanitised slug,
  * check the endpoint response shape (``{rows, status}``), and
  * verify graceful HTTP-200 empty results when the env is unset or BQ raises.

Mirrors the mocking style of ``tests/test_forecast_api.py`` +
``tests/test_ai_customer.py``.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.analytics.ai import inventory as inv
from app.api.ai_inventory import router as ai_router
from app.services.auth import get_current_user

DATASET = "test-proj.test_ds"

# Endpoint path -> logic fn name on the inventory module (snapshot endpoints).
SNAPSHOT_ENDPOINTS = {
    "/api/ai/inventory/reorder": "reorder_suggestions",
    "/api/ai/inventory/stockout": "stockout_prediction",
    "/api/ai/inventory/abc": "abc_analysis",
    "/api/ai/inventory/dead-stock": "dead_stock",
}
# All endpoints (incl. the BQML demand forecast).
ALL_PATHS = list(SNAPSHOT_ENDPOINTS) + ["/api/ai/inventory/demand-forecast"]


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
            "item_id": "item-1",
            "description": "Widget",
            "name": "Widget",
            "forecast_qty": 42.4,
            "period": "2026-07-01",
            "stock_on_hand": 5.0,
            "reorder_point": 10.0,
            "monthly_demand": 30.0,
            "suggested_qty": 65.0,
            "urgency": "high",
            "daily_rate": 1.25,
            "days_until_stockout": 4,
            "predicted_stockout_date": "2026-06-08",
            "revenue": 9000.0,
            "cumulative_pct": 70.0,
            "abc_class": "A",
            "value": 4000.0,
            "last_sold": "2026-01-10",
        },
        {
            "item_id": "item-2",
            "description": "Gadget",
            "name": "Gadget",
            "forecast_qty": 3.0,
            "period": "2026-08-01",
            "stock_on_hand": 0.0,
            "reorder_point": 4.0,
            "monthly_demand": 2.0,
            "suggested_qty": 8.0,
            "urgency": "medium",
            "daily_rate": 0.1,
            "days_until_stockout": 0,
            "predicted_stockout_date": "2026-06-04",
            "revenue": 50.0,
            "cumulative_pct": 99.0,
            "abc_class": "C",
            "value": 0.0,
            "last_sold": None,
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


def test_demand_train_sql_is_well_formed():
    sql = inv._demand_train_sql("org-1")
    assert "CREATE OR REPLACE MODEL" in sql
    assert "ARIMA_PLUS" in sql
    # ONE model forecasts ALL items at once via the id column.
    assert "time_series_id_col='item_id'" in sql
    assert "time_series_timestamp_col='month'" in sql
    assert "time_series_data_col='demand'" in sql
    assert "data_frequency='MONTHLY'" in sql
    assert "fact_invoice_lines" in sql
    assert "SUM(quantity) AS demand" in sql
    assert "DATE_TRUNC(date, MONTH)" in sql
    assert "GROUP BY item_id, month" in sql
    # draft/void excluded; org bound, never interpolated
    assert "status NOT IN ('draft', 'void')" in sql
    assert "@org_id" in sql
    assert "org-1" not in sql
    # model name carries the sanitised slug
    assert "demand_arima_org_1" in sql


def test_demand_forecast_sql_is_well_formed():
    sql = inv._demand_forecast_sql("org-1", 3)
    assert "ML.FORECAST" in sql
    assert "demand_arima_org_1" in sql
    # ML.FORECAST settings must be literal constants (no @params) — horizon is
    # the validated int inlined directly.
    assert "3 AS horizon" in sql
    assert "@periods" not in sql
    assert "0.8 AS confidence_level" in sql
    # joins back to the item master for a readable description
    assert "fact_items" in sql
    assert "forecast_qty" in sql
    assert "@org_id" in sql


def test_reorder_sql_is_well_formed():
    sql = inv._reorder_sql()
    assert "fact_items" in sql
    assert "fact_invoice_lines" in sql
    # join of live stock to recent demand rate
    assert "LEFT JOIN" in sql
    assert "monthly_demand" in sql
    assert "suggested_qty" in sql
    assert "reorder_point" in sql
    # recent (~3 month) window + cover-2-months sizing
    assert "INTERVAL 3 MONTH" in sql
    assert "* 2" in sql
    # urgency buckets
    assert "'high'" in sql and "'medium'" in sql and "'low'" in sql
    # only inventory-tracked items
    assert "track_inventory = TRUE" in sql
    assert "@org_id" in sql
    assert "org-1" not in sql


def test_stockout_sql_is_well_formed():
    sql = inv._stockout_sql()
    assert "fact_items" in sql
    assert "fact_invoice_lines" in sql
    # daily rate = total qty / active days
    assert "COUNT(DISTINCT date)" in sql
    assert "daily_rate" in sql
    assert "days_until_stockout" in sql
    # stockout date math: CURRENT_DATE + days_until_stockout
    assert "DATE_ADD" in sql
    assert "CURRENT_DATE()" in sql
    assert "predicted_stockout_date" in sql
    # only tracked items that actually sell
    assert "track_inventory = TRUE" in sql
    assert "daily_rate > 0" in sql
    assert "@org_id" in sql
    assert "org-1" not in sql


def test_abc_sql_is_well_formed():
    sql = inv._abc_sql()
    assert "fact_invoice_lines" in sql
    assert "SUM(line_total) AS revenue" in sql
    # cumulative % via a descending running window total
    assert "cumulative_pct" in sql
    assert "ORDER BY revenue DESC" in sql
    assert "UNBOUNDED PRECEDING AND CURRENT ROW" in sql
    # A (top 80) / B (next 15 -> <=95) / C (rest)
    assert "<= 80" in sql
    assert "<= 95" in sql
    assert "'A'" in sql and "'B'" in sql and "'C'" in sql
    assert "@org_id" in sql
    assert "org-1" not in sql


def test_dead_stock_sql_is_well_formed():
    sql = inv._dead_stock_sql(90)
    assert "fact_items" in sql
    assert "fact_invoice_lines" in sql
    # LEFT JOIN so never-sold (NULL last_sold) items are included
    assert "LEFT JOIN" in sql
    assert "last_sold" in sql
    assert "IS NULL" in sql
    # still holding stock
    assert "stock_on_hand > 0" in sql
    # cutoff window (days inlined into INTERVAL — validated int)
    assert "INTERVAL 90 DAY" in sql
    assert "value" in sql
    assert "@org_id" in sql
    assert "org-1" not in sql


def test_dead_stock_sql_inlines_days_safely():
    # days is int()-coerced upstream; a non-int string never reaches the SQL.
    sql = inv._dead_stock_sql(30)
    assert "INTERVAL 30 DAY" in sql
    # dead_stock() coerces via max(1, int(days)) before building SQL.
    with pytest.raises((ValueError, TypeError)):
        inv._dead_stock_sql("30; DROP TABLE fact_items")


# ── BQML model name (SQL-injection boundary) ──────────────────────


def test_demand_model_name_uses_sanitized_slug_only():
    ref = inv._demand_model_ref("Org/1; DROP")
    assert "demand_arima_org_1_drop" in ref
    # raw org id never appears verbatim in the identifier
    assert "Org/1" not in ref and ";" not in ref and " " not in ref


# ── parameter binding (SQL-injection boundary) ────────────────────


@pytest.mark.parametrize("fn_name", list(SNAPSHOT_ENDPOINTS.values()))
def test_logic_binds_org_param(fn_name):
    fake_bq, client, captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        rows = getattr(inv, fn_name)("org-1")
    # exactly one query, org bound as a STRING parameter (never interpolated)
    assert len(captured["sql"]) == 1
    fake_bq.ScalarQueryParameter.assert_any_call("org_id", "STRING", "org-1")
    assert "org-1" not in captured["sql"][0]
    assert len(rows) == 2


def test_demand_forecast_binds_org_param():
    fake_bq, client, captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        rows = inv.demand_forecast("org-1", periods=3)
    # one ML.FORECAST query, org bound as a parameter
    assert len(captured["sql"]) == 1
    assert "ML.FORECAST" in captured["sql"][0]
    fake_bq.ScalarQueryParameter.assert_any_call("org_id", "STRING", "org-1")
    assert "org-1" not in captured["sql"][0]
    assert len(rows) == 2


def test_logic_never_interpolates_malicious_org_id():
    """An org_id full of SQL metacharacters must never reach the SQL text."""
    evil = "'; DROP TABLE fact_invoice_lines; --"
    fake_bq, client, captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        for fn_name in SNAPSHOT_ENDPOINTS.values():
            getattr(inv, fn_name)(evil)
        inv.demand_forecast(evil, periods=2)
    assert captured["sql"], "expected queries"
    for sql in captured["sql"]:
        assert "DROP TABLE" not in sql
        assert "'; " not in sql
    # the raw value is carried only as a bound parameter
    fake_bq.ScalarQueryParameter.assert_any_call("org_id", "STRING", evil)
    # the BQML model identifier carries only the sanitised slug
    assert any("demand_arima_drop_table_fact_invoice_lines" in s for s in captured["sql"])


def test_logic_uses_project_pinned_client():
    """Client is constructed with an explicit project (not ambient ADC)."""
    fake_bq, client, captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        inv.reorder_suggestions("org-1")
    # project= kwarg present and non-empty (parsed from the dataset ref)
    _, kwargs = fake_bq.Client.call_args
    assert kwargs.get("project")


# ── train-on-demand / retry (demand forecast) ─────────────────────


def test_demand_forecast_trains_on_model_miss_then_retries():
    """First ML.FORECAST raises (model absent) -> train -> retry succeeds."""
    state = {"forecast_calls": 0}
    job = MagicMock()
    job.result.return_value = _fake_rows()

    def _side_effect(sql, job_config):
        if "ML.FORECAST" in sql:
            state["forecast_calls"] += 1
            if state["forecast_calls"] == 1:
                raise RuntimeError("Not found: Model demand_arima_org_1")
            return job
        # the CREATE MODEL training call
        return job

    fake_bq, client, captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        rows = inv.demand_forecast("org-1", periods=3)

    assert state["forecast_calls"] == 2  # retried after training
    assert any("CREATE OR REPLACE MODEL" in s for s in captured["sql"])
    assert len(rows) == 2


def test_demand_forecast_propagates_insufficient_data():
    """If training also raises (e.g. too little history), it propagates."""

    def _side_effect(sql, job_config):
        raise RuntimeError("Not enough data points to train ARIMA model")

    fake_bq, client, captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        with pytest.raises(RuntimeError):
            inv.demand_forecast("org-1", periods=3)


# ── row mapping ───────────────────────────────────────────────────


def test_demand_forecast_maps_rows():
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        rows = inv.demand_forecast("org-1", periods=2)
    assert rows[0] == {
        "item_id": "item-1",
        "description": "Widget",
        "forecast_qty": 42.4,
        "period": "2026-07-01",
    }


def test_reorder_maps_rows():
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        rows = inv.reorder_suggestions("org-1")
    assert rows[0] == {
        "item_id": "item-1",
        "name": "Widget",
        "stock_on_hand": 5.0,
        "reorder_point": 10.0,
        "monthly_demand": 30.0,
        "suggested_qty": 65.0,
        "urgency": "high",
    }


def test_stockout_maps_rows():
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        rows = inv.stockout_prediction("org-1")
    assert rows[0] == {
        "item_id": "item-1",
        "name": "Widget",
        "stock_on_hand": 5.0,
        "daily_rate": 1.25,
        "days_until_stockout": 4,
        "predicted_stockout_date": "2026-06-08",
    }


def test_abc_maps_rows():
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        rows = inv.abc_analysis("org-1")
    assert rows[0] == {
        "item_id": "item-1",
        "name": "Widget",
        "revenue": 9000.0,
        "cumulative_pct": 70.0,
        "abc_class": "A",
    }


def test_dead_stock_maps_rows():
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        rows = inv.dead_stock("org-1", days=90)
    assert rows[0] == {
        "item_id": "item-1",
        "name": "Widget",
        "stock_on_hand": 5.0,
        "value": 4000.0,
        "last_sold": "2026-01-10",
    }
    # never-sold item: last_sold stays None
    assert rows[1]["last_sold"] is None


def test_dead_stock_passes_days_into_sql():
    fake_bq, _client, captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        inv.dead_stock("org-1", days=30)
    assert "INTERVAL 30 DAY" in captured["sql"][0]


# ── endpoints: happy path ─────────────────────────────────────────


@pytest.mark.parametrize("path", ALL_PATHS)
def test_endpoint_shape_ok(client, path):
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        resp = client.get(path)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert isinstance(body["rows"], list)
    assert len(body["rows"]) == 2
    assert set(body) == {"rows", "status"}


def test_demand_forecast_endpoint_returns_forecast_rows(client):
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/ai/inventory/demand-forecast?periods=3")
    rows = resp.json()["rows"]
    assert set(rows[0]) == {"item_id", "description", "forecast_qty", "period"}
    assert rows[0]["forecast_qty"] == 42.4


def test_reorder_endpoint_returns_reorder_rows(client):
    fake_bq, _client, _captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/ai/inventory/reorder")
    rows = resp.json()["rows"]
    assert rows[0]["urgency"] == "high"
    assert set(rows[0]) == {
        "item_id", "name", "stock_on_hand", "reorder_point",
        "monthly_demand", "suggested_qty", "urgency",
    }


def test_demand_forecast_endpoint_periods_bounds(client):
    # ge=1, le=24 enforced by FastAPI Query validation -> 422.
    assert client.get("/api/ai/inventory/demand-forecast?periods=0").status_code == 422
    assert client.get("/api/ai/inventory/demand-forecast?periods=25").status_code == 422


def test_dead_stock_endpoint_passes_days(client):
    fake_bq, _client, captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/ai/inventory/dead-stock?days=45")
    assert resp.status_code == 200
    assert "INTERVAL 45 DAY" in captured["sql"][0]


def test_dead_stock_endpoint_days_bounds(client):
    assert client.get("/api/ai/inventory/dead-stock?days=0").status_code == 422
    assert client.get("/api/ai/inventory/dead-stock?days=4000").status_code == 422


# ── endpoints: graceful degradation (never 500) ───────────────────


@pytest.mark.parametrize("path", ALL_PATHS)
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


@pytest.mark.parametrize("path", list(SNAPSHOT_ENDPOINTS))
def test_snapshot_endpoint_graceful_when_bq_raises(client, path):
    def _side_effect(sql, job_config):
        raise RuntimeError("BigQuery exploded")

    fake_bq, _client, _captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        resp = client.get(path)
    # graceful: HTTP 200, empty rows, status explains why — never 500
    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    assert body["status"] == "warehouse_not_configured"


def test_demand_forecast_endpoint_insufficient_data_when_bq_raises(client):
    def _side_effect(sql, job_config):
        raise RuntimeError("Not enough data points to train ARIMA model")

    fake_bq, _client, _captured = _make_fake_bq(query_side_effect=_side_effect)
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        resp = client.get("/api/ai/inventory/demand-forecast?periods=3")
    # the BQML endpoint reports insufficient_data (not not-configured) on a
    # model/training failure — still HTTP 200, never 500.
    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    assert body["status"] == "insufficient_data"


@pytest.mark.parametrize("path", ALL_PATHS)
def test_endpoint_graceful_when_bq_lib_missing(client, path):
    with patch.object(inv, "_bigquery", return_value=None):
        resp = client.get(path)
    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    # demand-forecast -> insufficient_data; snapshot -> warehouse_not_configured
    assert body["status"] in ("warehouse_not_configured", "insufficient_data")


def test_endpoint_no_injection_via_user_org_id(monkeypatch):
    """An authenticated org_id with metacharacters must not reach the SQL text."""
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", DATASET)
    app = FastAPI()
    app.include_router(ai_router)
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "u", "org_id": "'; DROP TABLE fact_items; --",
        "email": "x", "name": "x", "role": "owner",
    }
    c = TestClient(app, raise_server_exceptions=False)
    fake_bq, _client, captured = _make_fake_bq()
    with patch.object(inv, "_bigquery", return_value=fake_bq):
        resp = c.get("/api/ai/inventory/reorder")
    assert resp.status_code == 200
    assert captured["sql"], "expected at least one query"
    for sql in captured["sql"]:
        assert "DROP TABLE" not in sql
        assert "'; " not in sql


# ── auth gate ─────────────────────────────────────────────────────


@pytest.mark.parametrize("path", ALL_PATHS)
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
        "/api/ai/inventory/demand-forecast",
        "/api/ai/inventory/reorder",
        "/api/ai/inventory/stockout",
        "/api/ai/inventory/abc",
        "/api/ai/inventory/dead-stock",
    }
    # must NOT collide with the sibling /api/ai/* routers' paths
    assert "/api/ai/ask" not in paths
    assert "/api/ai/insights" not in paths
    assert "/api/ai/anomalies/transactions" not in paths
    assert "/api/ai/customers/segments" not in paths
