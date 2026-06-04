"""Tests for the BI analytics layer (Pool 4.6, app/api/analytics.py).

Focus areas:
  - SQL builder is injection-safe: unknown fact/measure/dimension/filter/order_by
    -> 400; user filter *values* are bound as query parameters, never placed in
    the SQL string.
  - ``_run_warehouse`` returns None when ANALYTICS_BQ_DATASET is unset (so the
    endpoint degrades to the OLTP fallback, source="oltp").
  - When the env is set, the warehouse path runs against a mocked bigquery and
    binds parameters (source="warehouse").
  - Saved-analysis CRUD wires the repository and enforces ownership/visibility.

No live Firestore or BigQuery is hit: the repo class is patched and a fake
``google.cloud.bigquery`` module is injected for the warehouse-path tests.
"""
from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.analytics import warehouse_schema
from app.api import analytics
from app.api.analytics import AnalysisDef, _build_sql, _run_warehouse, _validate, router
from app.services.auth import get_current_user


def _user():
    # role=owner -> permissions == {"*"} -> satisfies require_perm(reports.*)
    return {
        "id": "user-1",
        "org_id": "org-1",
        "email": "user@example.com",
        "name": "Test User",
        "role": "owner",
    }


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = _user
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def _no_warehouse(monkeypatch):
    """Default to warehouse-unconfigured so most tests exercise OLTP fallback."""
    monkeypatch.delenv("ANALYTICS_BQ_DATASET", raising=False)
    yield


# ── Whitelist / fact-schema consistency ──────────────────────────────────────

def test_facts_reference_only_real_warehouse_columns():
    """Every dimension/measure/date_col must map to a column that actually
    exists in warehouse_schema.FACTS[<fact>]["schema"]."""
    import re

    ident = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
    quoted = re.compile(r"'[^']*'")  # strip 'literals' like the %Y-%m format str
    sql_funcs = {"SUM", "COUNT", "AVG", "MIN", "MAX", "FORMAT_DATE", "DATE"}

    # Cover every warehouse table (generic header facts, line-level, AND the
    # derived/enriched tables: GL, expenses, payments, orders, quotes).
    all_schemas = warehouse_schema.all_table_schemas()
    for fact, cfg in analytics._FACTS.items():
        schema_cols = set(all_schemas[fact].keys())  # KeyError if fact has no table
        # Master-data facts (items/contacts/accounts) have no time axis -> None.
        if cfg["date_col"] is not None:
            assert cfg["date_col"] in schema_cols, f"{fact}.date_col not in schema"
        for expr in list(cfg["measures"].values()) + list(cfg["dimensions"].values()):
            bare = quoted.sub("", expr)  # remove string literals before tokenizing
            for tok in ident.findall(bare):
                if tok in sql_funcs or tok.isupper():
                    continue  # SQL function name
                assert tok in schema_cols, (
                    f"{fact}: expr {expr!r} references unknown column {tok!r}"
                )


def test_list_facts_endpoint_returns_whitelist(client):
    resp = client.get("/api/analytics/facts")
    assert resp.status_code == 200
    facts = resp.json()["facts"]
    # The whitelist now spans the full business model: the original three plus
    # the General Ledger, master data, line-level sales, and order/payment facts.
    expected = {
        "fact_invoices", "fact_bills", "fact_pos_orders", "fact_je_lines",
        "fact_expenses", "fact_payments", "fact_sales_orders",
        "fact_purchase_orders", "fact_quotes", "fact_invoice_lines",
        "fact_items", "fact_contacts", "fact_accounts",
    }
    assert set(facts) == expected
    assert "total" in facts["fact_invoices"]["measures"]
    assert "month" in facts["fact_invoices"]["dimensions"]
    # fact_bills has no tax_amount column -> no tax measure exposed
    assert "tax" not in facts["fact_bills"]["measures"]
    # The General Ledger exposes the account_type dimension + debit/credit/net.
    assert "account_type" in facts["fact_je_lines"]["dimensions"]
    assert {"debit", "credit", "net"} <= set(facts["fact_je_lines"]["measures"])


