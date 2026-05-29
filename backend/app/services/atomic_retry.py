"""Transaction retry metrics for atomic services (Wave O5)."""
from __future__ import annotations

import functools
import logging
from typing import Callable, TypeVar

logger = logging.getLogger(__name__)
F = TypeVar("F", bound=Callable)

_RETRY_COUNT: dict[str, int] = {}


def track_atomic_retries(name: str) -> Callable[[F], F]:
    def decorator(fn: F) -> F:
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            attempts = 0
            while True:
                attempts += 1
                try:
                    return fn(*args, **kwargs)
                except Exception as exc:
                    msg = str(exc).lower()
                    if attempts < 5 and ("aborted" in msg or "contention" in msg):
                        _RETRY_COUNT[name] = _RETRY_COUNT.get(name, 0) + 1
                        logger.warning("atomic_retry", extra={"name": name, "attempt": attempts})
                        continue
                    raise

        return wrapper  # type: ignore[return-value]

    return decorator


def get_retry_stats() -> dict[str, int]:
    return dict(_RETRY_COUNT)
