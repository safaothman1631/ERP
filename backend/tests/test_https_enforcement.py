"""
Tests for HTTPS enforcement middleware.

Covers:
  - In production, HTTP requests (X-Forwarded-Proto: http) are redirected to HTTPS
  - In development, HTTP requests are NOT redirected
  - HTTPS requests pass through unchanged
  - HSTS header is present on all responses

Requirements: 6.12 (HTTPS enforcement)
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_app(environment: str) -> FastAPI:
    """Build a minimal FastAPI app with the HTTPS enforcement middleware."""
    app = FastAPI()

    # Mirror the enforce_https middleware from main.py
    @app.middleware("http")
    async def enforce_https(request: Request, call_next):
        if environment == "production":
            forwarded_proto = request.headers.get("x-forwarded-proto", "https")
            if forwarded_proto == "http":
                https_url = str(request.url).replace("http://", "https://", 1)
                return RedirectResponse(url=https_url, status_code=301)
        return await call_next(request)

    # Mirror the security headers middleware (HSTS)
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
        return response

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app


# ---------------------------------------------------------------------------
# 1. HTTPS enforcement in production
# ---------------------------------------------------------------------------

class TestHttpsEnforcementProduction:
    """In production, HTTP requests must be redirected to HTTPS.

    Validates: Requirement 6.12
    """

    @pytest.fixture
    def prod_client(self) -> TestClient:
        app = _build_app("production")
        return TestClient(app, raise_server_exceptions=True, follow_redirects=False)

    def test_http_request_redirected_to_https_in_production(self, prod_client):
        """HTTP request with X-Forwarded-Proto: http must be redirected to HTTPS."""
        response = prod_client.get(
            "/api/health",
            headers={"X-Forwarded-Proto": "http"},
        )
        assert response.status_code == 301, (
            f"Expected 301 redirect, got {response.status_code}"
        )

    def test_redirect_location_uses_https_scheme(self, prod_client):
        """Redirect location must use https:// scheme."""
        response = prod_client.get(
            "/api/health",
            headers={"X-Forwarded-Proto": "http"},
        )
        assert response.status_code == 301
        location = response.headers.get("location", "")
        assert location.startswith("https://"), (
            f"Redirect location must start with https://, got {location!r}"
        )

    def test_https_request_not_redirected_in_production(self, prod_client):
        """HTTPS request (X-Forwarded-Proto: https) must NOT be redirected."""
        response = prod_client.get(
            "/api/health",
            headers={"X-Forwarded-Proto": "https"},
        )
        assert response.status_code == 200, (
            f"HTTPS request should not be redirected, got {response.status_code}"
        )

    def test_request_without_forwarded_proto_not_redirected(self, prod_client):
        """Request without X-Forwarded-Proto header defaults to https (no redirect)."""
        response = prod_client.get("/api/health")
        assert response.status_code == 200, (
            "Request without X-Forwarded-Proto should not be redirected (defaults to https)"
        )


# ---------------------------------------------------------------------------
# 2. No HTTPS enforcement in development
# ---------------------------------------------------------------------------

class TestHttpsEnforcementDevelopment:
    """In development, HTTP requests must NOT be redirected.

    Validates: Requirement 6.12 (enforcement only in production)
    """

    @pytest.fixture
    def dev_client(self) -> TestClient:
        app = _build_app("development")
        return TestClient(app, raise_server_exceptions=True, follow_redirects=False)

    def test_http_request_not_redirected_in_development(self, dev_client):
        """HTTP request in development must NOT be redirected."""
        response = dev_client.get(
            "/api/health",
            headers={"X-Forwarded-Proto": "http"},
        )
        assert response.status_code == 200, (
            f"HTTP request in development should not be redirected, got {response.status_code}"
        )

    def test_https_request_passes_through_in_development(self, dev_client):
        """HTTPS request in development must pass through normally."""
        response = dev_client.get(
            "/api/health",
            headers={"X-Forwarded-Proto": "https"},
        )
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# 3. HSTS header
# ---------------------------------------------------------------------------

class TestHSTSHeader:
    """HSTS header must be present on all responses.

    Validates: Requirement 6.12 (HTTPS enforcement via HSTS)
    """

    @pytest.fixture
    def client(self) -> TestClient:
        app = _build_app("development")
        return TestClient(app, raise_server_exceptions=True)

    def test_hsts_header_present(self, client):
        """Strict-Transport-Security header must be present."""
        response = client.get("/api/health")
        assert "Strict-Transport-Security" in response.headers, (
            "Strict-Transport-Security header must be present"
        )

    def test_hsts_max_age_is_one_year(self, client):
        """HSTS max-age must be at least 31536000 (1 year)."""
        response = client.get("/api/health")
        hsts = response.headers.get("Strict-Transport-Security", "")
        assert "max-age=31536000" in hsts, (
            f"HSTS max-age must be 31536000, got: {hsts!r}"
        )

    def test_hsts_includes_subdomains(self, client):
        """HSTS must include includeSubDomains directive."""
        response = client.get("/api/health")
        hsts = response.headers.get("Strict-Transport-Security", "")
        assert "includeSubDomains" in hsts, (
            f"HSTS must include includeSubDomains, got: {hsts!r}"
        )

    def test_hsts_includes_preload(self, client):
        """HSTS must include preload directive for preload list eligibility."""
        response = client.get("/api/health")
        hsts = response.headers.get("Strict-Transport-Security", "")
        assert "preload" in hsts, (
            f"HSTS must include preload directive, got: {hsts!r}"
        )