# ── _validate: reject anything off the whitelist (400) ───────────────────────

def test_validate_rejects_unknown_fact():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as ei:
        _validate(AnalysisDef(fact="fact_evil", measures=["total"]))
    assert ei.value.status_code == 400


def test_validate_rejects_unknown_measure():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as ei:
        _validate(AnalysisDef(fact="fact_invoices", measures=["DROP TABLE"]))
    assert ei.value.status_code == 400


def test_validate_rejects_unknown_dimension():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as ei:
        _validate(AnalysisDef(fact="fact_invoices", measures=["total"], dimensions=["evil"]))
    assert ei.value.status_code == 400


def test_validate_rejects_unknown_filter_dimension():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as ei:
        _validate(
            AnalysisDef(fact="fact_invoices", measures=["total"], filters={"evil": "x"})
        )
    assert ei.value.status_code == 400


def test_validate_rejects_unknown_order_by():
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as ei:
        _validate(
            AnalysisDef(fact="fact_invoices", measures=["total"], order_by="1; DROP TABLE")
        )
    assert ei.value.status_code == 400


def test_query_endpoint_unknown_fact_returns_400(client):
    resp = client.post("/api/analytics/query", json={"fact": "fact_evil", "measures": ["total"]})
    assert resp.status_code == 400


def test_query_endpoint_unknown_measure_returns_400(client):
    resp = client.post(
        "/api/analytics/query",
        json={"fact": "fact_invoices", "measures": ["1=1) UNION SELECT"]},
    )
    assert resp.status_code == 400


# ── _build_sql: injection safety ─────────────────────────────────────────────

def test_build_sql_filter_value_goes_to_params_not_sql():
    """A malicious filter *value* must never appear in the SQL string — it is
    bound as a parameter (@f0)."""
    fact = _validate(
        AnalysisDef(
            fact="fact_invoices",
            measures=["total"],
            dimensions=["month"],
            filters={"status": "paid'; DROP TABLE fact_invoices;--"},
        )
    )
    sql, params = _build_sql(
        AnalysisDef(
            fact="fact_invoices",
            measures=["total"],
            dimensions=["month"],
            filters={"status": "paid'; DROP TABLE fact_invoices;--"},
        ),
        fact,
        "org-1",
    )
    assert "DROP TABLE" not in sql
    assert "@f0" in sql
    assert params["f0"] == "paid'; DROP TABLE fact_invoices;--"


def test_build_sql_org_id_is_parameterized():
    fact = _FACTS_invoices()
    sql, params = _build_sql(
        AnalysisDef(fact="fact_invoices", measures=["total"]), fact, "org-secret"
    )
    assert "org-secret" not in sql
    assert "org_id = @org_id" in sql
    assert params["org_id"] == "org-secret"


def test_build_sql_dates_are_parameterized():
    fact = _FACTS_invoices()
    sql, params = _build_sql(
        AnalysisDef(
            fact="fact_invoices",
            measures=["total"],
            date_from="2026-01-01",
            date_to="2026-12-31",
        ),
        fact,
        "org-1",
    )
    assert "2026-01-01" not in sql and "2026-12-31" not in sql
    assert "@date_from" in sql and "@date_to" in sql
    assert params["date_from"] == "2026-01-01"
    assert params["date_to"] == "2026-12-31"
    # date range filters the real partition/date column
    assert "date >= @date_from" in sql and "date <= @date_to" in sql


