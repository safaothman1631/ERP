"""Performance utilities - Phase 12

Builds on top of app.cache.AppCache to provide:
- @cached_static(prefix, ttl_static=True) decorator for hot-read functions
  (org settings, COA, tax rates, currencies)
- paginate(items, cursor, limit) for cursor-based pagination across in-memory
  Firestore-filtered lists
- batch_get(repo, ids) helper to deduplicate parallel reads
- N+1 detector context-manager for tests
"""
from functools import wraps
from typing import Callable, Optional
import base64
import json
import threading

from ..cache import cache


# ============================================================================
# Caching decorator
# ============================================================================

def cache_key(*parts) -> str:
    """Stable cache key joiner. None becomes empty."""
    return "|".join(str(p) if p is not None else "" for p in parts)


def cached_static(prefix: str):
    """Cache function result in long-TTL (1h) static cache.

    Function args (excluding self) are joined into the cache key.
    Use for: chart of accounts, tax rates, currencies, org settings.
    """
    def decorator(fn: Callable):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # Drop `self` if first arg looks like an instance
            key_args = args
            if args and hasattr(args[0], "__class__") and not isinstance(args[0], (str, int, float)):
                key_args = args[1:]
            key = cache_key(prefix, *key_args, *sorted(kwargs.items()))
            hit = cache.get_static(key)
            if hit is not None:
                return hit
            result = fn(*args, **kwargs)
            if result is not None:
                cache.set_static(key, result)
            return result
        wrapper._cache_prefix = prefix
        return wrapper
    return decorator


def invalidate_static(prefix: str):
    """Invalidate all static cache keys starting with prefix."""
    with cache._lock:
        keys = [k for k in list(cache._static_cache.keys()) if k.startswith(prefix)]
        for k in keys:
            del cache._static_cache[k]
    return len(keys)


# ============================================================================
# Cursor-based pagination
# ============================================================================

def encode_cursor(offset: int) -> str:
    raw = json.dumps({"o": offset}).encode()
    return base64.urlsafe_b64encode(raw).decode()


def decode_cursor(cursor: Optional[str]) -> int:
    if not cursor:
        return 0
    try:
        raw = base64.urlsafe_b64decode(cursor.encode())
        data = json.loads(raw)
        v = int(data.get("o", 0))
        return max(v, 0)
    except Exception:
        return 0


def paginate(items: list, cursor: Optional[str] = None, limit: int = 50) -> dict:
    """Slice an in-memory list using opaque cursor.

    Returns: {items, next_cursor, has_more, total}
    """
    if limit <= 0:
        limit = 50
    if limit > 500:
        limit = 500
    offset = decode_cursor(cursor)
    total = len(items)
    page = items[offset: offset + limit]
    new_offset = offset + len(page)
    has_more = new_offset < total
    return {
        "items": page,
        "next_cursor": encode_cursor(new_offset) if has_more else None,
        "has_more": has_more,
        "total": total,
    }


# ============================================================================
# Batch-get with in-flight dedup
# ============================================================================

class BatchLoader:
    """Coalesce parallel get_by_id calls within one request scope.

    Usage:
        loader = BatchLoader(item_repo.get_by_id)
        items = [loader.get(i) for i in ids]   # only one call per unique id
    """

    def __init__(self, fetch_fn: Callable):
        self._fetch = fetch_fn
        self._cache: dict = {}
        self._lock = threading.Lock()

    def get(self, key):
        with self._lock:
            if key in self._cache:
                return self._cache[key]
        v = self._fetch(key)
        with self._lock:
            self._cache[key] = v
        return v

    def get_many(self, keys):
        return [self.get(k) for k in keys]

    def stats(self) -> dict:
        return {"unique_keys": len(self._cache)}


# ============================================================================
# N+1 detector (test-time only)
# ============================================================================

class QueryCounter:
    """Wrap a callable to count invocations. Use in tests."""

    def __init__(self, fn: Callable, threshold: int = 10):
        self._fn = fn
        self._count = 0
        self._lock = threading.Lock()
        self.threshold = threshold

    def __call__(self, *args, **kwargs):
        with self._lock:
            self._count += 1
        return self._fn(*args, **kwargs)

    @property
    def count(self) -> int:
        return self._count

    def assert_under(self, max_calls: int):
        if self._count > max_calls:
            raise AssertionError(
                f"N+1 detected: {self._count} calls (max allowed {max_calls})"
            )

    def reset(self):
        with self._lock:
            self._count = 0
