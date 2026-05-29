"""
Unit and integration tests for backend rate limiting.

Covers:
  - slowapi Limiter is created with get_remote_address key function (Req 10.1, 10.2)
  - Rate limiting is optional via settings.RATE_LIMITING_ENABLED (Req 10.3)
  - 429 response with RateLimitExceeded error when limit exceeded (Req 10.4)
  - Configuration is adjustable via backend settings (Req 10.5)
  - Per-org token-bucket middleware returns 429 when org limit exceeded

Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
"""
from __future__ import annotations

import threading
import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_limited_app(rate_limit_enabled: bool, default_rate_limit: str = "5/minute") -> FastAPI:
    """Build a minimal FastAPI app with slowapi rate limiting configured."""
    from slowapi import _rate_limit_exceeded_handler
    from app.middleware.rate_limit import rate_limit_exceeded_handler

    app = FastAPI()

    lim = Limiter(
        key_func=get_remote_address,
        enabled=rate_limit_enabled,
        default_limits=[default_rate_limit] if rate_limit_enabled else [],
    )
    app.state.limiter = lim
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

    @app.get("/api/test")
    @lim.limit(default_rate_limit)
    def test_endpoint(request: Request):
        return {"status": "ok"}

    return app


# ---------------------------------------------------------------------------
# 1. Limiter configuration (Requirements 10.1, 10.2)
# ---------------------------------------------------------------------------

class TestLimiterConfiguration:
    """Verify the slowapi Limiter is configured correctly.

    Validates: Requirements 10.1, 10.2
    """

    def test_limiter_uses_get_remote_address(self):
        """Requirement 10.1, 10.2: Limiter key_func must be get_remote_address."""
        from app.middleware.rate_limit import limiter
        # slowapi stores the key function as _key_func internally
        assert limiter._key_func is get_remote_address, (
            "Limiter must use get_remote_address as the key function (IP-based)"
        )

    def test_limiter_is_slowapi_instance(self):
        """Requirement 10.1: The limiter must be a slowapi Limiter instance."""
        from app.middleware.rate_limit import limiter
        assert isinstance(limiter, Limiter), (
            "Rate limiter must be a slowapi.Limiter instance"
        )

    def test_limiter_enabled_flag_matches_settings(self):
        """Requirement 10.3: Limiter enabled flag must match settings.RATE_LIMITING_ENABLED."""
        with patch("app.middleware.rate_limit.settings") as mock_settings:
            mock_settings.RATE_LIMITING_ENABLED = True
            mock_settings.DEFAULT_RATE_LIMIT = "100/minute"
            from app.middleware.rate_limit import _build_limiter
            enabled_limiter = _build_limiter()
            assert enabled_limiter.enabled is True

    def test_limiter_disabled_when_setting_false(self):
        """Requirement 10.3: Limiter must be disabled when RATE_LIMITING_ENABLED=False."""
        with patch("app.middleware.rate_limit.settings") as mock_settings:
            mock_settings.RATE_LIMITING_ENABLED = False
            mock_settings.DEFAULT_RATE_LIMIT = "100/minute"
            from app.middleware.rate_limit import _build_limiter
            disabled_limiter = _build_limiter()
            assert disabled_limiter.enabled is False


# ---------------------------------------------------------------------------
# 2. Rate limiting optional via settings (Requirement 10.3)
# ---------------------------------------------------------------------------

