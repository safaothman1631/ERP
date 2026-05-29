"""Redis-backed cache facade (P4 / R5.1, design §3.2).

Provides an async ``Cache`` class with a ``get_or_set`` primitive and pattern
invalidation via SCAN (never KEYS — KEYS blocks the server on large keyspaces
and is forbidden in production).

Key convention
--------------
``{tenant_id}:{resource}:{params_hash}:{schema_version}``

Bumping a resource's ``schema_version`` constant invalidates every key for
that resource without scanning Redis — a structural cache-bust.

Usage
-----
::

    from app.services.cache import get_cache

    cache = get_cache()
    data = await cache.get_or_set(
        key=cache.make_key("tenant-1", "invoices", {"id": "abc"}, schema_version=1),
        ttl_s=60,
        fetch=lambda: load_invoice_async("abc"),
    )

The facade is process-global through ``get_cache()``. In dev/test, point
``REDIS_URL`` at fakeredis (`redis://localhost`) or pass a custom client.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
from typing import Any, Awaitable, Callable, Mapping, Optional, TypeVar

log = logging.getLogger("services.cache")

T = TypeVar("T")

# Sentinel returned by .get() when no value is present.
_MISS = object()


class CacheError(RuntimeError):
    """Raised on cache backend failures we *want* to surface (not swallow)."""


class Cache:
    """Async Redis cache facade.

    All public methods are coroutines. The client is held as an attribute so
    callers can swap it in tests (e.g. ``fakeredis.aioredis.FakeRedis``).
    """

    # JSON serialisation defaults — datetimes serialise via ``default=str``.
    _JSON_OPTS = {"default": str, "separators": (",", ":")}

    def __init__(self, client: Any, *, namespace: str = "zoho") -> None:
        """Args:
            client: A ``redis.asyncio.Redis`` (or compatible) instance.
            namespace: Optional prefix prepended to every key (e.g. ``zoho``).
                Useful to share a Redis instance across environments.
        """
        self.client = client
        self.namespace = namespace.rstrip(":")

    # ── Key helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _hash_params(params: Optional[Mapping[str, Any]]) -> str:
        """Stable, short hash of the params dict for cache keys."""
        if not params:
            return "_"
        # ``sort_keys`` is required for stability across runs and Python versions.
        encoded = json.dumps(params, sort_keys=True, default=str).encode("utf-8")
        return hashlib.sha1(encoded).hexdigest()[:16]

    def make_key(
        self,
        tenant_id: str,
        resource: str,
        params: Optional[Mapping[str, Any]] = None,
        *,
        schema_version: int = 1,
    ) -> str:
        """Build a key following the documented convention.

        Layout::

            {namespace}:{tenant_id}:{resource}:{params_hash}:v{schema_version}
        """
        if not tenant_id:
            raise ValueError("tenant_id is required for cache keys")
        if not resource:
            raise ValueError("resource is required for cache keys")
        params_hash = self._hash_params(params)
        return f"{self.namespace}:{tenant_id}:{resource}:{params_hash}:v{schema_version}"

    # ── Core ops ──────────────────────────────────────────────────────────

    async def get(self, key: str) -> Any:
        """Return the cached value or ``None`` if missing.

        Note: a stored ``None`` is indistinguishable from a miss. Callers that
        need to cache ``None`` should wrap it (e.g. ``{"value": None}``).
        """
        try:
            raw = await self.client.get(key)
        except Exception as e:  # noqa: BLE001
            log.warning("cache.get_failed", extra={"key": key, "err": str(e)})
            return None
        if raw is None:
            return None
        try:
            if isinstance(raw, (bytes, bytearray)):
                raw = raw.decode("utf-8")
            return json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            log.warning("cache.decode_failed", extra={"key": key, "err": str(e)})
            return None

    async def set(self, key: str, value: Any, ttl_s: int) -> bool:
        """Store ``value`` under ``key`` with TTL ``ttl_s`` seconds."""
        try:
            payload = json.dumps(value, **self._JSON_OPTS)
        except (TypeError, ValueError) as e:
            log.warning("cache.encode_failed", extra={"key": key, "err": str(e)})
            return False
        try:
            await self.client.set(key, payload, ex=int(ttl_s))
            return True
        except Exception as e:  # noqa: BLE001
            log.warning("cache.set_failed", extra={"key": key, "err": str(e)})
            return False

    async def delete(self, key: str) -> int:
        """Delete a single key. Returns 1 if removed, 0 if missing."""
        try:
            return int(await self.client.delete(key))
        except Exception as e:  # noqa: BLE001
            log.warning("cache.delete_failed", extra={"key": key, "err": str(e)})
            return 0

    async def get_or_set(
        self,
        key: str,
        ttl_s: int,
        fetch: Callable[[], Awaitable[T]],
    ) -> T:
        """Return the cached value or compute, cache, and return a fresh one.

        Args:
            key: Cache key (build with :meth:`make_key`).
            ttl_s: Time-to-live in seconds for newly stored values.
            fetch: Async callable producing the value on cache miss.

        Returns:
            Either the deserialised cached value or the freshly computed one.
        """
        cached = await self.get(key)
        if cached is not None:
            log.debug("cache.hit", extra={"key": key})
            return cached  # type: ignore[return-value]
        log.debug("cache.miss", extra={"key": key})
        value = await fetch()
        # Never cache None — see ``get`` docstring.
        if value is not None:
            await self.set(key, value, ttl_s)
        return value

    # ── Invalidation via SCAN (never KEYS) ────────────────────────────────

    async def invalidate(self, pattern: str, *, batch: int = 500) -> int:
        """Delete every key matching ``pattern`` using SCAN+DEL.

        SCAN is used (NOT KEYS) so Redis stays responsive even if the matched
        set is large. Returns the count of keys removed.
        """
        if not pattern:
            raise ValueError("pattern must be non-empty")
        cursor = 0
        removed = 0
        while True:
            try:
                cursor, keys = await self.client.scan(
                    cursor=cursor, match=pattern, count=batch
                )
            except Exception as e:  # noqa: BLE001
                log.warning(
                    "cache.scan_failed",
                    extra={"pattern": pattern, "err": str(e)},
                )
                break
            if keys:
                try:
                    removed += int(await self.client.delete(*keys))
                except Exception as e:  # noqa: BLE001
                    log.warning(
                        "cache.bulk_delete_failed",
                        extra={"pattern": pattern, "err": str(e)},
                    )
            # cursor == 0 (or "0") signals SCAN completion.
            if not cursor or cursor == "0" or cursor == 0:
                break
        log.info(
            "cache.invalidate",
            extra={"pattern": pattern, "removed": removed},
        )
        return removed

    async def invalidate_resource(
        self, tenant_id: str, resource: str, *, schema_version: Optional[int] = None
    ) -> int:
        """Convenience: invalidate all keys for a (tenant, resource) [version]."""
        version_part = f"v{schema_version}" if schema_version is not None else "*"
        pattern = f"{self.namespace}:{tenant_id}:{resource}:*:{version_part}"
        return await self.invalidate(pattern)

    # ── Liveness ──────────────────────────────────────────────────────────

    async def ping(self) -> bool:
        """Return True if Redis responds to PING within 1 second."""
        try:
            return bool(await asyncio.wait_for(self.client.ping(), timeout=1.0))
        except Exception:  # noqa: BLE001
            return False


# ─── Singleton accessor ──────────────────────────────────────────────────────

_CACHE_SINGLETON: Optional[Cache] = None


def _build_redis_client() -> Any:
    """Create a redis.asyncio client from env, or a fakeredis client in tests."""
    redis_url = os.environ.get("REDIS_URL")
    try:
        import redis.asyncio as aioredis  # type: ignore
    except Exception as e:  # noqa: BLE001
        raise CacheError(
            "redis package not installed — cannot build Cache singleton"
        ) from e

    if redis_url:
        return aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=False,
            socket_connect_timeout=2.0,
            socket_timeout=2.0,
            health_check_interval=30,
        )
    # No REDIS_URL — fall back to localhost; in tests, callers should inject
    # a fakeredis client via ``set_cache``.
    return aioredis.from_url(
        "redis://localhost:6379/0",
        encoding="utf-8",
        decode_responses=False,
        socket_connect_timeout=1.0,
        socket_timeout=1.0,
    )


def get_cache() -> Cache:
    """Return the process-wide cache singleton, building it on first call."""
    global _CACHE_SINGLETON
    if _CACHE_SINGLETON is None:
        client = _build_redis_client()
        namespace = os.environ.get("CACHE_NAMESPACE", "zoho")
        _CACHE_SINGLETON = Cache(client, namespace=namespace)
        log.info("cache.singleton_initialized", extra={"namespace": namespace})
    return _CACHE_SINGLETON


def set_cache(cache: Cache) -> None:
    """Replace the singleton — intended for tests."""
    global _CACHE_SINGLETON
    _CACHE_SINGLETON = cache


def reset_cache() -> None:
    """Drop the singleton — intended for tests."""
    global _CACHE_SINGLETON
    _CACHE_SINGLETON = None


__all__ = [
    "Cache",
    "CacheError",
    "get_cache",
    "set_cache",
    "reset_cache",
]
