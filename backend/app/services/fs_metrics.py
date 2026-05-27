"""Per-request Firestore read/write counters (Wave O)."""
from __future__ import annotations

import contextvars

_fs_reads: contextvars.ContextVar[int] = contextvars.ContextVar("fs_reads", default=0)
_fs_writes: contextvars.ContextVar[int] = contextvars.ContextVar("fs_writes", default=0)


def reset() -> None:
    _fs_reads.set(0)
    _fs_writes.set(0)


def increment_reads(n: int = 1) -> None:
    _fs_reads.set(_fs_reads.get() + n)


def increment_writes(n: int = 1) -> None:
    _fs_writes.set(_fs_writes.get() + n)


def get_metrics() -> dict[str, int]:
    return {"reads": _fs_reads.get(), "writes": _fs_writes.get()}