def test_build_sql_only_whitelisted_identifiers_reach_sql():
    fact = _FACTS_invoices()
    sql, _ = _build_sql(
        AnalysisDef(
            fact="fact_invoices",
            measures=["total", "count"],
            dimensions=["month", "status"],
            order_by="total",
            order_dir="DESC",
            limit=10,
        ),
        fact,
        "org-1",
    )
    assert "`" in sql  # backtick-quoted table ref
    assert "SUM(total) AS total" in sql
    assert "COUNT(1) AS count" in sql
    assert "FORMAT_DATE('%Y-%m', date) AS month" in sql
    assert "GROUP BY 1, 2" in sql
    assert "ORDER BY total DESC" in sql
    assert sql.rstrip().endswith("LIMIT 10")


def test_build_sql_uses_warehouse_table_ref(monkeypatch):
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", "myproj.zoho_wh")
    fact = _FACTS_invoices()
    sql, _ = _build_sql(
        AnalysisDef(fact="fact_invoices", measures=["total"]), fact, "org-1"
    )
    assert "`myproj.zoho_wh.fact_invoices`" in sql


def _FACTS_invoices():
    return _validate(AnalysisDef(fact="fact_invoices", measures=["total"]))


# ── _run_warehouse: graceful degradation ─────────────────────────────────────

def test_run_warehouse_returns_none_when_env_unset():
    """No ANALYTICS_BQ_DATASET -> signal OLTP fallback (None), never raise."""
    fact = _FACTS_invoices()
    assert _run_warehouse(AnalysisDef(fact="fact_invoices", measures=["total"]), fact, "org-1") is None


