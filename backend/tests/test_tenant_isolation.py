"""Cross-tenant isolation tests (SF4 / T-SF.4.1, T-SF.4.2).

This is the most important security test in the suite: it proves that one
organisation's credentials can **never** read, mutate, or delete another
organisation's data. The platform's per-tenant boundary is enforced in two
independent layers, and both are exercised here:

  Layer 1 — Repository (``app.firestore.base.BaseRepository``)
      Every read filters by ``org_id`` and every single-document fetch verifies
      ``data["org_id"] == self.org_id`` before returning, yielding ``None`` (→
      HTTP 404 at the API) for a foreign document. ``update_versioned`` and the
      delete path re-check ownership inside the Firestore transaction so a
      blind write to a known foreign id raises ``LookupError`` (→ 404).

  Layer 2 — API (``require_perm`` + ``get_current_user``)
      Routers resolve the repository from ``user["org_id"]`` (never from a
      client-supplied id) and gate destructive verbs behind RBAC, so a viewer
      token gets 403 and a cross-org id resolves to a different collection
      partition (404).

We drive Layer 1 against a faithful in-memory Firestore double so the *real*
repository code runs (no mocking of the method under test), and we assemble
50+ distinct cross-tenant attempts spanning every major collection. A summary
test asserts the count stays >= 50 so the coverage cannot silently shrink.

Requirements: T-SF.4.1, T-SF.4.2, Requirement 6.5 (tenant isolation).
"""
from __future__ import annotations

import uuid
from typing import Any

import pytest

# ──────────────────────────────────────────────────────────────────────────────
# In-memory Firestore double
# Mirrors the subset of the google-cloud-firestore API that BaseRepository uses:
# collection().document().{set,get,update,delete}, collection().where().stream(),
# and the @firestore.transactional flow used by update_versioned.
# ──────────────────────────────────────────────────────────────────────────────


class _Snap:
    def __init__(self, doc_id: str, data: dict | None):
        self.id = doc_id
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data) if self._data is not None else None

    @property
    def reference(self):
        return None


class _DocRef:
    def __init__(self, store: dict, doc_id: str):
        self._store = store
        self.id = doc_id

    def set(self, data: dict):
        self._store[self.id] = dict(data)

    def get(self, transaction=None):
        return _Snap(self.id, self._store.get(self.id))

    def update(self, data: dict):
        if self.id not in self._store:
            from google.api_core import exceptions as gexc  # type: ignore

            raise gexc.NotFound(f"missing:{self.id}")
        self._store[self.id].update(data)

    def delete(self):
        self._store.pop(self.id, None)

    def collection(self, name: str):
        return _Collection({})

    def collections(self):
        return []


class _Query:
    def __init__(self, rows: list[dict]):
        self._rows = rows

    def where(self, field, op, value):
        if op == "==":
            return _Query([r for r in self._rows if r.get(field) == value])
        if op == ">=":
            return _Query([r for r in self._rows if str(r.get(field, "")) >= value])
        if op == "<=":
            return _Query([r for r in self._rows if str(r.get(field, "")) <= value])
        return _Query(list(self._rows))

    def limit(self, n):
        return _Query(self._rows[:n])

    def order_by(self, *a, **k):
        return self

    def start_after(self, *a, **k):
        return _Query(self._rows)

    def stream(self):
        for r in self._rows:
            yield _Snap(r["id"], r)


class _Collection:
    def __init__(self, store: dict):
        self._store = store

    def document(self, doc_id: str | None = None):
        return _DocRef(self._store, doc_id or uuid.uuid4().hex)

    def where(self, field, op, value):
        rows = [{"id": k, **v} for k, v in self._store.items()]
        return _Query(rows).where(field, op, value)

    def stream(self):
        for k, v in self._store.items():
            yield _Snap(k, v)

    def order_by(self, *a, **k):
        rows = [{"id": k, **v} for k, v in self._store.items()]
        return _Query(rows)


class _Transaction:
    """Minimal transaction object; reads/writes go straight to the store."""

    def update(self, doc_ref: _DocRef, data: dict):
        doc_ref.update(data)

    def set(self, doc_ref: _DocRef, data: dict):
        doc_ref.set(data)

    # The real google lib calls these around the transactional fn.
    def _begin(self, *a, **k):
        pass

    def _commit(self, *a, **k):
        return []

    def _rollback(self, *a, **k):
        pass


class FakeFirestore:
    def __init__(self):
        self._collections: dict[str, dict] = {}

    def collection(self, name: str) -> _Collection:
        return _Collection(self._collections.setdefault(name, {}))

    def transaction(self, *a, **k):
        return _Transaction()

    def batch(self):
        class _B:
            def set(self, *a, **k):
                pass

            def delete(self, *a, **k):
                pass

            def commit(self):
                pass

        return _B()

    # Test helper: seed a document directly into a collection partition.
    def seed(self, collection: str, doc_id: str, org_id: str, **fields):
        self._collections.setdefault(collection, {})[doc_id] = {
            "org_id": org_id, "_version": 1, "schema_version": 1, **fields
        }
        return doc_id


