"""JWT verification assertions for the auth layer (SF4 / T-SF.4.5).

These tests pin the security guarantees of ``app.services.auth`` so a future
refactor cannot silently weaken token validation. We assert that the verifier:

  * rejects a **tampered signature** (token re-signed with the wrong key);
  * rejects an **expired** token (``exp`` in the past);
  * rejects a **wrong-algorithm** token (e.g. ``alg: none`` / RS256 forgery)
    — i.e. the verifier pins the symmetric HS256 algorithm and never honours
    an attacker-chosen ``alg`` header;
  * requires the **tenant claim** (``org_id``) and subject (``sub``) — a token
    missing either is rejected by ``get_current_user``;
  * honours **revocation** (jti denylist);
  * never leaks the SECRET_KEY in the 401 detail.

The codebase signs tokens with HS256 + SECRET_KEY and does not currently use
``aud``/``iss`` claims (single-audience, single-issuer deployment). The
``aud``/``iss`` dimension is therefore asserted at the *algorithm/claim-pinning*
level: a token forged under a different algorithm or signed by a different key
(a different "issuer" in practice) must not validate. See
``docs/security/firestore-rules-audit.md`` for the explicit note on adding
``aud``/``iss`` if the deployment ever becomes multi-audience.

Requirements: T-SF.4.5, Requirements 2.8 / 6.3 / 6.4.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from jose import jwt

from app.config import get_settings
from app.services import auth as auth_svc

settings = get_settings()


def _make_token(payload: dict, *, key: str | None = None, algorithm: str | None = None) -> str:
    return jwt.encode(
        payload,
        key or settings.SECRET_KEY,
        algorithm=algorithm or settings.ALGORITHM,
    )


def _valid_payload(**over) -> dict:
    base = {
        "sub": "user-1",
        "org_id": "org-1",
        "role": "admin",
        "exp": datetime.utcnow() + timedelta(minutes=30),
        "jti": "jti-valid-1",
        "token_type": "access",
    }
    base.update(over)
    return base


# ── 1. verify_token: signature / expiry / algorithm ───────────────────────────


class TestVerifyTokenSignature:
    def test_valid_token_accepted(self, monkeypatch):
        monkeypatch.setattr(auth_svc, "is_token_revoked", lambda jti: False)
        token = _make_token(_valid_payload())
        assert auth_svc.verify_token(token) is True

    def test_tampered_signature_rejected(self, monkeypatch):
        monkeypatch.setattr(auth_svc, "is_token_revoked", lambda jti: False)
        token = _make_token(_valid_payload(), key="a-totally-different-secret-key-1234567890")
        assert auth_svc.verify_token(token) is False

    def test_expired_token_rejected(self, monkeypatch):
        monkeypatch.setattr(auth_svc, "is_token_revoked", lambda jti: False)
        token = _make_token(_valid_payload(exp=datetime.utcnow() - timedelta(seconds=5)))
        assert auth_svc.verify_token(token) is False

    def test_garbage_token_rejected(self):
        assert auth_svc.verify_token("not-a-jwt") is False

    def test_empty_token_rejected(self):
        assert auth_svc.verify_token("") is False

    def test_revoked_token_rejected(self, monkeypatch):
        monkeypatch.setattr(auth_svc, "is_token_revoked", lambda jti: jti == "jti-valid-1")
        token = _make_token(_valid_payload())
        assert auth_svc.verify_token(token) is False


class TestAlgorithmPinning:
    """The verifier must reject tokens that use an algorithm it does not pin."""

    def test_alg_none_forgery_rejected(self, monkeypatch):
        monkeypatch.setattr(auth_svc, "is_token_revoked", lambda jti: False)
        # Manually craft an unsigned ("alg: none") token.
        import base64
        import json

        def _b64(obj: dict) -> str:
            return base64.urlsafe_b64encode(json.dumps(obj).encode()).rstrip(b"=").decode()

        header = _b64({"alg": "none", "typ": "JWT"})
        body = _b64({"sub": "user-1", "org_id": "org-1"})
        unsigned = f"{header}.{body}."
        assert auth_svc.verify_token(unsigned) is False

    def test_rs256_forgery_rejected(self, monkeypatch):
        """A token claiming RS256 must not validate against the HS256 verifier.

        jose refuses to HS-verify an RS-headered token, so a forger cannot
        downgrade/upgrade the algorithm to bypass the symmetric key check.
        """
        monkeypatch.setattr(auth_svc, "is_token_revoked", lambda jti: False)
        # Build an HS256 token then rewrite its header alg to RS256.
        import base64
        import json

        token = _make_token(_valid_payload())
        header_b64, rest = token.split(".", 1)
        forged_header = (
            base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
            .rstrip(b"=")
            .decode()
        )
        forged = f"{forged_header}.{rest}"
        assert auth_svc.verify_token(forged) is False


# ── 2. get_current_user: required claims + tenant scoping ──────────────────────


class _FakeDoc:
    def __init__(self, data: dict | None):
        self._data = data
        self.exists = data is not None
        self.id = (data or {}).get("id", "user-1")

    def to_dict(self):
        return dict(self._data or {})


class _FakeCollection:
    def __init__(self, store: dict):
        self._store = store

    def document(self, doc_id: str):
        coll = self

        class _Ref:
            def get(self):
                return _FakeDoc(coll._store.get(doc_id))

        return _Ref()


class _FakeDB:
    def __init__(self, users: dict, orgs: dict):
        self._users = users
        self._orgs = orgs

    def collection(self, name: str):
        if name == "users":
            return _FakeCollection(self._users)
        if name == "organizations":
            return _FakeCollection(self._orgs)
        return _FakeCollection({})


@pytest.fixture
def patch_db(monkeypatch):
    users = {
        "user-1": {"id": "user-1", "org_id": "org-1", "role": "admin", "is_active": True,
                   "email": "a@b.c", "name": "Admin"},
        "inactive": {"id": "inactive", "org_id": "org-1", "role": "viewer", "is_active": False},
    }
    orgs = {"org-1": {"id": "org-1", "status": "active"}}
    fake = _FakeDB(users, orgs)
    monkeypatch.setattr(auth_svc, "get_db", lambda: fake)
    monkeypatch.setattr(auth_svc, "is_token_revoked", lambda jti: False)
    # Cache is a real module; make set/get no-ops to avoid cross-test bleed.
    monkeypatch.setattr(auth_svc.cache, "get", lambda *a, **k: None)
    monkeypatch.setattr(auth_svc.cache, "set", lambda *a, **k: None)
    return fake


class TestGetCurrentUserClaims:
    def test_valid_token_returns_user(self, patch_db):
        token = _make_token(_valid_payload())
        user = auth_svc.get_current_user(token=token)
        assert user["id"] == "user-1"
        assert user["org_id"] == "org-1"

    def test_missing_org_id_rejected(self, patch_db):
        token = _make_token(_valid_payload(org_id=None))
        with pytest.raises(HTTPException) as ei:
            auth_svc.get_current_user(token=token)
        assert ei.value.status_code == 401

    def test_missing_sub_rejected(self, patch_db):
        token = _make_token(_valid_payload(sub=None))
        with pytest.raises(HTTPException) as ei:
            auth_svc.get_current_user(token=token)
        assert ei.value.status_code == 401

    def test_tampered_signature_rejected(self, patch_db):
        token = _make_token(_valid_payload(), key="another-wrong-secret-key-0987654321zzzz")
        with pytest.raises(HTTPException) as ei:
            auth_svc.get_current_user(token=token)
        assert ei.value.status_code == 401

    def test_expired_token_rejected(self, patch_db):
        token = _make_token(_valid_payload(exp=datetime.utcnow() - timedelta(minutes=1)))
        with pytest.raises(HTTPException) as ei:
            auth_svc.get_current_user(token=token)
        assert ei.value.status_code == 401

    def test_revoked_token_rejected(self, patch_db, monkeypatch):
        monkeypatch.setattr(auth_svc, "is_token_revoked", lambda jti: True)
        token = _make_token(_valid_payload())
        with pytest.raises(HTTPException) as ei:
            auth_svc.get_current_user(token=token)
        assert ei.value.status_code == 401

    def test_unknown_user_rejected(self, patch_db):
        token = _make_token(_valid_payload(sub="ghost"))
        with pytest.raises(HTTPException) as ei:
            auth_svc.get_current_user(token=token)
        assert ei.value.status_code == 401

    def test_inactive_user_rejected(self, patch_db):
        token = _make_token(_valid_payload(sub="inactive"))
        with pytest.raises(HTTPException) as ei:
            auth_svc.get_current_user(token=token)
        assert ei.value.status_code == 401

    def test_secret_key_never_leaked_in_error(self, patch_db):
        token = _make_token(_valid_payload(), key="leak-probe-secret-key-aaaaaaaaaaaaaaaaaa")
        with pytest.raises(HTTPException) as ei:
            auth_svc.get_current_user(token=token)
        detail = str(ei.value.detail)
        assert settings.SECRET_KEY not in detail
        assert "leak-probe" not in detail


class TestSuspendedOrg:
    def test_suspended_org_blocks_non_platform_user(self, monkeypatch):
        users = {"user-1": {"id": "user-1", "org_id": "org-x", "role": "admin", "is_active": True}}
        orgs = {"org-x": {"id": "org-x", "status": "suspended"}}
        fake = _FakeDB(users, orgs)
        monkeypatch.setattr(auth_svc, "get_db", lambda: fake)
        monkeypatch.setattr(auth_svc, "is_token_revoked", lambda jti: False)
        monkeypatch.setattr(auth_svc.cache, "get", lambda *a, **k: None)
        monkeypatch.setattr(auth_svc.cache, "set", lambda *a, **k: None)

        token = _make_token(_valid_payload(org_id="org-x"))
        with pytest.raises(HTTPException) as ei:
            auth_svc.get_current_user(token=token)
        assert ei.value.status_code == 403
