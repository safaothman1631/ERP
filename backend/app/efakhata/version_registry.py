"""Schema version registry for Iraq e-Fakhata.

Supports backward-compat handling when MoF publishes v1.1 / v2.0. The
registry is intentionally tiny — a dict of version → metadata plus a
migration table.

Migration policy:

    1.0 → 1.1  pure additive (new optional elements) — no migration needed,
               just the version-string flip in the XML root attribute.
    1.0 → 2.0  breaking changes anticipated; ``migrate()`` raises until the
               migration function is implemented (R7.X).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, Optional


@dataclass(frozen=True)
class _VersionInfo:
    version: str
    introduced: str           # ISO date string (informational)
    status: str               # "current" | "supported" | "deprecated"
    namespace_uri: str
    notes: str = ""


_VERSIONS: Dict[str, _VersionInfo] = {
    "1.0": _VersionInfo(
        version="1.0",
        introduced="2026-01-01",
        status="current",
        namespace_uri="http://efakhata.mof.gov.iq/schema/v1",
        notes="Initial public draft — verify against MoF release (R7.X).",
    ),
}

current_version = "1.0"


def supported_versions() -> list[str]:
    """All versions the codebase can read/write."""
    return list(_VERSIONS.keys())


def is_supported(version: str) -> bool:
    return version in _VERSIONS


def info(version: str) -> _VersionInfo:
    if version not in _VERSIONS:
        raise KeyError(f"unknown e-Fakhata version: {version}")
    return _VERSIONS[version]


# ─────────────────────────────────────────────────────────────────────────────
# Migration helpers
# ─────────────────────────────────────────────────────────────────────────────

_MigrationFn = Callable[[bytes], bytes]
_MIGRATIONS: Dict[tuple[str, str], _MigrationFn] = {}


def register_migration(from_version: str, to_version: str, fn: _MigrationFn) -> None:
    """Register an XML→XML migration function."""
    _MIGRATIONS[(from_version, to_version)] = fn


def migrate(xml_bytes: bytes, *, from_version: str, to_version: str) -> bytes:
    """Apply a registered migration; raises NotImplementedError if none exists."""
    if from_version == to_version:
        return xml_bytes
    fn = _MIGRATIONS.get((from_version, to_version))
    if fn is None:
        raise NotImplementedError(
            f"no e-Fakhata migration registered: {from_version} → {to_version}"
        )
    return fn(xml_bytes)


def latest() -> str:
    """Return the highest supported version, lexicographically sorted on dot
    segments — naive but sufficient for the small set we control."""
    def _key(v: str) -> tuple[int, ...]:
        try:
            return tuple(int(x) for x in v.split("."))
        except ValueError:
            return (0,)

    return max(_VERSIONS, key=_key)