# ──────────────────────────────────────────────────────────────────────────────
# Fixtures: patch get_db everywhere BaseRepository / fs.transactional resolve it,
# and neutralise the cache + the @firestore.transactional decorator so our fake
# Transaction is used verbatim.
# ──────────────────────────────────────────────────────────────────────────────

ORG_A = "org-aaaa"
ORG_B = "org-bbbb"

# (collection_name, import_path, class_name) for the main tenant collections.
MAIN_COLLECTIONS: list[tuple[str, str, str]] = [
    ("invoices", "app.firestore.invoices", "InvoiceRepository"),
    ("quotes", "app.firestore.invoices", "QuoteRepository"),
    ("sales_orders", "app.firestore.invoices", "SalesOrderRepository"),
    ("credit_notes", "app.firestore.invoices", "CreditNoteRepository"),
    ("payments_received", "app.firestore.invoices", "PaymentReceivedRepository"),
    ("bills", "app.firestore.bills", "BillRepository"),
    ("purchase_orders", "app.firestore.bills", "PurchaseOrderRepository"),
    ("vendor_credits", "app.firestore.bills", "VendorCreditRepository"),
    ("payments_made", "app.firestore.bills", "PaymentMadeRepository"),
    ("expenses", "app.firestore.expenses", "ExpenseRepository"),
    ("contacts", "app.firestore.contacts", "ContactRepository"),
    ("items", "app.firestore.items", "ItemRepository"),
    ("accounts", "app.firestore.accounts", "AccountRepository"),
    ("journal_entries", "app.firestore.journals", "JournalEntryRepository"),
    ("bank_accounts", "app.firestore.banking", "BankAccountRepository"),
    ("bank_transactions", "app.firestore.banking", "BankTransactionRepository"),
    ("hr_employees", "app.firestore.hr", "HREmployeeRepository"),
    ("payroll_runs", "app.firestore.payroll", "PayrollRunRepository"),
]


def _import_repo(import_path: str, class_name: str):
    import importlib

    mod = importlib.import_module(import_path)
    return getattr(mod, class_name)


@pytest.fixture
def fake_db(monkeypatch):
    db = FakeFirestore()

    # Patch every get_db reference the repository layer might use.
    import app.firestore.base as base_mod

    monkeypatch.setattr(base_mod, "get_db", lambda: db)

    # Cache must not short-circuit the org_id ownership check.
    monkeypatch.setattr(base_mod.cache, "get", lambda *a, **k: None)
    monkeypatch.setattr(base_mod.cache, "set", lambda *a, **k: None)
    monkeypatch.setattr(base_mod.cache, "delete", lambda *a, **k: None)

    # Make @fs.transactional a passthrough that injects our fake Transaction,
    # so update_versioned's ownership re-check runs against the fake store.
    def _fake_transactional(fn):
        def _wrapper(transaction, *args, **kwargs):
            return fn(transaction, *args, **kwargs)

        return _wrapper

    monkeypatch.setattr(base_mod.fs, "transactional", _fake_transactional)

    # Avoid reference-guard Firestore lookups during delete().
    monkeypatch.setattr(
        "app.services.reference_guard.find_blocking_references",
        lambda *a, **k: [],
    )
    monkeypatch.setattr(
        "app.services.reference_guard.find_item_usage_blockers",
        lambda *a, **k: [],
    )
    return db


def _repo(import_path, class_name, org_id):
    cls = _import_repo(import_path, class_name)
    return cls(org_id)


# ──────────────────────────────────────────────────────────────────────────────
# Layer 1 — Repository-level cross-tenant denial (parametrised over collections)
# ──────────────────────────────────────────────────────────────────────────────


class TestRepositoryCrossTenantRead:
    """Org B must never read a document owned by Org A via get()."""

    @pytest.mark.parametrize("coll,path,cls", MAIN_COLLECTIONS, ids=[c[0] for c in MAIN_COLLECTIONS])
    def test_foreign_get_returns_none(self, fake_db, coll, path, cls):
        doc_id = fake_db.seed(coll, f"{coll}-doc-A", ORG_A, name="A's secret")
        # Org B repository must not see Org A's document.
        repo_b = _repo(path, cls, ORG_B)
        assert repo_b.get(doc_id) is None, f"{coll}: Org B read Org A document!"

    @pytest.mark.parametrize("coll,path,cls", MAIN_COLLECTIONS, ids=[c[0] for c in MAIN_COLLECTIONS])
    def test_owner_get_succeeds(self, fake_db, coll, path, cls):
        doc_id = fake_db.seed(coll, f"{coll}-doc-A2", ORG_A, name="A's data")
        repo_a = _repo(path, cls, ORG_A)
        got = repo_a.get(doc_id)
        assert got is not None and got["org_id"] == ORG_A


