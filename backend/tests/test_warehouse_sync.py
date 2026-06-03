"""Pool 4.6: Firestore -> BigQuery warehouse sync.

Pure unit tests — BigQuery and Firestore are fully mocked (no real BQ/Firestore
access). Verifies: (1) graceful no-op when BQ isn't configured / the lib is
missing; (2) docs are mapped via ``warehouse_schema`` and handed to the BQ
client; (3) delete-then-insert ordering of the idempotent upsert.
"""

from unittest.mock import MagicMock, call, patch

from app.analytics import warehouse_schema
from app.services import warehouse_sync as WS


# ── fixtures / helpers ──────────────────────────────────────────────────────

def _fake_repo(docs):
    """A stand-in BaseRepository whose stream_org_docs yields ``docs``."""
    repo = MagicMock()
    repo.stream_org_docs.return_value = iter(list(docs))
    return repo


def _bq_with_recorder():
    """A mock BQ client plus a shared call-order log.

    ``client.query(...).result()`` (the DELETE) and ``client.insert_rows_json``
    both append to ``order`` so tests can assert delete-before-insert. The
    delete query string is captured so we can assert it targets the right table.
    """
    order: list[str] = []
    client = MagicMock()

    def _query(sql, *a, **k):
        order.append(f"delete:{sql}")
        job = MagicMock()
        job.result.return_value = None
        return job

    def _insert(table, rows, *a, **k):
        order.append(f"insert:{table}:{len(rows)}")
        return []  # no row errors

    client.query.side_effect = _query
    client.insert_rows_json.side_effect = _insert
    return client, order


# ── (1) graceful no-op ──────────────────────────────────────────────────────

def test_sync_org_noop_when_bq_client_unavailable():
    """bigquery lib/credentials missing -> _bq_client() returns None -> skip."""
    with patch.object(WS, "_bq_client", return_value=None):
        out = WS.sync_org("org-1")
    assert out == {"skipped": "warehouse_not_configured"}


def test_sync_org_noop_when_dataset_unreachable_and_env_unset(monkeypatch):
    """Lib present but default dataset unreachable + env unset -> skip, no raise."""
    monkeypatch.delenv("ANALYTICS_BQ_DATASET", raising=False)
    client = MagicMock()
    client.get_dataset.side_effect = RuntimeError("404 dataset not found")
    with patch.object(WS, "_bq_client", return_value=client):
        out = WS.sync_org("org-1")
    assert out == {"skipped": "warehouse_not_configured"}


def test_bq_client_returns_none_when_bigquery_import_fails():
    """The lazy ``from google.cloud import bigquery`` failing is a no-op (None)."""
    import builtins

    real_import = builtins.__import__

    def _boom(name, *a, **k):
        if name == "google.cloud" or name.startswith("google.cloud"):
            raise ImportError("no bigquery")
        return real_import(name, *a, **k)

    with patch("builtins.__import__", side_effect=_boom):
        assert WS._bq_client() is None


def test_run_warehouse_sync_noop_does_not_enumerate_orgs():
    """When BQ is unavailable, run_warehouse_sync skips WITHOUT touching Firestore."""
    with patch.object(WS, "_bq_client", return_value=None), \
         patch.object(WS, "_iter_org_ids") as iter_orgs:
        out = WS.run_warehouse_sync()
    assert out == {"skipped": "warehouse_not_configured"}
    iter_orgs.assert_not_called()


# ── (2) docs are mapped via warehouse_schema + passed to the BQ client ──────

def test_docs_mapped_via_schema_and_inserted(monkeypatch):
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", "proj.ds")  # env set -> reachable
    client, _order = _bq_with_recorder()

    inv_docs = [
        {"id": "INV-1", "total": 100, "balance_due": 25, "status": "sent",
         "date": "2026-01-05", "contact_name": "Acme"},
    ]
    repo = _fake_repo(inv_docs)

    with patch.object(WS, "_bq_client", return_value=client), \
         patch.object(WS, "_repo_for", return_value=repo):
        out = WS.sync_org("org-9", tables=["fact_invoices"])

    assert out == {"fact_invoices": 1}
    # The exact row the schema produces must be what got inserted.
    expected_row = warehouse_schema.map_row("fact_invoices", "INV-1", inv_docs[0], "org-9")
    target = warehouse_schema.table_ref("fact_invoices")
    client.insert_rows_json.assert_called_once_with(target, [expected_row])
    # Sanity: the mapped row carries tenant + doc id (idempotency key columns).
    assert expected_row["org_id"] == "org-9" and expected_row["id"] == "INV-1"
    # Repo was streamed org-scoped.
    repo.stream_org_docs.assert_called_once()


