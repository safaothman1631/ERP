"""Tests for app.services.cache (P4 / R5.1).

Uses ``fakeredis.aioredis.FakeRedis`` as an in-memory async Redis backend so
the suite runs without any external service.

Run::

    pytest tests/test_cache.py -q
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

import pytest

# fakeredis is a dev dep — skip these tests gracefully if absent on a slim env.
fakeredis = pytest.importorskip("fakeredis.aioredis")

from app.services.cache import Cache, get_cache, reset_cache, set_cache  # noqa: E402


@pytest.fixture
async def cache() -> Cache:
    """Cache backed by an isolated fakeredis instance."""
    client = fakeredis.FakeRedis(decode_responses=False)
    c = Cache(client, namespace="test")
    yield c
    try:
        await client.flushall()
        await client.aclose()
    except Exception:
        pass


# ── make_key ─────────────────────────────────────────────────────────────────

class TestMakeKey:
    def test_includes_namespace_tenant_resource_version(self, cache: Cache) -> None:
        key = cache.make_key("t-1", "invoices", {"id": "abc"}, schema_version=3)
        assert key.startswith("test:t-1:invoices:")
        assert key.endswith(":v3")

    def test_stable_across_dict_ordering(self, cache: Cache) -> None:
        k1 = cache.make_key("t", "r", {"a": 1, "b": 2})
        k2 = cache.make_key("t", "r", {"b": 2, "a": 1})
        assert k1 == k2

    def test_different_params_produce_different_keys(self, cache: Cache) -> None:
        k1 = cache.make_key("t", "r", {"id": "1"})
        k2 = cache.make_key("t", "r", {"id": "2"})
        assert k1 != k2

    def test_empty_params_uses_placeholder(self, cache: Cache) -> None:
        key = cache.make_key("t", "r", None)
        assert ":_:" in key

    def test_requires_tenant_id(self, cache: Cache) -> None:
        with pytest.raises(ValueError):
            cache.make_key("", "r")

    def test_requires_resource(self, cache: Cache) -> None:
        with pytest.raises(ValueError):
            cache.make_key("t", "")


# ── get / set round-trip ─────────────────────────────────────────────────────

class TestGetSet:
    async def test_set_then_get_returns_value(self, cache: Cache) -> None:
        await cache.set("k1", {"hello": "world"}, ttl_s=60)
        assert await cache.get("k1") == {"hello": "world"}

    async def test_missing_key_returns_none(self, cache: Cache) -> None:
        assert await cache.get("does-not-exist") is None

    async def test_datetime_serialised_via_default_str(self, cache: Cache) -> None:
        ts = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
        await cache.set("k", {"ts": ts}, ttl_s=60)
        got = await cache.get("k")
        # Datetimes survive only as their str() form — that's the documented
        # contract of ``default=str`` serialisation.
        assert got == {"ts": str(ts)}

    async def test_ttl_is_applied(self, cache: Cache) -> None:
        await cache.set("k", "v", ttl_s=10)
        ttl = await cache.client.ttl("k")
        assert 0 < ttl <= 10

    async def test_delete_removes_key(self, cache: Cache) -> None:
        await cache.set("k", "v", ttl_s=60)
        assert await cache.delete("k") == 1
        assert await cache.get("k") is None

    async def test_set_handles_unserialisable_gracefully(self, cache: Cache) -> None:
        class Foo:
            pass

        # default=str makes most objects serialisable, but circular refs blow up
        circular: dict = {}
        circular["self"] = circular
        ok = await cache.set("k", circular, ttl_s=60)
        assert ok is False


# ── get_or_set ──────────────────────────────────────────────────────────────

class TestGetOrSet:
    async def test_miss_invokes_fetch_and_caches(self, cache: Cache) -> None:
        calls = 0

        async def fetch() -> dict[str, int]:
            nonlocal calls
            calls += 1
            return {"n": 42}

        v1 = await cache.get_or_set("k", 60, fetch)
        v2 = await cache.get_or_set("k", 60, fetch)
        assert v1 == v2 == {"n": 42}
        assert calls == 1  # second call served from cache

    async def test_does_not_cache_none(self, cache: Cache) -> None:
        async def fetch() -> Any:
            return None

        v = await cache.get_or_set("k", 60, fetch)
        assert v is None
        # Nothing should have been written.
        assert await cache.client.get("k") is None


# ── invalidate (SCAN-based) ─────────────────────────────────────────────────

class TestInvalidate:
    async def test_pattern_matches_and_removes(self, cache: Cache) -> None:
        await cache.set("test:t-1:invoices:abc:v1", "a", 60)
        await cache.set("test:t-1:invoices:def:v1", "b", 60)
        await cache.set("test:t-1:bills:xyz:v1", "c", 60)
        removed = await cache.invalidate("test:t-1:invoices:*")
        assert removed == 2
        assert await cache.get("test:t-1:bills:xyz:v1") == "c"

    async def test_empty_pattern_rejected(self, cache: Cache) -> None:
        with pytest.raises(ValueError):
            await cache.invalidate("")

    async def test_invalidate_resource_helper(self, cache: Cache) -> None:
        k = cache.make_key("t-1", "invoices", {"id": "1"})
        await cache.set(k, "v", 60)
        removed = await cache.invalidate_resource("t-1", "invoices")
        assert removed == 1
        assert await cache.get(k) is None

    async def test_does_not_call_keys(self, cache: Cache, monkeypatch) -> None:
        # If anyone uses KEYS we want a noisy failure in CI.
        async def boom(*_a, **_kw):
            raise AssertionError("KEYS must not be used; use SCAN")

        monkeypatch.setattr(cache.client, "keys", boom, raising=False)
        await cache.set("test:x:y:z:v1", "v", 60)
        await cache.invalidate("test:x:*")  # would explode if KEYS was used


# ── Singleton helpers ───────────────────────────────────────────────────────

class TestSingleton:
    def test_set_and_reset_singleton(self) -> None:
        reset_cache()
        client = fakeredis.FakeRedis()
        c = Cache(client, namespace="ns")
        set_cache(c)
        assert get_cache() is c
        reset_cache()

    async def test_ping_returns_true_on_healthy_redis(self, cache: Cache) -> None:
        assert await cache.ping() is True