def test_query_endpoint_falls_back_to_oltp_when_warehouse_off(client):
    resp = client.post(
        "/api/analytics/query",
        json={"fact": "fact_invoices", "measures": ["total"], "dimensions": ["month"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "oltp"
    assert body["rows"] == []
    assert body["row_count"] == 0


# ── Warehouse path with a mocked bigquery module ─────────────────────────────

class _FakeRow(dict):
    """BigQuery Row is dict-able; our code does dict(r)."""


def _install_fake_bigquery(monkeypatch, captured: dict, rows=None):
    """Inject a fake ``google.cloud.bigquery`` so the lazy import in
    ``_run_warehouse`` resolves to a controllable double."""
    bq = types.ModuleType("google.cloud.bigquery")

    class ScalarQueryParameter:
        def __init__(self, name, type_, value):
            self.name, self.type_, self.value = name, type_, value

    class QueryJobConfig:
        def __init__(self, query_parameters=None):
            self.query_parameters = query_parameters or []
            captured["params"] = self.query_parameters

    class _Job:
        def result(self):
            return rows if rows is not None else []

    class Client:
        def __init__(self, *a, **k):
            pass

        def query(self, sql, job_config=None):
            captured["sql"] = sql
            captured["job_config"] = job_config
            return _Job()

    bq.ScalarQueryParameter = ScalarQueryParameter
    bq.QueryJobConfig = QueryJobConfig
    bq.Client = Client

    # Ensure ``from google.cloud import bigquery`` finds our module.
    google_mod = sys.modules.get("google") or types.ModuleType("google")
    cloud_mod = sys.modules.get("google.cloud") or types.ModuleType("google.cloud")
    monkeypatch.setitem(sys.modules, "google", google_mod)
    monkeypatch.setitem(sys.modules, "google.cloud", cloud_mod)
    monkeypatch.setitem(sys.modules, "google.cloud.bigquery", bq)
    monkeypatch.setattr(cloud_mod, "bigquery", bq, raising=False)


def test_run_warehouse_binds_params_not_string(monkeypatch):
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", "myproj.zoho_wh")
    captured: dict = {}
    _install_fake_bigquery(
        monkeypatch, captured, rows=[_FakeRow(month="2026-01", total=99.0)]
    )

    fact = _FACTS_invoices()
    defn = AnalysisDef(
        fact="fact_invoices",
        measures=["total"],
        dimensions=["month"],
        filters={"status": "paid'; DROP TABLE x;--"},
        date_from="2026-01-01",
    )
    out = _run_warehouse(defn, fact, "org-1")

    assert out == [{"month": "2026-01", "total": 99.0}]
    # the dangerous value is bound, not interpolated
    assert "DROP TABLE" not in captured["sql"]
    bound = {p.name: p.value for p in captured["params"]}
    assert bound["org_id"] == "org-1"
    assert bound["date_from"] == "2026-01-01"
    assert bound["f0"] == "paid'; DROP TABLE x;--"
    # org_id/date_from/status filter all typed as STRING scalar params
    types_by_name = {p.name: p.type_ for p in captured["params"]}
    assert types_by_name["org_id"] == "STRING"


def test_query_endpoint_warehouse_source(client, monkeypatch):
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", "myproj.zoho_wh")
    captured: dict = {}
    _install_fake_bigquery(
        monkeypatch, captured, rows=[_FakeRow(month="2026-01", total=5.0)]
    )
    resp = client.post(
        "/api/analytics/query",
        json={"fact": "fact_invoices", "measures": ["total"], "dimensions": ["month"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "warehouse"
    assert body["rows"] == [{"month": "2026-01", "total": 5.0}]
    assert body["row_count"] == 1


# ── Saved analyses CRUD ──────────────────────────────────────────────────────

@patch("app.api.analytics._AnalysisRepo")
def test_create_saved_wires_repo(mock_repo_cls, client):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.create.return_value = {
        "id": "a1", "name": "Monthly revenue", "org_id": "org-1",
    }
    resp = client.post(
        "/api/analytics/saved",
        json={
            "name": "Monthly revenue",
            "definition": {
                "fact": "fact_invoices",
                "measures": ["total"],
                "dimensions": ["month"],
            },
            "is_shared": True,
        },
    )
    assert resp.status_code == 201
    assert resp.json()["data"]["name"] == "Monthly revenue"
    mock_repo_cls.assert_called_once_with("org-1")
    payload = mock_repo.create.call_args.args[0]
    assert payload["owner_user_id"] == "user-1"
    assert payload["is_shared"] is True
    assert payload["definition"]["fact"] == "fact_invoices"


@patch("app.api.analytics._AnalysisRepo")
def test_create_saved_rejects_invalid_definition(mock_repo_cls, client):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    resp = client.post(
        "/api/analytics/saved",
        json={
            "name": "bad",
            "definition": {"fact": "fact_evil", "measures": ["total"]},
        },
    )
    assert resp.status_code == 400
    mock_repo.create.assert_not_called()


@patch("app.api.analytics._AnalysisRepo")
def test_list_saved_filters_by_owner_and_shared(mock_repo_cls, client):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.list.return_value = (
        [
            {"id": "a1", "owner_user_id": "user-1", "is_shared": False},
            {"id": "a2", "owner_user_id": "someone-else", "is_shared": True},
            {"id": "a3", "owner_user_id": "someone-else", "is_shared": False},
        ],
        3,
    )
    resp = client.get("/api/analytics/saved")
    assert resp.status_code == 200
    ids = [a["id"] for a in resp.json()["data"]]
    assert ids == ["a1", "a2"]  # a3 (other owner, not shared) hidden


@patch("app.api.analytics._AnalysisRepo")
def test_delete_saved_owner_ok(mock_repo_cls, client):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.get.return_value = {"id": "a1", "owner_user_id": "user-1"}
    resp = client.delete("/api/analytics/saved/a1")
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    mock_repo.delete.assert_called_once_with("a1")


@patch("app.api.analytics._AnalysisRepo")
def test_delete_saved_404(mock_repo_cls, client):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.get.return_value = None
    resp = client.delete("/api/analytics/saved/nope")
    assert resp.status_code == 404


@patch("app.api.analytics._AnalysisRepo")
def test_delete_saved_non_owner_forbidden(mock_repo_cls, client):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.get.return_value = {"id": "a1", "owner_user_id": "someone-else"}
    resp = client.delete("/api/analytics/saved/a1")
    assert resp.status_code == 403
    mock_repo.delete.assert_not_called()
