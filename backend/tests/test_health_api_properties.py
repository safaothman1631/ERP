"""
Property-Based Tests for Health Check API cache behavior (Property 19).

**Validates: Requirements 9.2, 9.4**

Property 19: Health check cache respects 30-second TTL
    For any cache entry with age t seconds where t < 30, calling
    GET /api/system/health/full (without force=true) SHALL return the cached
    result without re-running component checks.
    For any force=true call, the response SHALL contain freshly computed data
    regardless of cache age.
"""

from __future__ import annotations

import dataclasses
import time
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from hypothesis import given, settings as h_settings
from hypothesis import strategies as st

from app.api.health import _CACHE_TTL_SECONDS, router
from app.cache import cache
from app.services.health_checker import FullHealthReport, HealthCheckResult


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_report(overall_status: str = "healthy", tag: str = "cached") -> FullHealthReport:
    """Build a minimal FullHealthReport for use in cache/mock scenarios."""
    return FullHealthReport(
        overall_status=overall_status,
        checked_at="2024-01-15T02:00:00+00:00",
        components=[
            HealthCheckResult(
                component="firestore",
                status="healthy",
                response_time_ms=10.0,
                message=f"ok ({tag})",
                checked_at="2024-01-15T02:00:00+00:00",
            )
        ],
        recommendations=[],
    )


def _report_to_dict(report: FullHealthReport) -> dict:
    """Serialise a FullHealthReport to a plain dict (mirrors health.py logic)."""
    return dataclasses.asdict(report)


def _make_user(org_id: str = "test-org") -> dict:
    """Return a minimal user dict as returned by get_current_user."""
    return {"uid": "user-1", "org_id": org_id, "role": "admin"}


def _cache_key(org_id: str) -> str:
    return f"health:full:{org_id}"


# ─────────────────────────────────────────────────────────────────────────────
# Property 19: Health check cache respects 30-second TTL
# ─────────────────────────────────────────────────────────────────────────────

# Feature: system-health-backup, Property 19
@given(cache_age_seconds=st.floats(min_value=0.0, max_value=29.9))
@h_settings(max_examples=100)
def test_property19_cache_hit_within_ttl_skips_checker(cache_age_seconds: float) -> None:
    """
    **Validates: Requirements 9.2**

    # Feature: system-health-backup, Property 19: Health check cache respects 30-second TTL

    For any cache entry with age t < 30 seconds, a non-forced call to
    GET /api/system/health/full SHALL return the cached result without
    re-running HealthChecker.run_full_check.
    """
    import math
    if math.isnan(cache_age_seconds):
        return

    org_id = "test-org-prop19"
    key = _cache_key(org_id)
    cached_report = _make_report(tag="cached")
    cached_dict = _report_to_dict(cached_report)

    # Seed the cache with an entry whose age is cache_age_seconds
    fake_cached_at = time.monotonic() - cache_age_seconds
    cache.set(key, {"result": cached_dict, "cached_at": fake_cached_at})

    mock_checker = AsyncMock(return_value=_make_report(tag="fresh"))

    try:
        with patch("app.api.health.HealthChecker") as MockCheckerClass, \
             patch("app.api.health.get_current_user", return_value=_make_user(org_id)):
            # Configure the mock so that HealthChecker() returns an object
            # whose run_full_check is our AsyncMock
            instance = MagicMock()
            instance.run_full_check = mock_checker
            MockCheckerClass.return_value = instance

            # Import and call the handler directly (avoids full FastAPI app setup)
            import asyncio
            from app.api.health import get_full_health

            result = asyncio.run(
                get_full_health(force=False, user=_make_user(org_id))
            )

        # The checker must NOT have been called — cache was fresh
        mock_checker.assert_not_called(), (
            f"HealthChecker.run_full_check was called despite cache age "
            f"{cache_age_seconds:.3f}s < {_CACHE_TTL_SECONDS}s TTL"
        )

        # The returned result must be the cached one
        assert result == cached_dict, (
            f"Expected cached result to be returned for cache age "
            f"{cache_age_seconds:.3f}s, but got a different result"
        )
    finally:
        # Clean up cache entry so tests don't interfere with each other
        cache.delete(key)


