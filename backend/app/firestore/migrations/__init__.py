"""Schema migration registry.

Each registered migration is a function `migrate(doc: dict) -> dict` that
upgrades a document from `from_version` (= index) to `from_version + 1`.

Migrations MUST be idempotent and side-effect free except on the returned dict.

Usage:
    register("invoices", 2, _v1_to_v2)
    register("invoices", 3, _v2_to_v3)

Then `BaseRepository.SCHEMA_TARGET_VERSION = 3` triggers lazy upgrade on read.
"""
from __future__ import annotations

from typing import Callable

MigrationFn = Callable[[dict], dict]

_REGISTRY: dict[str, dict[int, MigrationFn]] = {}


def register(collection: str, target_version: int, fn: MigrationFn) -> None:
    """Register migration that produces `target_version` from `target_version-1`."""
    _REGISTRY.setdefault(collection, {})[int(target_version)] = fn


def run_migrations(collection: str, doc: dict, current: int, target: int) -> dict:
    """Apply migrations sequentially from `current+1` up to `target`."""
    migrations = _REGISTRY.get(collection) or {}
    out = dict(doc)
    for v in range(int(current) + 1, int(target) + 1):
        fn = migrations.get(v)
        if fn is None:
            continue
        out = fn(out) or out
    out["schema_version"] = target
    return out


def registered_collections() -> list[str]:
    return sorted(_REGISTRY.keys())


def list_migrations(collection: str) -> list[int]:
    return sorted((_REGISTRY.get(collection) or {}).keys())


def reset() -> None:
    """Test-only helper."""
    _REGISTRY.clear()


def run_pending(*, dry_run: bool = True) -> dict:
    """Startup health check: report collections with registered migrations."""
    summary: dict[str, list[int]] = {}
    for coll in registered_collections():
        summary[coll] = list_migrations(coll)
    return {"dry_run": dry_run, "collections": summary}


from . import registry as _registry  # noqa: E402,F401
