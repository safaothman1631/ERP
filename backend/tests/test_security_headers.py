"""
Security tests for API configuration.

Covers:
  - Security headers presence on all API responses  (Requirement 5.4)
  - CORS header validation (allowed vs disallowed origins)
  - API endpoint accessibility (health endpoint)

Uses FastAPI TestClient with a minimal app fixture that mirrors the real
security-headers middleware and CORS configuration from main.py, without
importing the full application (which requires Firebase and Firestore).

Validates: Requirements 5.4
"""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers — build a minimal app that replicates main.py security setup
# ---------------------------------------------------------------------------

def _build_app(cors_origins: list[str]) -> FastAPI:
    """Return a minimal FastAPI app with the same CORS + security-headers
    middleware as the real application."""
    app = FastAPI()

    # ── CORS (mirrors main.py) ──
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Zoho-Retry"],
    )

    # ── Security Headers Middleware (mirrors main.py) ──
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'"
        )
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return response

    # ── Routes ──
    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/data")
    def data():
        return {"data": "value"}

    @app.get("/non-api-route")
    def non_api():
        return {"page": "home"}

    return app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_ALLOWED_ORIGIN = "http://localhost:5173"
_DISALLOWED_ORIGIN = "http://evil.example.com"

_DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]


@pytest.fixture(scope="module")
def client() -> TestClient:
    """TestClient for the minimal security-configured app."""
    app = _build_app(_DEFAULT_CORS_ORIGINS)
    return TestClient(app, raise_server_exceptions=True)


# ---------------------------------------------------------------------------
# 1. Security headers presence
# ---------------------------------------------------------------------------

class TestSecurityHeadersPresence:
    """All required security headers must be present on API responses.

    Validates: Requirements 5.4
    """

    def test_x_content_type_options_present(self, client: TestClient):
        """X-Content-Type-Options: nosniff must be set on API responses."""
        response = client.get("/api/health")
        assert response.headers.get("X-Content-Type-Options") == "nosniff"

    def test_x_frame_options_present(self, client: TestClient):
        """X-Frame-Options: DENY must be set on API responses."""
        response = client.get("/api/health")
        assert response.headers.get("X-Frame-Options") == "DENY"

    def test_x_xss_protection_present(self, client: TestClient):
        """X-XSS-Protection: 1; mode=block must be set on API responses."""
        response = client.get("/api/health")
        assert response.headers.get("X-XSS-Protection") == "1; mode=block"

    def test_referrer_policy_present(self, client: TestClient):
        """Referrer-Policy: strict-origin-when-cross-origin must be set."""
        response = client.get("/api/health")
        assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

    def test_strict_transport_security_present(self, client: TestClient):
        """Strict-Transport-Security must be set with max-age=31536000."""
        response = client.get("/api/health")
        hsts = response.headers.get("Strict-Transport-Security", "")
        assert "max-age=31536000" in hsts

    def test_content_security_policy_present(self, client: TestClient):
        """Content-Security-Policy header must be present."""
        response = client.get("/api/health")
        csp = response.headers.get("Content-Security-Policy", "")
        assert csp, "Content-Security-Policy header is missing"
        assert "default-src" in csp

    def test_permissions_policy_present(self, client: TestClient):
        """Permissions-Policy must restrict camera, microphone, geolocation, payment."""
        response = client.get("/api/health")
        pp = response.headers.get("Permissions-Policy", "")
        assert "camera=()" in pp
        assert "microphone=()" in pp
        assert "geolocation=()" in pp
        assert "payment=()" in pp

    def test_all_required_security_headers_present(self, client: TestClient):
        """All seven required security headers must be present in a single request."""
        response = client.get("/api/data")
        required_headers = [
            "X-Content-Type-Options",
            "X-Frame-Options",
            "X-XSS-Protection",
            "Referrer-Policy",
            "Strict-Transport-Security",
            "Content-Security-Policy",
            "Permissions-Policy",
        ]
        missing = [h for h in required_headers if h not in response.headers]
        assert not missing, f"Missing security headers: {missing}"

    def test_security_headers_present_on_non_api_route(self, client: TestClient):
        """Security headers must also be present on non-/api/ routes."""
        response = client.get("/non-api-route")
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"

    def test_cache_control_set_on_api_routes(self, client: TestClient):
        """Cache-Control: no-store must be set on /api/ routes."""
        response = client.get("/api/data")
        cache_control = response.headers.get("Cache-Control", "")
        assert "no-store" in cache_control

    def test_cache_control_not_forced_on_non_api_routes(self, client: TestClient):
        """Cache-Control no-store should NOT be forced on non-/api/ routes."""
        response = client.get("/non-api-route")
        # The middleware only sets Cache-Control for /api/ paths
        cache_control = response.headers.get("Cache-Control", "")
        assert "no-store" not in cache_control


# ---------------------------------------------------------------------------
# 2. CORS header validation
# ---------------------------------------------------------------------------