# Feature: system-health-backup, Property 19
@given(cache_age_seconds=st.floats(min_value=0.0, max_value=29.9))
@h_settings(max_examples=100)
def test_property19_force_true_bypasses_cache_regardless_of_age(
    cache_age_seconds: float,
) -> None:
    """
    **Validates: Requirements 9.4**

    # Feature: system-health-backup, Property 19: Health check cache respects 30-second TTL

    For any force=True call, HealthChecker.run_full_check SHALL be called
    regardless of the cache entry age (even if the cache is fresh).
    The response SHALL contain freshly computed data, not cached data.
    """
    import math
    if math.isnan(cache_age_seconds):
        return

    org_id = "test-org-prop19-force"
    key = _cache_key(org_id)
    cached_report = _make_report(tag="stale-cached")
    cached_dict = _report_to_dict(cached_report)
    fresh_report = _make_report(tag="fresh-forced")
    fresh_dict = _report_to_dict(fresh_report)

    # Seed the cache with a fresh entry (age < 30s) — force should still bypass it
    fake_cached_at = time.monotonic() - cache_age_seconds
    cache.set(key, {"result": cached_dict, "cached_at": fake_cached_at})

    mock_checker = AsyncMock(return_value=fresh_report)

    try:
        with patch("app.api.health.HealthChecker") as MockCheckerClass, \
             patch("app.api.health.get_current_user", return_value=_make_user(org_id)):
            instance = MagicMock()
            instance.run_full_check = mock_checker
            MockCheckerClass.return_value = instance

            import asyncio
            from app.api.health import get_full_health

            result = asyncio.run(
                get_full_health(force=True, user=_make_user(org_id))
            )

        # The checker MUST have been called exactly once
        mock_checker.assert_called_once(), (
            f"HealthChecker.run_full_check was NOT called despite force=True "
            f"(cache age was {cache_age_seconds:.3f}s)"
        )

        # The returned result must be the fresh one, not the cached one
        assert result == fresh_dict, (
            f"Expected fresh result when force=True, but got cached result "
            f"(cache age was {cache_age_seconds:.3f}s)"
        )
        assert result != cached_dict or fresh_dict == cached_dict, (
            "force=True returned the cached result instead of the fresh one"
        )
    finally:
        cache.delete(key)


# ─────────────────────────────────────────────────────────────────────────────
# Supplementary unit tests (boundary values and edge cases)
# ─────────────────────────────────────────────────────────────────────────────

