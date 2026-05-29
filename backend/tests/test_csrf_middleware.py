"""Tests for the CSRF protection middleware (SF4 / T-SF.4.6).

Covers:
  - Safe verbs (GET/HEAD/OPTIONS) are never blocked.
  - Bearer-authenticated mutations are exempt (CSRF-immune by design).
  - Cookie-authenticated mutations require a matching X-CSRF-Token header.
  - Exempt prefixes (login/refresh/webhooks) bypass the check.
  - Set-Cookie hardening: SameSite=Strict + HttpOnly (+ Secure in prod),
    with the csrf_token cookie kept JS-readable.
  - The feature flag disables enforcement but keeps cookie hardening.

Requirements: T-SF.4.6, OWASP A01/A05.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.middleware.csrf import (
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME,
    csrf_middleware,
    generate_csrf_token,
    harden_set_cookie_headers,
)


def _build_app() -> FastAPI:
    app = FastAPI()
    app.middleware("http")(csrf_middleware)

    @app.get("/api/contacts")
    def list_contacts():
        return {"ok": True}

    @app.post("/api/contacts")
    def create_contact():
        return {"created": True}

    @app.delete("/api/contacts/{cid}")
    def delete_contact(cid: str):
        return {"deleted": cid}

    @app.post("/api/auth/login")
    def login():
        # login is exempt and sets the csrf cookie + a session cookie
        resp = JSONResponse({"token": "x"})
        resp.set_cookie(CSRF_COOKIE_NAME, generate_csrf_token())
        resp.set_cookie("refresh_token", "secret-refresh")
        return resp

    @app.post("/api/payments/webhooks/stripe")
    def stripe_webhook():
        return {"received": True}

    return app


class _FakeSettings:
    """Stand-in so tests don't depend on the (orchestrator-added) config field."""

    def __init__(self, *, enabled: bool = True, environment: str = "development"):
        self.CSRF_PROTECTION_ENABLED = enabled
        self.ENVIRONMENT = environment


def _patch_settings(monkeypatch, *, enabled: bool, environment: str = "development"):
    import app.middleware.csrf as csrf_mod

    monkeypatch.setattr(
        csrf_mod, "get_settings",
        lambda: _FakeSettings(enabled=enabled, environment=environment),
    )


@pytest.fixture
def client(monkeypatch) -> TestClient:
    # Force enforcement on, development env (no Secure assertion noise).
    _patch_settings(monkeypatch, enabled=True, environment="development")
    return TestClient(_build_app(), raise_server_exceptions=False)


# ── 1. Safe verbs ──────────────────────────────────────────────────────────────


def test_get_not_blocked(client):
    assert client.get("/api/contacts").status_code == 200


def test_options_not_blocked(client):
    # No explicit OPTIONS route, but the middleware must let it through to the
    # router (which 405s) rather than 403.
    resp = client.options("/api/contacts")
    assert resp.status_code != 403


# ── 2. Bearer-authenticated mutations are exempt ───────────────────────────────


def test_bearer_post_exempt(client):
    resp = client.post(
        "/api/contacts",
        headers={"Authorization": "Bearer some.jwt.token"},
    )
    assert resp.status_code == 200


def test_bearer_delete_exempt(client):
    resp = client.delete(
        "/api/contacts/abc",
        headers={"Authorization": "Bearer some.jwt.token"},
    )
    assert resp.status_code == 200


# ── 3. Cookie-authenticated mutations need a matching header ───────────────────


