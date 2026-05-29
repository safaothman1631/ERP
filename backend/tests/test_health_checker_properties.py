"""
Property-Based Tests for HealthChecker classification logic (Properties 1–6).

**Validates: Requirements 1.3, 1.4, 1.5, 1.7, 1.8, 1.9, 1.10, 1.11, 1.13, 1.14, 10.5**

Property 1: Component status classification is deterministic by response time
    For any response_time_ms in [0, 499.9) with no exception → status == "healthy".
    For any response_time_ms >= 500 with no exception → status == "degraded".
    For any exception (regardless of response time) → status == "unhealthy".

Property 2: Memory and CPU thresholds are correctly applied
    For any memory_pct >= 95 → "unhealthy".
    For any 85 < memory_pct < 95 → "degraded".
    For any memory_pct <= 85 → "healthy".
    For any cpu_pct > 80 → "degraded".
    For any cpu_pct <= 80 → "healthy".

Property 3: Error count thresholds are correctly applied
    For any error_count >= 200 → "unhealthy".
    For any 50 <= error_count < 200 → "degraded".
    For any error_count < 50 → "healthy".

Property 4: Overall status aggregation is correct
    For any list of component statuses:
      - "unhealthy" if at least one component is "unhealthy"
      - "degraded" if at least one is "degraded" and none are "unhealthy"
      - "healthy" only when all components are "healthy"

Property 5: Recommendations cover all non-healthy components
    For any list of HealthCheckResult objects where k components have
    status != "healthy", _build_recommendations returns a list with >= k entries.

Property 6: Error messages are sanitized (no stack traces)
    For any Python exception, the resulting message field SHALL NOT contain
    "Traceback", 'File "', "line ", or "raise ".
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

import pytest
from hypothesis import given, settings as h_settings
from hypothesis import strategies as st

from app.services.health_checker import (
    HealthCheckResult,
    HealthChecker,
    _sanitize_message,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _checker() -> HealthChecker:
    """Return a fresh HealthChecker instance (stateless)."""
    return HealthChecker()


def _classify(
    component: str,
    response_time_ms: float,
    exception: Exception | None = None,
    extra: dict | None = None,
) -> HealthCheckResult:
    """Thin wrapper around HealthChecker._classify_result."""
    return _checker()._classify_result(
        component=component,
        response_time_ms=response_time_ms,
        exception=exception,
        extra=extra or {},
    )


def _make_result(status: Literal["healthy", "degraded", "unhealthy"]) -> HealthCheckResult:
    """Build a minimal HealthCheckResult with the given status."""
    return HealthCheckResult(
        component="test",
        status=status,
        response_time_ms=0.0,
        message="test",
        checked_at="2024-01-01T00:00:00+00:00",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Property 1: Component status classification is deterministic by response time
# ─────────────────────────────────────────────────────────────────────────────

# Feature: system-health-backup, Property 1
@given(response_time_ms=st.floats(min_value=0, max_value=499.9))
@h_settings(max_examples=200)
def test_property1_fast_response_is_healthy(response_time_ms):
    """
    **Validates: Requirements 1.3**

    # Feature: system-health-backup, Property 1: Component status classification is deterministic by response time

    For any response_time_ms in [0, 499.9] with no exception, the component
    status SHALL be "healthy".
    """
    # Skip NaN — not a valid response time
    if math.isnan(response_time_ms):
        return

    result = _classify("firestore", response_time_ms, exception=None)
    assert result.status == "healthy", (
        f"Expected 'healthy' for response_time_ms={response_time_ms}, "
        f"got '{result.status}'"
    )


# Feature: system-health-backup, Property 1
@given(response_time_ms=st.floats(min_value=500.0))
@h_settings(max_examples=200)
def test_property1_slow_response_is_degraded(response_time_ms):
    """
    **Validates: Requirements 1.4**

    # Feature: system-health-backup, Property 1: Component status classification is deterministic by response time

    For any response_time_ms >= 500 with no exception, the component status
    SHALL be "degraded".
    """
    # Skip NaN and infinity — not valid response times
    if math.isnan(response_time_ms) or math.isinf(response_time_ms):
        return

    result = _classify("firestore", response_time_ms, exception=None)
    assert result.status == "degraded", (
        f"Expected 'degraded' for response_time_ms={response_time_ms}, "
        f"got '{result.status}'"
    )


# Feature: system-health-backup, Property 1
@given(
    response_time_ms=st.floats(min_value=0, max_value=10_000),
    exc_msg=st.text(max_size=200),
)
@h_settings(max_examples=200)
def test_property1_exception_is_unhealthy(response_time_ms, exc_msg):
    """
    **Validates: Requirements 1.5**

    # Feature: system-health-backup, Property 1: Component status classification is deterministic by response time

    For any exception (regardless of response time), the component status
    SHALL be "unhealthy".
    """
    if math.isnan(response_time_ms):
        return

    exc = RuntimeError(exc_msg)
    result = _classify("firestore", response_time_ms, exception=exc)
    assert result.status == "unhealthy", (
        f"Expected 'unhealthy' when exception is provided, "
        f"got '{result.status}' (response_time_ms={response_time_ms})"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Property 2: Memory and CPU thresholds are correctly applied
# ─────────────────────────────────────────────────────────────────────────────

# Feature: system-health-backup, Property 2
@given(
    memory_pct=st.floats(min_value=0.0, max_value=100.0),
    cpu_pct=st.floats(min_value=0.0, max_value=100.0),
)
@h_settings(max_examples=200)
def test_property2_memory_and_cpu_thresholds(memory_pct, cpu_pct):
    """
    **Validates: Requirements 1.7, 1.8, 1.9**

    # Feature: system-health-backup, Property 2: Memory and CPU thresholds are correctly applied

    Memory:
      - memory_pct >= 95  → "unhealthy"
      - 85 < memory_pct < 95 → "degraded"
      - memory_pct <= 85  → "healthy"

    CPU:
      - cpu_pct > 80  → "degraded"
      - cpu_pct <= 80 → "healthy"
    """
    if math.isnan(memory_pct) or math.isnan(cpu_pct):
        return

    # ── Memory classification ──────────────────────────────────────────────
    mem_result = _classify(
        "memory",
        response_time_ms=10.0,
        exception=None,
        extra={"memory_pct": memory_pct},
    )

    if memory_pct >= 95.0:
        assert mem_result.status == "unhealthy", (
            f"memory_pct={memory_pct} >= 95 should be 'unhealthy', "
            f"got '{mem_result.status}'"
        )
    elif memory_pct > 85.0:
        assert mem_result.status == "degraded", (
            f"memory_pct={memory_pct} in (85, 95) should be 'degraded', "
            f"got '{mem_result.status}'"
        )
    else:
        # memory_pct <= 85
        assert mem_result.status == "healthy", (
            f"memory_pct={memory_pct} <= 85 should be 'healthy', "
            f"got '{mem_result.status}'"
        )

    # ── CPU classification ─────────────────────────────────────────────────
    cpu_result = _classify(
        "cpu",
        response_time_ms=10.0,
        exception=None,
        extra={"cpu_pct": cpu_pct},
    )

    if cpu_pct > 80.0:
        assert cpu_result.status == "degraded", (
            f"cpu_pct={cpu_pct} > 80 should be 'degraded', "
            f"got '{cpu_result.status}'"
        )
    else:
        assert cpu_result.status == "healthy", (
            f"cpu_pct={cpu_pct} <= 80 should be 'healthy', "
            f"got '{cpu_result.status}'"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Property 3: Error count thresholds are correctly applied
# ─────────────────────────────────────────────────────────────────────────────

# Feature: system-health-backup, Property 3
@given(error_count=st.integers(min_value=0, max_value=500))
@h_settings(max_examples=200)
def test_property3_error_count_thresholds(error_count):
    """
    **Validates: Requirements 1.10, 1.11**

    # Feature: system-health-backup, Property 3: Error count thresholds are correctly applied

    For any recent error count n:
      - n >= 200 → "unhealthy"
      - 50 <= n < 200 → "degraded"
      - n < 50 → "healthy"
    """
    result = _classify(
        "recent_errors",
        response_time_ms=10.0,
        exception=None,
        extra={"error_count": error_count},
    )

    if error_count >= 200:
        assert result.status == "unhealthy", (
            f"error_count={error_count} >= 200 should be 'unhealthy', "
            f"got '{result.status}'"
        )
    elif error_count >= 50:
        assert result.status == "degraded", (
            f"error_count={error_count} in [50, 200) should be 'degraded', "
            f"got '{result.status}'"
        )
    else:
        assert result.status == "healthy", (
            f"error_count={error_count} < 50 should be 'healthy', "
            f"got '{result.status}'"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Property 4: Overall status aggregation is correct
# ─────────────────────────────────────────────────────────────────────────────

# Feature: system-health-backup, Property 4
@given(
    statuses=st.lists(
        st.sampled_from(["healthy", "degraded", "unhealthy"]),
        min_size=1,
        max_size=10,
    )
)
@h_settings(max_examples=200)
def test_property4_overall_status_aggregation(statuses):
    """
    **Validates: Requirements 1.13**

    # Feature: system-health-backup, Property 4: Overall status aggregation is correct

    For any list of component statuses:
      - "unhealthy" if at least one component is "unhealthy"
      - "degraded" if at least one is "degraded" and none are "unhealthy"
      - "healthy" only when all components are "healthy"
    """
    results = [_make_result(s) for s in statuses]
    checker = _checker()
    overall = checker._compute_overall(results)

    if "unhealthy" in statuses:
        assert overall == "unhealthy", (
            f"Expected 'unhealthy' when statuses contain 'unhealthy': "
            f"{statuses}, got '{overall}'"
        )
    elif "degraded" in statuses:
        assert overall == "degraded", (
            f"Expected 'degraded' when statuses contain 'degraded' but no "
            f"'unhealthy': {statuses}, got '{overall}'"
        )
    else:
        assert overall == "healthy", (
            f"Expected 'healthy' when all statuses are 'healthy': "
            f"{statuses}, got '{overall}'"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Property 5: Recommendations cover all non-healthy components
# ─────────────────────────────────────────────────────────────────────────────

_COMPONENT_NAMES = [
    "firestore", "auth", "storage", "scheduler",
    "api_self", "memory", "cpu", "recent_errors",
]

_STATUS_STRATEGY = st.sampled_from(["healthy", "degraded", "unhealthy"])


# Feature: system-health-backup, Property 5
@given(
    statuses=st.lists(
        _STATUS_STRATEGY,
        min_size=1,
        max_size=len(_COMPONENT_NAMES),
    )
)
@h_settings(max_examples=200)
def test_property5_recommendations_cover_all_non_healthy(statuses):
    """
    **Validates: Requirements 1.14**

    # Feature: system-health-backup, Property 5: Recommendations cover all non-healthy components

    For any list of HealthCheckResult objects where k components have
    status != "healthy", _build_recommendations SHALL return a list with
    at least k entries (one recommendation per non-healthy component).
    """
    # Build results using known component names (cycle if more statuses than names)
    results = []
    for i, status in enumerate(statuses):
        component = _COMPONENT_NAMES[i % len(_COMPONENT_NAMES)]
        results.append(
            HealthCheckResult(
                component=component,
                status=status,
                response_time_ms=10.0,
                message="test",
                checked_at="2024-01-01T00:00:00+00:00",
            )
        )

    k = sum(1 for s in statuses if s != "healthy")
    checker = _checker()
    recommendations = checker._build_recommendations(results)

    assert len(recommendations) >= k, (
        f"Expected at least {k} recommendations for {k} non-healthy components, "
        f"got {len(recommendations)}. Statuses: {statuses}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Property 6: Error messages are sanitized (no stack traces)
# ─────────────────────────────────────────────────────────────────────────────

_STACK_TRACE_MARKERS = ("Traceback", 'File "', "line ", "raise ")


# Feature: system-health-backup, Property 6
@given(exc_msg=st.text())
@h_settings(max_examples=200)
def test_property6_error_messages_are_sanitized(exc_msg):
    """
    **Validates: Requirements 10.5**

    # Feature: system-health-backup, Property 6: Error messages are sanitized (no stack traces)

    For any Python exception passed to _classify_result, the resulting
    message field SHALL NOT contain any of the substrings:
      - "Traceback"
      - 'File "'
      - "line "
      - "raise "
    """
    exc = RuntimeError(exc_msg)
    result = _classify("firestore", response_time_ms=0.0, exception=exc)

    for marker in _STACK_TRACE_MARKERS:
        assert marker not in result.message, (
            f"Sanitized message contains forbidden marker {marker!r}. "
            f"Input exc_msg={exc_msg!r}, resulting message={result.message!r}"
        )


# Feature: system-health-backup, Property 6 (via _sanitize_message directly)
@given(raw_msg=st.text())
@h_settings(max_examples=200)
def test_property6_sanitize_message_removes_all_markers(raw_msg):
    """
    **Validates: Requirements 10.5**

    # Feature: system-health-backup, Property 6: Error messages are sanitized (no stack traces)

    _sanitize_message applied to any string SHALL produce output that does
    not contain any of the four forbidden stack-trace markers.
    """
    sanitized = _sanitize_message(raw_msg)

    for marker in _STACK_TRACE_MARKERS:
        assert marker not in sanitized, (
            f"_sanitize_message output contains forbidden marker {marker!r}. "
            f"Input={raw_msg!r}, output={sanitized!r}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Supplementary unit tests (boundary values and edge cases)
# ─────────────────────────────────────────────────────────────────────────────

class TestHealthCheckerClassificationUnit:
    """Unit tests that pin exact boundary values for the classification rules."""

    # ── Property 1 boundary values ─────────────────────────────────────────

    def test_499ms_is_healthy(self):
        result = _classify("firestore", 499.0)
        assert result.status == "healthy"

    def test_499_9ms_is_healthy(self):
        result = _classify("firestore", 499.9)
        assert result.status == "healthy"

    def test_500ms_is_degraded(self):
        result = _classify("firestore", 500.0)
        assert result.status == "degraded"

    def test_501ms_is_degraded(self):
        result = _classify("firestore", 501.0)
        assert result.status == "degraded"

    def test_0ms_is_healthy(self):
        result = _classify("firestore", 0.0)
        assert result.status == "healthy"

    def test_exception_overrides_fast_response(self):
        result = _classify("firestore", 10.0, exception=ValueError("boom"))
        assert result.status == "unhealthy"

    def test_exception_overrides_slow_response(self):
        result = _classify("firestore", 9999.0, exception=ValueError("boom"))
        assert result.status == "unhealthy"

    # ── Property 2 boundary values ─────────────────────────────────────────

    def test_memory_85_is_healthy(self):
        result = _classify("memory", 10.0, extra={"memory_pct": 85.0})
        assert result.status == "healthy"

    def test_memory_85_1_is_degraded(self):
        result = _classify("memory", 10.0, extra={"memory_pct": 85.1})
        assert result.status == "degraded"

    def test_memory_94_9_is_degraded(self):
        result = _classify("memory", 10.0, extra={"memory_pct": 94.9})
        assert result.status == "degraded"

    def test_memory_95_is_unhealthy(self):
        result = _classify("memory", 10.0, extra={"memory_pct": 95.0})
        assert result.status == "unhealthy"

    def test_memory_100_is_unhealthy(self):
        result = _classify("memory", 10.0, extra={"memory_pct": 100.0})
        assert result.status == "unhealthy"

    def test_cpu_80_is_healthy(self):
        result = _classify("cpu", 10.0, extra={"cpu_pct": 80.0})
        assert result.status == "healthy"

    def test_cpu_80_1_is_degraded(self):
        result = _classify("cpu", 10.0, extra={"cpu_pct": 80.1})
        assert result.status == "degraded"

    def test_cpu_100_is_degraded(self):
        result = _classify("cpu", 10.0, extra={"cpu_pct": 100.0})
        assert result.status == "degraded"

    # ── Property 3 boundary values ─────────────────────────────────────────

    def test_error_count_0_is_healthy(self):
        result = _classify("recent_errors", 10.0, extra={"error_count": 0})
        assert result.status == "healthy"

    def test_error_count_49_is_healthy(self):
        result = _classify("recent_errors", 10.0, extra={"error_count": 49})
        assert result.status == "healthy"

    def test_error_count_50_is_degraded(self):
        result = _classify("recent_errors", 10.0, extra={"error_count": 50})
        assert result.status == "degraded"

    def test_error_count_199_is_degraded(self):
        result = _classify("recent_errors", 10.0, extra={"error_count": 199})
        assert result.status == "degraded"

    def test_error_count_200_is_unhealthy(self):
        result = _classify("recent_errors", 10.0, extra={"error_count": 200})
        assert result.status == "unhealthy"

    def test_error_count_500_is_unhealthy(self):
        result = _classify("recent_errors", 10.0, extra={"error_count": 500})
        assert result.status == "unhealthy"

    # ── Property 4 edge cases ──────────────────────────────────────────────

    def test_overall_single_healthy(self):
        checker = _checker()
        assert checker._compute_overall([_make_result("healthy")]) == "healthy"

    def test_overall_single_degraded(self):
        checker = _checker()
        assert checker._compute_overall([_make_result("degraded")]) == "degraded"

    def test_overall_single_unhealthy(self):
        checker = _checker()
        assert checker._compute_overall([_make_result("unhealthy")]) == "unhealthy"

    def test_overall_unhealthy_dominates_degraded(self):
        checker = _checker()
        results = [_make_result("degraded"), _make_result("unhealthy")]
        assert checker._compute_overall(results) == "unhealthy"

    def test_overall_unhealthy_dominates_healthy(self):
        checker = _checker()
        results = [_make_result("healthy"), _make_result("unhealthy")]
        assert checker._compute_overall(results) == "unhealthy"

    def test_overall_degraded_dominates_healthy(self):
        checker = _checker()
        results = [_make_result("healthy"), _make_result("degraded")]
        assert checker._compute_overall(results) == "degraded"

    def test_overall_all_healthy(self):
        checker = _checker()
        results = [_make_result("healthy")] * 8
        assert checker._compute_overall(results) == "healthy"

    # ── Property 5 edge cases ──────────────────────────────────────────────

    def test_recommendations_empty_when_all_healthy(self):
        checker = _checker()
        results = [_make_result("healthy")] * 3
        recs = checker._build_recommendations(results)
        assert recs == []

    def test_recommendations_one_per_non_healthy(self):
        checker = _checker()
        results = [
            HealthCheckResult("firestore", "degraded", 600.0, "slow", "2024-01-01T00:00:00+00:00"),
            HealthCheckResult("auth", "healthy", 100.0, "ok", "2024-01-01T00:00:00+00:00"),
            HealthCheckResult("memory", "unhealthy", 5.0, "critical", "2024-01-01T00:00:00+00:00"),
        ]
        recs = checker._build_recommendations(results)
        # 2 non-healthy components → at least 2 recommendations
        assert len(recs) >= 2

    # ── Property 6 edge cases ──────────────────────────────────────────────

    def test_sanitize_removes_traceback(self):
        msg = "Traceback (most recent call last):\n  File \"app.py\", line 42, in foo\nValueError: bad"
        sanitized = _sanitize_message(msg)
        for marker in _STACK_TRACE_MARKERS:
            assert marker not in sanitized, f"Marker {marker!r} found in: {sanitized!r}"

    def test_sanitize_preserves_plain_message(self):
        msg = "Connection refused"
        sanitized = _sanitize_message(msg)
        assert "Connection refused" in sanitized

    def test_sanitize_empty_string_returns_fallback(self):
        sanitized = _sanitize_message("")
        assert sanitized  # non-empty fallback

    def test_classify_exception_message_has_no_stack_markers(self):
        # Simulate an exception whose str() contains stack-trace fragments
        exc = RuntimeError(
            'Traceback (most recent call last):\n  File "x.py", line 1, in f\n  raise ValueError("oops")'
        )
        result = _classify("firestore", 0.0, exception=exc)
        for marker in _STACK_TRACE_MARKERS:
            assert marker not in result.message, (
                f"Marker {marker!r} found in sanitized message: {result.message!r}"
            )