class TestCORSHeaderValidation:
    """CORS headers must be present for allowed origins and absent for disallowed ones.

    Validates: Requirements 5.2, 5.3
    """

    def test_allowed_origin_receives_cors_header(self, client: TestClient):
        """An allowed origin must receive Access-Control-Allow-Origin in the response."""
        response = client.get(
            "/api/health",
            headers={"Origin": _ALLOWED_ORIGIN},
        )
        assert response.headers.get("Access-Control-Allow-Origin") == _ALLOWED_ORIGIN

    def test_disallowed_origin_does_not_receive_cors_header(self, client: TestClient):
        """A disallowed origin must NOT receive Access-Control-Allow-Origin."""
        response = client.get(
            "/api/health",
            headers={"Origin": _DISALLOWED_ORIGIN},
        )
        acao = response.headers.get("Access-Control-Allow-Origin", "")
        assert acao != _DISALLOWED_ORIGIN, (
            f"Disallowed origin {_DISALLOWED_ORIGIN!r} received CORS header"
        )

    def test_preflight_allowed_origin_returns_200(self, client: TestClient):
        """OPTIONS preflight from an allowed origin must succeed."""
        response = client.options(
            "/api/health",
            headers={
                "Origin": _ALLOWED_ORIGIN,
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        assert response.status_code in (200, 204)

    def test_preflight_allowed_origin_returns_allow_methods(self, client: TestClient):
        """Preflight response must include Access-Control-Allow-Methods."""
        response = client.options(
            "/api/health",
            headers={
                "Origin": _ALLOWED_ORIGIN,
                "Access-Control-Request-Method": "POST",
            },
        )
        allow_methods = response.headers.get("Access-Control-Allow-Methods", "")
        assert allow_methods, "Access-Control-Allow-Methods header is missing"

    def test_allowed_origin_receives_allow_credentials(self, client: TestClient):
        """Allowed origin must receive Access-Control-Allow-Credentials: true."""
        response = client.get(
            "/api/health",
            headers={"Origin": _ALLOWED_ORIGIN},
        )
        assert response.headers.get("Access-Control-Allow-Credentials") == "true"

    def test_multiple_allowed_origins_each_receive_cors_header(self):
        """Each origin in the CORS_ORIGINS list must receive the CORS header."""
        origins = [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
        ]
        app = _build_app(origins)
        test_client = TestClient(app)
        for origin in origins:
            response = test_client.get(
                "/api/health",
                headers={"Origin": origin},
            )
            acao = response.headers.get("Access-Control-Allow-Origin", "")
            assert acao == origin, (
                f"Origin {origin!r} expected in ACAO header, got {acao!r}"
            )

    def test_cors_origins_parsed_from_comma_separated_string(self):
        """CORS_ORIGINS env var parsed as comma-separated list must allow each origin.

        This mirrors the main.py parsing:
            [o.strip() for o in settings.CORS_ORIGINS.split(',') if o.strip()]
        """
        cors_origins_str = "http://localhost:5173, http://127.0.0.1:5173, http://localhost:3000"
        parsed = [o.strip() for o in cors_origins_str.split(",") if o.strip()]
        app = _build_app(parsed)
        test_client = TestClient(app)

        for origin in parsed:
            response = test_client.get(
                "/api/health",
                headers={"Origin": origin},
            )
            assert response.headers.get("Access-Control-Allow-Origin") == origin, (
                f"Parsed origin {origin!r} should be allowed"
            )

    def test_wildcard_origin_not_used_by_default(self, client: TestClient):
        """The CORS configuration must not use a wildcard '*' origin."""
        response = client.get(
            "/api/health",
            headers={"Origin": _ALLOWED_ORIGIN},
        )
        acao = response.headers.get("Access-Control-Allow-Origin", "")
        assert acao != "*", "CORS must not use wildcard '*' — specify explicit origins"


# ---------------------------------------------------------------------------
# 3. API endpoint accessibility
# ---------------------------------------------------------------------------

class TestAPIEndpointAccessibility:
    """Core API endpoints must be accessible and return expected responses."""

    def test_health_endpoint_returns_200(self, client: TestClient):
        """GET /api/health must return HTTP 200."""
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_endpoint_returns_ok_status(self, client: TestClient):
        """GET /api/health must return JSON body with status='ok'."""
        response = client.get("/api/health")
        body = response.json()
        assert body.get("status") == "ok"

    def test_health_endpoint_returns_json(self, client: TestClient):
        """GET /api/health must return a JSON content-type response."""
        response = client.get("/api/health")
        content_type = response.headers.get("Content-Type", "")
        assert "application/json" in content_type

    def test_health_endpoint_accessible_without_auth(self, client: TestClient):
        """Health endpoint must be accessible without an Authorization header."""
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_api_route_returns_security_headers_alongside_data(self, client: TestClient):
        """API data routes must return both the response body and security headers."""
        response = client.get("/api/data")
        assert response.status_code == 200
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.json() == {"data": "value"}
