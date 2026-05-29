"""@cached decorator for FastAPI async route handlers (P4 / R5.1).

Wraps a route handler so its response is read from / written to the Redis
cache facade in :mod:`app.services.cache`. Honors ``Cache-Control: no-cache``
on the incoming request to allow forced bypass.

Example
-------
::

    from app.services.cache_decorators import cached

    @router.get("/invoices/{invoice_id}")
    @cached(resource="invoices", ttl_s=60, schema_version=2)
    async def get_invoice(invoice_id: str, request: Request):
        ...

Tenant resolution
-----------------
The decorator pulls ``request.state.tenant_id`` (set by the tenant
middleware in :mod:`app.middleware.tenant`). When the tenant is missing
(e.g. on an allowlisted route), the cache is bypassed entirely — caching
unscoped data would be a multi-tenancy hazard.
"""
from __future__ import annotations

import functools
import inspect
import logging
from typing import Any, Awaitable, Callable, Mapping, Optional

from starlette.requests import Request

from app.services.cache import get_cache

log = logging.getLogger("services.cache_decorators")

# Type alias for the kind of handler we wrap.
Handler = Callable[..., Awaitable[Any]]


def _extract_request(args: tuple, kwargs: dict) -> Optional[Request]:
    """Find the ``Request`` argument in a handler call, if present."""
    for a in args:
        if isinstance(a, Request):
            return a
    for v in kwargs.values():
        if isinstance(v, Request):
            return v
    return None


def _no_cache_header_set(request: Request) -> bool:
    """True if the request asked us to bypass cache."""
    cc = request.headers.get("cache-control", "").lower()
    return "no-cache" in cc or "no-store" in cc


def _default_key_params(kwargs: dict) -> dict:
    """Drop dependency-injected objects from kwargs to keep the hash stable."""
    skipped = (Request,)
    out: dict[str, Any] = {}
    for k, v in kwargs.items():
        if isinstance(v, skipped):
            continue
        # Functions, classes, complex SDK objects: skip — they aren't useful in a key.
        if callable(v) and not isinstance(v, (str, bytes, int, float, bool)):
            continue
        # Pydantic models / dicts / primitives are fine.
        try:
            # Round-trip through repr to coerce unhashable types into stable strings.
            out[k] = v.model_dump() if hasattr(v, "model_dump") else v
        except Exception:  # noqa: BLE001
            out[k] = repr(v)
    return out


def cached(
    resource: str,
    ttl_s: int,
    *,
    schema_version: int = 1,
    key_fn: Optional[Callable[[Mapping[str, Any]], Mapping[str, Any]]] = None,
) -> Callable[[Handler], Handler]:
    """Decorator factory.

    Args:
        resource: Logical resource name used in the cache key (e.g. ``"invoices"``).
        ttl_s: Time-to-live for newly written entries, in seconds.
        schema_version: Bump this constant to invalidate every key for the
            resource without scanning Redis.
        key_fn: Optional callable receiving the handler kwargs (minus injected
            objects) and returning a mapping that becomes the params hash
            input. Use it to scope keys by a subset of fields.

    Returns:
        A decorator that wraps an async handler.
    """
    if ttl_s <= 0:
        raise ValueError("ttl_s must be > 0")

    def decorator(handler: Handler) -> Handler:
        if not inspect.iscoroutinefunction(handler):
            raise TypeError(
                f"@cached only wraps async functions; {handler.__name__} is sync"
            )

        @functools.wraps(handler)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            request = _extract_request(args, kwargs)
            tenant_id: Optional[str] = None
            bypass = False

            if request is not None:
                tenant_id = getattr(request.state, "tenant_id", None)
                bypass = _no_cache_header_set(request)

            # If we can't scope to a tenant, don't cache. Same for explicit bypass.
            if not tenant_id or bypass:
                log.debug(
                    "cache.bypass",
                    extra={
                        "resource": resource,
                        "reason": "no_tenant" if not tenant_id else "no_cache_header",
                    },
                )
                return await handler(*args, **kwargs)

            # Build the params hash input.
            base_params = _default_key_params(kwargs)
            params = key_fn(base_params) if key_fn else base_params

            cache = get_cache()
            key = cache.make_key(
                tenant_id, resource, params, schema_version=schema_version
            )

            cached_value = await cache.get(key)
            if cached_value is not None:
                log.info(
                    "cache.hit",
                    extra={
                        "resource": resource,
                        "tenant_id": tenant_id,
                        "key": key,
                    },
                )
                return cached_value

            log.info(
                "cache.miss",
                extra={
                    "resource": resource,
                    "tenant_id": tenant_id,
                    "key": key,
                },
            )
            value = await handler(*args, **kwargs)
            if value is not None:
                await cache.set(key, value, ttl_s)
            return value

        # Preserve the original signature for FastAPI's dependency injection.
        wrapper.__signature__ = inspect.signature(handler)  # type: ignore[attr-defined]
        return wrapper

    return decorator


__all__ = ["cached"]