class TestRateLimitingOptional:
    """Rate limiting must be opt-in via settings.RATE_LIMITING_ENABLED.

    Validates: Requirement 10.3
    """

    def test_disabled_rate_limiting_allows_many_requests(self):
        """When rate limiting is disabled, many requests must all succeed."""
        app = _build_limited_app(rate_limit_enabled=False, default_rate_limit="1/minute")
        client = TestClient(app, raise_server_exceptions=False)
        # Send 10 requests — all should succeed since limiting is disabled
        for i in range(10):
            response = client.get("/api/test")
            assert response.status_code == 200, (
                f"Request {i+1} failed with {response.status_code} — "
                "rate limiting should be disabled"
            )

    def test_enabled_rate_limiting_blocks_excess_requests(self):
        """When rate limiting is enabled, excess requests must return 429."""
        app = _build_limited_app(rate_limit_enabled=True, default_rate_limit="3/minute")
        client = TestClient(app, raise_server_exceptions=False)
        # First 3 requests should succeed
        for i in range(3):
            response = client.get("/api/test")
            assert response.status_code == 200, (
                f"Request {i+1} should succeed within limit"
            )
        # 4th request should be rate limited
        response = client.get("/api/test")
        assert response.status_code == 429, (
            "Request exceeding rate limit must return 429"
        )

    def test_settings_rate_limiting_enabled_field_exists(self):
        """Requirement 10.3: Settings must have RATE_LIMITING_ENABLED field."""
        from app.config import Settings
        s = Settings()
        assert hasattr(s, "RATE_LIMITING_ENABLED"), (
            "Settings must have RATE_LIMITING_ENABLED field"
        )
        assert isinstance(s.RATE_LIMITING_ENABLED, bool), (
            "RATE_LIMITING_ENABLED must be a boolean"
        )

    def test_settings_rate_limiting_disabled_by_default(self):
        """Requirement 10.3: Rate limiting must be disabled by default."""
        from app.config import Settings
        s = Settings()
        assert s.RATE_LIMITING_ENABLED is False, (
            "Rate limiting must be disabled by default (opt-in)"
        )


# ---------------------------------------------------------------------------
# 3. 429 response format (Requirement 10.4)
# ---------------------------------------------------------------------------

class TestRateLimitExceededResponse:
    """When rate limit is exceeded, must return 429 with RateLimitExceeded error.

    Validates: Requirement 10.4
    """

    def test_rate_limit_exceeded_returns_429(self):
        """Requirement 10.4: Exceeding rate limit must return HTTP 429."""
        app = _build_limited_app(rate_limit_enabled=True, default_rate_limit="2/minute")
        client = TestClient(app, raise_server_exceptions=False)
        # Exhaust the limit
        client.get("/api/test")
        client.get("/api/test")
        # This should be rate limited
        response = client.get("/api/test")
        assert response.status_code == 429

    def test_rate_limit_exceeded_response_contains_error_field(self):
        """Requirement 10.4: 429 response must contain 'error' field."""
        app = _build_limited_app(rate_limit_enabled=True, default_rate_limit="1/minute")
        client = TestClient(app, raise_server_exceptions=False)
        client.get("/api/test")  # exhaust limit
        response = client.get("/api/test")
        assert response.status_code == 429
        body = response.json()
        assert "error" in body, "429 response must contain 'error' field"

    def test_rate_limit_exceeded_response_error_is_rate_limit_exceeded(self):
        """Requirement 10.4: 'error' field must be 'RateLimitExceeded'."""
        app = _build_limited_app(rate_limit_enabled=True, default_rate_limit="1/minute")
        client = TestClient(app, raise_server_exceptions=False)
        client.get("/api/test")  # exhaust limit
        response = client.get("/api/test")
        assert response.status_code == 429
        body = response.json()
        assert body.get("error") == "RateLimitExceeded", (
            f"Expected error='RateLimitExceeded', got {body.get('error')!r}"
        )

    def test_rate_limit_exceeded_response_contains_retry_after_header(self):
        """Requirement 10.4: 429 response must include Retry-After header."""
        app = _build_limited_app(rate_limit_enabled=True, default_rate_limit="1/minute")
        client = TestClient(app, raise_server_exceptions=False)
        client.get("/api/test")  # exhaust limit
        response = client.get("/api/test")
        assert response.status_code == 429
        assert "Retry-After" in response.headers, (
            "429 response must include Retry-After header"
        )

    def test_rate_limit_exceeded_response_contains_detail(self):
        """Requirement 10.4: 429 response must contain 'detail' field."""
        app = _build_limited_app(rate_limit_enabled=True, default_rate_limit="1/minute")
        client = TestClient(app, raise_server_exceptions=False)
        client.get("/api/test")  # exhaust limit
        response = client.get("/api/test")
        assert response.status_code == 429
        body = response.json()
        assert "detail" in body, "429 response must contain 'detail' field"

    def test_rate_limit_handler_returns_json_response(self):
        """rate_limit_exceeded_handler must return a JSONResponse."""
        from fastapi.responses import JSONResponse
        from app.middleware.rate_limit import rate_limit_exceeded_handler
        import asyncio

        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/test"
        mock_request.client.host = "127.0.0.1"

        mock_exc = MagicMock(spec=RateLimitExceeded)
        mock_exc.detail = "1 per 1 minute"

        # Python 3.13 removed the implicit event-loop fallback that
        # ``asyncio.get_event_loop()`` used to provide on the main thread.
        # ``asyncio.run`` creates and tears down a fresh loop, which is the
        # supported way to drive a coroutine from synchronous test code.
        result = asyncio.run(rate_limit_exceeded_handler(mock_request, mock_exc))
        assert isinstance(result, JSONResponse)
        assert result.status_code == 429