def test_cookie_post_without_header_blocked(client):
    resp = client.post(
        "/api/contacts",
        cookies={CSRF_COOKIE_NAME: "abc123", "refresh_token": "x"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"] == "csrf_failed"


def test_cookie_post_with_wrong_header_blocked(client):
    resp = client.post(
        "/api/contacts",
        cookies={CSRF_COOKIE_NAME: "abc123"},
        headers={CSRF_HEADER_NAME: "WRONG"},
    )
    assert resp.status_code == 403


def test_cookie_post_with_matching_header_allowed(client):
    token = "match-me-123"
    resp = client.post(
        "/api/contacts",
        cookies={CSRF_COOKIE_NAME: token},
        headers={CSRF_HEADER_NAME: token},
    )
    assert resp.status_code == 200


def test_no_cookie_no_bearer_passes_through(client):
    # Anonymous mutation: nothing to protect; downstream auth would 401.
    resp = client.post("/api/contacts")
    assert resp.status_code == 200


# ── 4. Exempt prefixes ─────────────────────────────────────────────────────────


def test_login_exempt_even_without_token(client):
    assert client.post("/api/auth/login").status_code == 200


def test_webhook_exempt(client):
    # Provider-signed webhook, cookie present but no CSRF header → still allowed.
    resp = client.post(
        "/api/payments/webhooks/stripe",
        cookies={CSRF_COOKIE_NAME: "abc"},
    )
    assert resp.status_code == 200


# ── 5. Cookie hardening ────────────────────────────────────────────────────────


def test_set_cookie_hardened_on_login(client):
    resp = client.post("/api/auth/login")
    # httpx merges multiple Set-Cookie into a list accessible via headers.
    set_cookies = resp.headers.get_list("set-cookie") if hasattr(resp.headers, "get_list") else [resp.headers["set-cookie"]]
    joined = " ".join(set_cookies)
    # The refresh_token cookie must be HttpOnly + SameSite=Strict.
    assert "samesite=strict" in joined.lower()
    refresh_cookie = next(c for c in set_cookies if c.startswith("refresh_token="))
    assert "httponly" in refresh_cookie.lower()
    assert "samesite=strict" in refresh_cookie.lower()


def test_csrf_cookie_stays_js_readable(client):
    resp = client.post("/api/auth/login")
    set_cookies = resp.headers.get_list("set-cookie") if hasattr(resp.headers, "get_list") else [resp.headers["set-cookie"]]
    csrf_cookie = next(c for c in set_cookies if c.startswith(f"{CSRF_COOKIE_NAME}="))
    # csrf_token must NOT be HttpOnly (JS needs to echo it) but must be Strict.
    assert "httponly" not in csrf_cookie.lower()
    assert "samesite=strict" in csrf_cookie.lower()


def test_harden_adds_secure_in_production():
    """Unit test of the cookie-hardening helper in production mode."""
    resp = JSONResponse({"x": 1})
    resp.set_cookie("session", "v")
    harden_set_cookie_headers(resp, is_production=True)
    raw = b" ".join(v for k, v in resp.raw_headers if k.lower() == b"set-cookie").decode()
    assert "Secure" in raw
    assert "SameSite=Strict" in raw
    assert "HttpOnly" in raw


def test_harden_idempotent_when_attributes_present():
    resp = JSONResponse({"x": 1})
    # Pre-set SameSite + HttpOnly; helper must not duplicate them.
    resp.headers.append("set-cookie", "a=1; Path=/; SameSite=Strict; HttpOnly")
    harden_set_cookie_headers(resp, is_production=False)
    raw = b" ".join(v for k, v in resp.raw_headers if k.lower() == b"set-cookie").decode()
    assert raw.lower().count("samesite=") == 1
    assert raw.lower().count("httponly") == 1


# ── 6. Feature flag ────────────────────────────────────────────────────────────


def test_flag_off_disables_enforcement_but_keeps_hardening(monkeypatch):
    _patch_settings(monkeypatch, enabled=False, environment="development")
    c = TestClient(_build_app(), raise_server_exceptions=False)

    # Enforcement off: cookie-auth POST without header now passes.
    resp = c.post("/api/contacts", cookies={CSRF_COOKIE_NAME: "abc"})
    assert resp.status_code == 200

    # Hardening still applies on login.
    login = c.post("/api/auth/login")
    set_cookies = login.headers.get_list("set-cookie") if hasattr(login.headers, "get_list") else [login.headers["set-cookie"]]
    assert "samesite=strict" in " ".join(set_cookies).lower()


def test_generate_token_is_random_and_long():
    a, b = generate_csrf_token(), generate_csrf_token()
    assert a != b
    assert len(a) >= 32