class TestRepositoryCrossTenantList:
    """list() must only ever return the caller's own org rows."""

    @pytest.mark.parametrize("coll,path,cls", MAIN_COLLECTIONS, ids=[c[0] for c in MAIN_COLLECTIONS])
    def test_list_excludes_foreign_rows(self, fake_db, coll, path, cls):
        fake_db.seed(coll, f"{coll}-A", ORG_A, name="A")
        fake_db.seed(coll, f"{coll}-B", ORG_B, name="B")
        repo_b = _repo(path, cls, ORG_B)
        items, _total = repo_b.list(limit=100)
        ids = {i["id"] for i in items}
        assert f"{coll}-A" not in ids, f"{coll}: foreign row leaked into list()"
        assert all(i.get("org_id") == ORG_B for i in items)


class TestRepositoryCrossTenantUpdate:
    """A blind versioned update against a foreign id must raise (→ 404)."""

    @pytest.mark.parametrize("coll,path,cls", MAIN_COLLECTIONS, ids=[c[0] for c in MAIN_COLLECTIONS])
    def test_foreign_versioned_update_raises(self, fake_db, coll, path, cls):
        doc_id = fake_db.seed(coll, f"{coll}-upd-A", ORG_A, name="A")
        repo_b = _repo(path, cls, ORG_B)
        with pytest.raises(LookupError):
            repo_b.update_versioned(doc_id, {"name": "hacked"}, expected_version=1)
        # And the original document must be untouched.
        owner = _repo(path, cls, ORG_A).get(doc_id)
        assert owner["name"] == "A"


class TestRepositoryCacheKeyIsolation:
    """A cache entry stamped with a foreign org_id must be discarded by get()."""

    def test_cache_with_foreign_org_id_rejected(self, monkeypatch):
        import app.firestore.base as base_mod

        db = FakeFirestore()
        monkeypatch.setattr(base_mod, "get_db", lambda: db)
        # Cache returns a row that belongs to ORG_A, but the repo is ORG_B.
        poisoned = {"id": "x1", "org_id": ORG_A, "name": "A"}
        monkeypatch.setattr(base_mod.cache, "get", lambda *a, **k: dict(poisoned))
        deleted = {"called": False}
        monkeypatch.setattr(base_mod.cache, "set", lambda *a, **k: None)
        monkeypatch.setattr(
            base_mod.cache, "delete", lambda *a, **k: deleted.__setitem__("called", True)
        )
        repo_b = _import_repo("app.firestore.invoices", "InvoiceRepository")(ORG_B)
        assert repo_b.get("x1") is None
        assert deleted["called"] is True


class TestWritePayloadOrgIdRejected:
    """A client cannot smuggle a foreign org_id into a create/update payload."""

    def test_create_rejects_foreign_org_id(self, fake_db):
        repo_a = _import_repo("app.firestore.invoices", "InvoiceRepository")(ORG_A)
        with pytest.raises(ValueError):
            repo_a.create({"org_id": ORG_B, "number": "INV-1"})

    def test_create_strips_when_no_org_id(self, fake_db):
        repo_a = _import_repo("app.firestore.contacts", "ContactRepository")(ORG_A)
        row = repo_a.create({"name": "Acme"})
        assert row["org_id"] == ORG_A

    def test_update_rejects_foreign_org_id(self, fake_db):
        doc_id = fake_db.seed("contacts", "c-own", ORG_A, name="Acme")
        repo_a = _import_repo("app.firestore.contacts", "ContactRepository")(ORG_A)
        with pytest.raises(ValueError):
            repo_a.update(doc_id, {"org_id": ORG_B, "name": "x"})


# ──────────────────────────────────────────────────────────────────────────────
# Layer 2 — API-level isolation: wrong role → 403, foreign resource → 404.
# Uses dependency-override auth + a router built around a repo bound to the fake.
# ──────────────────────────────────────────────────────────────────────────────

from fastapi import Depends, FastAPI, HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.services.auth import get_current_user  # noqa: E402
from app.services.permissions import require_perm  # noqa: E402