# ---------------------------------------------------------------------------
# 4. Configuration adjustable via settings (Requirement 10.5)
# ---------------------------------------------------------------------------

class TestRateLimitConfiguration:
    """Rate limit configuration must be adjustable via backend settings.

    Validates: Requirement 10.5
    """

    def test_settings_has_default_rate_limit_field(self):
        """Requirement 10.5: Settings must have DEFAULT_RATE_LIMIT field."""
        from app.config import Settings
        s = Settings()
        assert hasattr(s, "DEFAULT_RATE_LIMIT"), (
            "Settings must have DEFAULT_RATE_LIMIT field"
        )

    def test_default_rate_limit_is_string(self):
        """Requirement 10.5: DEFAULT_RATE_LIMIT must be a string."""
        from app.config import Settings
        s = Settings()
        assert isinstance(s.DEFAULT_RATE_LIMIT, str), (
            "DEFAULT_RATE_LIMIT must be a string (e.g. '100/minute')"
        )

    def test_default_rate_limit_has_valid_format(self):
        """Requirement 10.5: DEFAULT_RATE_LIMIT must follow '<count>/<period>' format."""
        from app.config import Settings
        s = Settings()
        parts = s.DEFAULT_RATE_LIMIT.split("/")
        assert len(parts) == 2, (
            f"DEFAULT_RATE_LIMIT must be '<count>/<period>', got {s.DEFAULT_RATE_LIMIT!r}"
        )
        count_str, period = parts
        assert count_str.isdigit(), (
            f"Rate limit count must be an integer, got {count_str!r}"
        )
        assert period in ("second", "minute", "hour", "day"), (
            f"Rate limit period must be one of second/minute/hour/day, got {period!r}"
        )

    def test_custom_rate_limit_via_env(self):
        """Requirement 10.5: DEFAULT_RATE_LIMIT must be overridable via environment."""
        with patch.dict("os.environ", {"DEFAULT_RATE_LIMIT": "200/hour"}):
            from app.config import Settings
            s = Settings()
            assert s.DEFAULT_RATE_LIMIT == "200/hour", (
                "DEFAULT_RATE_LIMIT must be overridable via environment variable"
            )

    def test_rate_limiting_enabled_via_env(self):
        """Requirement 10.3, 10.5: RATE_LIMITING_ENABLED must be overridable via env."""
        with patch.dict("os.environ", {"RATE_LIMITING_ENABLED": "true"}):
            from app.config import Settings
            s = Settings()
            assert s.RATE_LIMITING_ENABLED is True, (
                "RATE_LIMITING_ENABLED must be overridable via environment variable"
            )