def test_all_facts_synced_when_tables_omitted(monkeypatch):
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", "proj.ds")
    client, _order = _bq_with_recorder()
    repo = _fake_repo([])  # zero docs per collection

    with patch.object(WS, "_bq_client", return_value=client), \
         patch.object(WS, "_repo_for", return_value=repo):
        out = WS.sync_org("org-1")

    # Every fact table in the shared contract is covered, each with 0 rows.
    assert set(out.keys()) == set(warehouse_schema.FACTS.keys())
    assert all(v == 0 for v in out.values())


def test_unknown_table_raises_keyerror():
    with patch.object(WS, "_bq_client", return_value=MagicMock()):
        try:
            WS.sync_org("org-1", tables=["fact_bogus"])
            assert False, "expected KeyError"
        except KeyError as e:
            assert "fact_bogus" in str(e)


# ── (3) delete-then-insert ordering ─────────────────────────────────────────

def test_delete_runs_before_insert(monkeypatch):
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", "proj.ds")
    client, order = _bq_with_recorder()
    repo = _fake_repo([{"id": "INV-1", "total": 1, "date": "2026-01-01"}])

    with patch.object(WS, "_bq_client", return_value=client), \
         patch.object(WS, "_repo_for", return_value=repo):
        WS.sync_org("org-7", tables=["fact_invoices"])

    # DELETE happened, INSERT happened, and DELETE strictly precedes INSERT.
    assert any(s.startswith("delete:") for s in order)
    assert any(s.startswith("insert:") for s in order)
    delete_idx = next(i for i, s in enumerate(order) if s.startswith("delete:"))
    insert_idx = next(i for i, s in enumerate(order) if s.startswith("insert:"))
    assert delete_idx < insert_idx
    # The DELETE targets this fact table and is parameterized on org_id.
    target = warehouse_schema.table_ref("fact_invoices")
    delete_sql = order[delete_idx]
    assert target in delete_sql and "@org" in delete_sql


def test_delete_uses_org_scoped_query_param(monkeypatch):
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", "proj.ds")
    client, _order = _bq_with_recorder()
    repo = _fake_repo([])

    with patch.object(WS, "_bq_client", return_value=client), \
         patch.object(WS, "_repo_for", return_value=repo):
        WS.sync_org("org-42", tables=["fact_bills"])

    # query() called once for the single table's DELETE; param carries the org.
    assert client.query.call_count == 1
    _args, kwargs = client.query.call_args
    job_config = kwargs.get("job_config")
    assert job_config is not None
    params = list(job_config.query_parameters)
    assert params[0].value == "org-42"


# ── run_warehouse_sync: org enumeration ─────────────────────────────────────

def test_run_warehouse_sync_iterates_all_orgs(monkeypatch):
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", "proj.ds")
    client, _order = _bq_with_recorder()

    with patch.object(WS, "_bq_client", return_value=client), \
         patch.object(WS, "_iter_org_ids", return_value=["o1", "o2"]), \
         patch.object(WS, "sync_org", return_value={"fact_invoices": 0}) as sync_one:
        out = WS.run_warehouse_sync()

    assert out["orgs"] == 2
    assert set(out["results"].keys()) == {"o1", "o2"}
    sync_one.assert_has_calls([call("o1"), call("o2")], any_order=True)


def test_run_warehouse_sync_continues_past_failing_org(monkeypatch):
    monkeypatch.setenv("ANALYTICS_BQ_DATASET", "proj.ds")
    client, _order = _bq_with_recorder()

    def _sync(org_id, *a, **k):
        if org_id == "bad":
            raise RuntimeError("kaboom")
        return {"fact_invoices": 1}

    with patch.object(WS, "_bq_client", return_value=client), \
         patch.object(WS, "_iter_org_ids", return_value=["good", "bad"]), \
         patch.object(WS, "sync_org", side_effect=_sync):
        out = WS.run_warehouse_sync()

    assert out["orgs"] == 2
    assert out["results"]["good"] == {"fact_invoices": 1}
    assert "error" in out["results"]["bad"]  # failure recorded, run not aborted


def test_iter_org_ids_uses_organizations_collection():
    """Org enumeration reads doc ids from the 'organizations' collection."""
    db = MagicMock()
    d1, d2 = MagicMock(), MagicMock()
    d1.id, d2.id = "orgA", "orgB"
    db.collection.return_value.stream.return_value = iter([d1, d2])
    with patch("app.firebase_client.get_firestore_client", return_value=db):
        ids = WS._iter_org_ids()
    db.collection.assert_called_once_with("organizations")
    assert ids == ["orgA", "orgB"]