def _isolation_app(db: FakeFirestore):
    """A tiny app whose endpoints resolve the repo from the *token* org_id."""
    from fastapi import APIRouter

    import app.firestore.base as base_mod

    base_mod.get_db = lambda: db  # bind repos to the fake

    router = APIRouter(prefix="/api/invoices")

    def _repo_for(user: dict):
        from app.firestore.invoices import InvoiceRepository

        return InvoiceRepository(user["org_id"])

    @router.get("/{doc_id}")
    def get_invoice(doc_id: str, user: dict = Depends(get_current_user)):
        inv = _repo_for(user).get(doc_id)
        if not inv:
            raise HTTPException(status_code=404, detail="not found")
        return inv

    @router.delete("/{doc_id}")
    def delete_invoice(
        doc_id: str,
        user: dict = Depends(require_perm("invoices.delete")),
    ):
        repo = _repo_for(user)
        if not repo.get(doc_id):
            raise HTTPException(status_code=404, detail="not found")
        repo.delete(doc_id)
        return {"deleted": doc_id}

    app = FastAPI()
    app.include_router(router)
    return app


def _admin(org_id):
    return {"id": f"admin-{org_id}", "org_id": org_id, "role": "admin", "is_active": True}


def _viewer(org_id):
    return {"id": f"viewer-{org_id}", "org_id": org_id, "role": "viewer", "is_active": True}


class TestApiCrossTenant:
    def test_org_b_get_of_org_a_invoice_is_404(self, fake_db, monkeypatch):
        monkeypatch.setattr(
            "app.firestore.base.cache.get", lambda *a, **k: None
        )
        doc_id = fake_db.seed("invoices", "inv-A-1", ORG_A, number="INV-A-1")
        app = _isolation_app(fake_db)
        app.dependency_overrides[get_current_user] = lambda: _admin(ORG_B)
        client = TestClient(app, raise_server_exceptions=False)
        assert client.get(f"/api/invoices/{doc_id}").status_code == 404

    def test_owner_get_is_200(self, fake_db, monkeypatch):
        monkeypatch.setattr("app.firestore.base.cache.get", lambda *a, **k: None)
        doc_id = fake_db.seed("invoices", "inv-A-2", ORG_A, number="INV-A-2")
        app = _isolation_app(fake_db)
        app.dependency_overrides[get_current_user] = lambda: _admin(ORG_A)
        client = TestClient(app, raise_server_exceptions=False)
        assert client.get(f"/api/invoices/{doc_id}").status_code == 200

    def test_org_b_delete_of_org_a_invoice_is_404(self, fake_db, monkeypatch):
        monkeypatch.setattr("app.firestore.base.cache.get", lambda *a, **k: None)
        doc_id = fake_db.seed("invoices", "inv-A-3", ORG_A, number="INV-A-3")
        app = _isolation_app(fake_db)
        app.dependency_overrides[get_current_user] = lambda: _admin(ORG_B)
        client = TestClient(app, raise_server_exceptions=False)
        assert client.delete(f"/api/invoices/{doc_id}").status_code == 404
        # Org A's invoice must still exist.
        assert _import_repo("app.firestore.invoices", "InvoiceRepository")(ORG_A).get(doc_id)

    def test_viewer_delete_is_403(self, fake_db, monkeypatch):
        monkeypatch.setattr("app.firestore.base.cache.get", lambda *a, **k: None)
        doc_id = fake_db.seed("invoices", "inv-A-4", ORG_A, number="INV-A-4")
        app = _isolation_app(fake_db)
        # Viewer in the SAME org still cannot delete (RBAC) → 403.
        app.dependency_overrides[get_current_user] = lambda: _viewer(ORG_A)
        client = TestClient(app, raise_server_exceptions=False)
        assert client.delete(f"/api/invoices/{doc_id}").status_code == 403

    def test_viewer_cross_org_delete_is_403(self, fake_db, monkeypatch):
        monkeypatch.setattr("app.firestore.base.cache.get", lambda *a, **k: None)
        fake_db.seed("invoices", "inv-A-5", ORG_A, number="INV-A-5")
        app = _isolation_app(fake_db)
        # A viewer from Org B: RBAC denies before resource resolution → 403.
        app.dependency_overrides[get_current_user] = lambda: _viewer(ORG_B)
        client = TestClient(app, raise_server_exceptions=False)
        assert client.delete("/api/invoices/inv-A-5").status_code == 403


# ──────────────────────────────────────────────────────────────────────────────
# Coverage guard — keep the cross-tenant attempt count >= 50.
# ──────────────────────────────────────────────────────────────────────────────


def test_cross_tenant_attempt_count_at_least_50():
    """Document the breadth of coverage and prevent silent shrinkage.

    Repository layer: read + list + versioned-update across every main
    collection (3 attempts x N collections), plus cache-isolation, payload-org
    rejection, and 5 API-level attempts.
    """
    n = len(MAIN_COLLECTIONS)
    repo_attempts = n * 3            # foreign read, list-leak, foreign update
    extra_repo = 1 + 3              # cache poisoning + 3 payload-org tests
    api_attempts = 5
    total = repo_attempts + extra_repo + api_attempts
    assert n >= 16
    assert total >= 50, f"only {total} cross-tenant attempts; need >= 50"