# ---------------------------------------------------------------------------
# 5. Per-org token-bucket middleware (legacy layer)
# ---------------------------------------------------------------------------

class TestOrgRateLimitMiddleware:
    """Per-org token-bucket middleware must return 429 when org limit exceeded.

    Validates: Requirement 10.4
    """

    def _build_org_app(self, rpm: int) -> FastAPI:
        """Build a minimal app with the org-scoped RateLimitMiddleware."""
        from app.middleware.rate_limit import RateLimitMiddleware

        app = FastAPI()

        # Mock settings_service.get_bag to return a fixed rpm
        async def mock_dispatch(request: Request, call_next):
            request.state.org_id = "test-org"
            return await call_next(request)

        app.middleware("http")(mock_dispatch)
        app.add_middleware(RateLimitMiddleware, default_rpm=rpm)

        @app.get("/api/test")
        def test_endpoint():
            return {"status": "ok"}

        return app

    def test_org_middleware_allows_requests_within_limit(self):
        """Requests within the org rate limit must succeed."""
        with patch("app.middleware.rate_limit.settings_service") as mock_svc:
            mock_svc.get_bag.return_value = {"rate_limit_per_minute": 60}
            app = self._build_org_app(rpm=60)
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/api/test", headers={"x-org-id": "test-org"})
            assert response.status_code == 200

    def test_org_middleware_returns_429_when_limit_exceeded(self):
        """Requests exceeding the org rate limit must return 429."""
        with patch("app.middleware.rate_limit.settings_service") as mock_svc:
            # Very low limit: 1 per minute
            mock_svc.get_bag.return_value = {"rate_limit_per_minute": 1}
            app = self._build_org_app(rpm=1)
            client = TestClient(app, raise_server_exceptions=False)
            # First request should succeed
            r1 = client.get("/api/test", headers={"x-org-id": "test-org"})
            assert r1.status_code == 200
            # Subsequent requests should be rate limited (bucket exhausted)
            r2 = client.get("/api/test", headers={"x-org-id": "test-org"})
            assert r2.status_code == 429

    def test_org_middleware_429_response_has_rate_limit_exceeded_error(self):
        """Org middleware 429 response must contain RateLimitExceeded error."""
        with patch("app.middleware.rate_limit.settings_service") as mock_svc:
            mock_svc.get_bag.return_value = {"rate_limit_per_minute": 1}
            app = self._build_org_app(rpm=1)
            client = TestClient(app, raise_server_exceptions=False)
            client.get("/api/test", headers={"x-org-id": "test-org"})
            response = client.get("/api/test", headers={"x-org-id": "test-org"})
            assert response.status_code == 429
            body = response.json()
            assert body.get("error") == "RateLimitExceeded"

    def test_org_middleware_skips_when_no_org_id(self):
        """Requests without org_id must not be rate limited by org middleware."""
        with patch("app.middleware.rate_limit.settings_service") as mock_svc:
            mock_svc.get_bag.return_value = {"rate_limit_per_minute": 1}

            from app.middleware.rate_limit import RateLimitMiddleware
            app = FastAPI()
            app.add_middleware(RateLimitMiddleware, default_rpm=1)

            @app.get("/api/test")
            def test_endpoint():
                return {"status": "ok"}

            client = TestClient(app, raise_server_exceptions=False)
            # Without org_id, middleware should pass through
            for _ in range(5):
                response = client.get("/api/test")
                assert response.status_code == 200

    def test_org_middleware_skips_when_rpm_zero(self):
        """Org middleware must skip rate limiting when rpm is 0 (disabled)."""
        with patch("app.middleware.rate_limit.settings_service") as mock_svc:
            mock_svc.get_bag.return_value = {"rate_limit_per_minute": 0}
            app = self._build_org_app(rpm=0)
            client = TestClient(app, raise_server_exceptions=False)
            for _ in range(5):
                response = client.get("/api/test", headers={"x-org-id": "test-org"})
                assert response.status_code == 200