class TestHealthCacheBehaviorUnit:
    """Unit tests that pin exact boundary values for the 30-second TTL."""

    def setup_method(self):
        """Clear any leftover cache entries before each test."""
        self._org_id = "test-org-unit"
        self._key = _cache_key(self._org_id)
        cache.delete(self._key)

    def teardown_method(self):
        """Clean up cache after each test."""
        cache.delete(self._key)

    def _run(self, coro):
        import asyncio
        return asyncio.run(coro)

    def _call_endpoint(self, force: bool = False, org_id: str | None = None) -> dict:
        """Call get_full_health directly with mocked dependencies."""
        from app.api.health import get_full_health
        return self._run(get_full_health(force=force, user=_make_user(org_id or self._org_id)))

    def test_no_cache_entry_calls_checker(self):
        """When no cache entry exists, the checker must be called."""
        fresh_report = _make_report(tag="fresh")
        mock_checker = AsyncMock(return_value=fresh_report)

        with patch("app.api.health.HealthChecker") as MockCheckerClass:
            instance = MagicMock()
            instance.run_full_check = mock_checker
            MockCheckerClass.return_value = instance

            result = self._call_endpoint(force=False)

        mock_checker.assert_called_once()
        assert result == _report_to_dict(fresh_report)

    def test_fresh_cache_entry_skips_checker(self):
        """A cache entry that is 1 second old (< 30s) must be served directly."""
        cached_report = _make_report(tag="cached")
        cached_dict = _report_to_dict(cached_report)
        cache.set(self._key, {
            "result": cached_dict,
            "cached_at": time.monotonic() - 1.0,  # 1 second old
        })

        mock_checker = AsyncMock(return_value=_make_report(tag="fresh"))

        with patch("app.api.health.HealthChecker") as MockCheckerClass:
            instance = MagicMock()
            instance.run_full_check = mock_checker
            MockCheckerClass.return_value = instance

            result = self._call_endpoint(force=False)

        mock_checker.assert_not_called()
        assert result == cached_dict

    def test_cache_entry_at_29_9s_is_still_fresh(self):
        """A cache entry 29.9 seconds old is still within the 30s TTL."""
        cached_report = _make_report(tag="cached-29.9s")
        cached_dict = _report_to_dict(cached_report)
        cache.set(self._key, {
            "result": cached_dict,
            "cached_at": time.monotonic() - 29.9,
        })

        mock_checker = AsyncMock(return_value=_make_report(tag="fresh"))

        with patch("app.api.health.HealthChecker") as MockCheckerClass:
            instance = MagicMock()
            instance.run_full_check = mock_checker
            MockCheckerClass.return_value = instance

            result = self._call_endpoint(force=False)

        mock_checker.assert_not_called()
        assert result == cached_dict

    def test_cache_entry_at_30s_is_stale(self):
        """A cache entry exactly 30 seconds old is stale (age is NOT < 30s)."""
        cached_report = _make_report(tag="stale-30s")
        fresh_report = _make_report(tag="fresh")
        cache.set(self._key, {
            "result": _report_to_dict(cached_report),
            "cached_at": time.monotonic() - 30.0,
        })

        mock_checker = AsyncMock(return_value=fresh_report)

        with patch("app.api.health.HealthChecker") as MockCheckerClass:
            instance = MagicMock()
            instance.run_full_check = mock_checker
            MockCheckerClass.return_value = instance

            result = self._call_endpoint(force=False)

        mock_checker.assert_called_once()
        assert result == _report_to_dict(fresh_report)

    def test_force_true_calls_checker_even_with_fresh_cache(self):
        """force=True must call the checker even when the cache is 0 seconds old."""
        cached_report = _make_report(tag="cached-fresh")
        fresh_report = _make_report(tag="forced-fresh")
        cache.set(self._key, {
            "result": _report_to_dict(cached_report),
            "cached_at": time.monotonic(),  # just set — 0 seconds old
        })

        mock_checker = AsyncMock(return_value=fresh_report)

        with patch("app.api.health.HealthChecker") as MockCheckerClass:
            instance = MagicMock()
            instance.run_full_check = mock_checker
            MockCheckerClass.return_value = instance

            result = self._call_endpoint(force=True)

        mock_checker.assert_called_once()
        assert result == _report_to_dict(fresh_report)

    def test_force_true_updates_cache_with_fresh_result(self):
        """After a force=True call, the cache must hold the new result."""
        old_report = _make_report(tag="old")
        new_report = _make_report(tag="new")
        cache.set(self._key, {
            "result": _report_to_dict(old_report),
            "cached_at": time.monotonic() - 5.0,
        })

        mock_checker = AsyncMock(return_value=new_report)

        with patch("app.api.health.HealthChecker") as MockCheckerClass:
            instance = MagicMock()
            instance.run_full_check = mock_checker
            MockCheckerClass.return_value = instance

            self._call_endpoint(force=True)

        # The cache must now hold the new result
        entry = cache.get(self._key)
        assert entry is not None
        assert entry["result"] == _report_to_dict(new_report)

    def test_two_non_force_calls_within_ttl_call_checker_only_once(self):
        """Two consecutive non-force calls within 30s must invoke the checker once."""
        fresh_report = _make_report(tag="fresh")
        mock_checker = AsyncMock(return_value=fresh_report)

        with patch("app.api.health.HealthChecker") as MockCheckerClass:
            instance = MagicMock()
            instance.run_full_check = mock_checker
            MockCheckerClass.return_value = instance

            # First call — no cache, checker runs
            result1 = self._call_endpoint(force=False)
            # Second call — cache is fresh (just set), checker must NOT run again
            result2 = self._call_endpoint(force=False)

        assert mock_checker.call_count == 1, (
            f"Expected checker to be called exactly once for two non-force calls "
            f"within TTL, but it was called {mock_checker.call_count} times"
        )
        assert result1 == result2

    def test_non_force_call_after_ttl_expires_calls_checker_again(self):
        """After the TTL expires, the next non-force call must re-run the checker."""
        old_report = _make_report(tag="old")
        new_report = _make_report(tag="new")

        # Seed cache with a stale entry (31 seconds old)
        cache.set(self._key, {
            "result": _report_to_dict(old_report),
            "cached_at": time.monotonic() - 31.0,
        })

        mock_checker = AsyncMock(return_value=new_report)

        with patch("app.api.health.HealthChecker") as MockCheckerClass:
            instance = MagicMock()
            instance.run_full_check = mock_checker
            MockCheckerClass.return_value = instance

            result = self._call_endpoint(force=False)

        mock_checker.assert_called_once()
        assert result == _report_to_dict(new_report)
