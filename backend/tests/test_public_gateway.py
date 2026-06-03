"""Tests for the public API gateway (Pool 3.6).

No live Firestore is hit:
  * ``ApiKeyRepository`` is exercised against an in-memory fake collection to
    prove the create→verify→revoke roundtrip and that only the hash is stored.
  * The public read endpoints patch ``_resolve_key`` (auth) and the source repo
    so we assert org-scoping + the rate-limit 429.
  * The key-management endpoints override ``get_current_user`` and patch the repo.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import public_gateway as G
from app.services.auth import get_current_user


# ─────────────────────────────────────────────────────────────────────────────
# In-memory fake for ApiKeyRepository roundtrip tests
# ─────────────────────────────────────────────────────────────────────────────
class _FakeDoc:
    def __init__(self, store: dict, doc_id: str):
        self._store = store
        self._id = doc_id

    def update(self, patch_data: dict):
        self._store.setdefault(self._id, {}).update(patch_data)


class _FakeCollection:
    def __init__(self, store: dict):
        self._store = store

    def document(self, doc_id: str):
        return _FakeDoc(self._store, doc_id)


def _make_repo(org_id: str = "org-1"):
    """Return an ApiKeyRepository whose Firestore calls hit an in-memory dict."""
    store: dict[str, dict] = {}
    repo = G.ApiKeyRepository.__new__(G.ApiKeyRepository)
    repo.org_id = org_id
    repo.collection_name = "api_keys"
    repo._store = store
    repo.collection = _FakeCollection(store)

    def _fake_super_create(data: dict) -> dict:
        store[data["id"]] = {**data, "org_id": org_id}
        return {**data, "org_id": org_id}

    def _fake_list(filters=None, **kw):
        rows = list(store.values())
        for f in filters or []:
            rows = [r for r in rows if r.get(f["field"]) == f["value"]]
        return rows, len(rows)

    def _fake_get(doc_id: str):
        rec = store.get(doc_id)
        return {**rec} if rec else None

    def _fake_update(doc_id: str, data: dict):
        store.setdefault(doc_id, {}).update(data)
        return {**store[doc_id]}

    # Patch the BaseRepository methods the repo relies on.
    repo.list = _fake_list  # type: ignore[assignment]
    repo.get = _fake_get  # type: ignore[assignment]
    repo.update = _fake_update  # type: ignore[assignment]
    # super().create — bypass validation/Firestore.
    import app.firestore.base as base_mod

    patcher = patch.object(base_mod.BaseRepository, "create", side_effect=_fake_super_create)
    patcher.start()
    repo._stop_super = patcher.stop  # type: ignore[attr-defined]
    return repo


# ─────────────────────────────────────────────────────────────────────────────
# Repository roundtrip
# ─────────────────────────────────────────────────────────────────────────────
def test_create_returns_plaintext_once_and_stores_only_hash():
    repo = _make_repo()
    try:
        created = repo.create(name="Zapier", scopes=["contacts", "items"])
        plaintext = created["plaintext_key"]
        assert plaintext.startswith("pk_")
        assert created["scopes"] == ["contacts", "items"]
        # Stored doc must NOT contain plaintext, only a sha256 hash.
        stored = repo._store[created["id"]]
        assert "plaintext_key" not in stored
        assert plaintext not in str(stored)
        assert stored["key_hash"] != plaintext
        import hashlib

        assert stored["key_hash"] == hashlib.sha256(plaintext.encode()).hexdigest()
        # Masked output never exposes the hash.
        assert "key_hash" not in created
    finally:
        repo._stop_super()


def test_verify_roundtrip_and_revoke():
    repo = _make_repo()
    try:
        created = repo.create(name="k", scopes=[])
        plaintext = created["plaintext_key"]

        rec = repo.verify(plaintext)
        assert rec is not None and rec["id"] == created["id"]

        # Wrong key does not verify.
        assert repo.verify("pk_totallywrongvalue") is None

        # Revoke flips is_active → subsequent verify fails.
        repo.revoke(created["id"])
        assert repo._store[created["id"]]["is_active"] is False
        assert repo.verify(plaintext) is None
    finally:
        repo._stop_super()


def test_list_masked_hides_hash():
    repo = _make_repo()
    try:
        created = repo.create(name="k", scopes=[])
        masked = repo.list_masked()
        assert len(masked) == 1
        assert "key_hash" not in masked[0]
        assert masked[0]["key_masked"].startswith(created["key_prefix"])
    finally:
        repo._stop_super()


# ─────────────────────────────────────────────────────────────────────────────
# Public read endpoints (API-key auth)
# ─────────────────────────────────────────────────────────────────────────────
@pytest.fixture(autouse=True)
def _clear_buckets():
    G._reset_rate_limits()
    yield
    G._reset_rate_limits()


@pytest.fixture
def public_client():
    app = FastAPI()
    app.include_router(G.public_router)
    return TestClient(app, raise_server_exceptions=False)


def test_missing_key_is_401(public_client):
    resp = public_client.get("/api/public/v1/contacts")
    assert resp.status_code == 401


def test_bad_key_is_401(public_client):
    with patch.object(G, "_resolve_key", return_value=None):
        resp = public_client.get("/api/public/v1/contacts", headers={"X-API-Key": "pk_bad"})
    assert resp.status_code == 401


def test_contacts_returns_org_scoped_data(public_client):
    key_rec = {"id": "k1", "org_id": "org-9", "scopes": ["contacts"], "is_active": True}
    page = MagicMock()
    page.items = [{"id": "c1", "display_name": "Acme", "org_id": "org-9"}]
    page.next_cursor = None
    page.has_more = False
    repo = MagicMock()
    repo.list_page.return_value = page

    with patch.object(G, "_resolve_key", return_value=key_rec), patch(
        "app.firestore.contacts.ContactRepository", return_value=repo
    ) as repo_cls:
        resp = public_client.get("/api/public/v1/contacts", headers={"X-API-Key": "pk_good"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["data"][0]["display_name"] == "Acme"
    assert body["has_more"] is False
    # Repo built for the KEY's org, not anything client-supplied.
    repo_cls.assert_called_once_with("org-9")


def test_catalog_lists_resources_and_openapi(public_client):
    key_rec = {"id": "k1", "org_id": "org-9", "scopes": ["items"], "is_active": True}
    with patch.object(G, "_resolve_key", return_value=key_rec):
        resp = public_client.get("/api/public/v1/catalog", headers={"X-API-Key": "pk_good"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["openapi_url"] == "/api/openapi.json"
    names = {r["name"] for r in body["resources"]}
    assert names == {"contacts", "items", "invoices"}


def test_rate_limit_returns_429_after_cap(public_client):
    key_rec = {"id": "kRL", "org_id": "org-9", "scopes": [], "is_active": True}
    with patch.object(G, "_resolve_key", return_value=key_rec):
        # Catalog needs no repo; hammer past the per-key cap.
        statuses = [
            public_client.get(
                "/api/public/v1/catalog", headers={"X-API-Key": "pk_good"}
            ).status_code
            for _ in range(G._RATE_LIMIT_PER_MIN + 5)
        ]
    assert 200 in statuses
    assert 429 in statuses
    # The 429 response carries Retry-After.
    with patch.object(G, "_resolve_key", return_value=key_rec):
        # Bucket already drained for this key → next call is 429.
        resp = public_client.get("/api/public/v1/catalog", headers={"X-API-Key": "pk_good"})
    assert resp.status_code == 429
    assert "Retry-After" in resp.headers


# ─────────────────────────────────────────────────────────────────────────────
# Key-management endpoints (normal user auth + permission)
# ─────────────────────────────────────────────────────────────────────────────
def _user():
    return {"id": "u1", "org_id": "org-1", "role": "owner", "email": "u@x.io"}


@pytest.fixture
def keys_client():
    app = FastAPI()
    app.include_router(G.keys_router)
    # Owner role satisfies require_perm("api_keys.manage") via the "*" wildcard.
    app.dependency_overrides[get_current_user] = _user
    return TestClient(app, raise_server_exceptions=False)


def test_create_key_endpoint_returns_plaintext(keys_client):
    repo = MagicMock()
    repo.create.return_value = {
        "id": "k1",
        "name": "Zapier",
        "key_prefix": "pk_abc123",
        "scopes": ["contacts"],
        "is_active": True,
        "key_masked": "pk_abc123••••••••",
        "plaintext_key": "pk_abc123secretbody",
    }
    with patch.object(G, "ApiKeyRepository", return_value=repo):
        resp = keys_client.post("/api/public/keys", json={"name": "Zapier", "scopes": ["contacts"]})
    assert resp.status_code == 201
    assert resp.json()["plaintext_key"] == "pk_abc123secretbody"
    repo.create.assert_called_once_with(name="Zapier", scopes=["contacts"])


def test_list_keys_endpoint(keys_client):
    repo = MagicMock()
    repo.list_masked.return_value = [{"id": "k1", "key_masked": "pk_abc123••••••••"}]
    with patch.object(G, "ApiKeyRepository", return_value=repo):
        resp = keys_client.get("/api/public/keys")
    assert resp.status_code == 200
    assert resp.json()[0]["id"] == "k1"


def test_revoke_key_endpoint(keys_client):
    repo = MagicMock()
    repo.revoke.return_value = {"id": "k1", "is_active": False, "key_masked": "pk_abc123••••••••"}
    with patch.object(G, "ApiKeyRepository", return_value=repo):
        resp = keys_client.delete("/api/public/keys/k1")
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    repo.revoke.assert_called_once_with("k1")


def test_revoke_missing_key_404(keys_client):
    repo = MagicMock()
    repo.revoke.return_value = None
    with patch.object(G, "ApiKeyRepository", return_value=repo):
        resp = keys_client.delete("/api/public/keys/nope")
    assert resp.status_code == 404
