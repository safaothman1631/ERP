"""AST-based linter for sync Firestore calls inside async routes (P4 / R5.4).

Scans Python files (default: ``backend/app/api``) for any ``async def`` that
calls a known-sync Firestore method without ``await``. The presence of a
sync ``.get()`` / ``.stream()`` / ``.set()`` / ``.delete()`` on the event
loop is a latency bomb under load — these calls must be awaited (when using
the async client) or wrapped with ``starlette.concurrency.run_in_threadpool``.

Heuristic
---------
Within an ``async def`` body we walk every ``ast.Call``. We flag the call
when its top-level ``func`` looks like a Firestore chain ending in one of
:data:`SYNC_FIRESTORE_METHODS` AND the call is NOT the operand of an
``await``. We further require the chain to include one of
:data:`FIRESTORE_ROOTS` (``collection``, ``document``, ``where``,
``order_by``, ``limit``) so we don't false-positive on, e.g.,
``response.get("x")``.

``async for X in ...stream()`` is recognised as the async iterator pattern
and is NOT flagged.

CLI
---
::

    python -m tools.lint.async_safety               # report only
    python -m tools.lint.async_safety --check       # exit non-zero on findings
    python -m tools.lint.async_safety path/to/dir   # custom root
"""
from __future__ import annotations

import argparse
import ast
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, Sequence


# Sync Firestore methods that block when called without ``await`` on the
# async client (and always block on the sync client).
SYNC_FIRESTORE_METHODS: frozenset = frozenset(
    {"get", "stream", "set", "update", "delete", "add", "create"}
)

# Markers used to recognise we're looking at a Firestore chain.
FIRESTORE_ROOTS: frozenset = frozenset(
    {"collection", "document", "where", "order_by", "limit"}
)


@dataclass(frozen=True)
class Finding:
    """One linter finding."""

    path: str
    line: int
    col: int
    message: str

    def format_gnu(self) -> str:
        """Format as ``file:line:col: warning: msg`` (GNU-style)."""
        return f"{self.path}:{self.line}:{self.col}: warning: {self.message}"


def _chain_includes_firestore_root(node):
    """True if any node in the attribute chain is one of FIRESTORE_ROOTS."""
    cur = node
    while True:
        if isinstance(cur, ast.Call):
            cur = cur.func
            continue
        if isinstance(cur, ast.Attribute):
            if cur.attr in FIRESTORE_ROOTS:
                return True
            cur = cur.value
            continue
        return False


class _AsyncFunctionVisitor(ast.NodeVisitor):
    """Walks the body of async functions looking for un-awaited sync Firestore calls."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.findings = []

    def visit_AsyncFunctionDef(self, node):  # noqa: N802
        for child in node.body:
            self._scan(child, inside_async=True)
        self.generic_visit(node)

    def visit_FunctionDef(self, node):  # noqa: N802
        return

    def _scan(self, tree, inside_async: bool) -> None:
        awaited_call_ids = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Await) and isinstance(node.value, ast.Call):
                awaited_call_ids.add(id(node.value))
            # ``async for X in <call>`` is the canonical async-iterator pattern
            # for Firestore's async client (e.g. `.stream()`, `.collections()`).
            if isinstance(node, ast.AsyncFor) and isinstance(node.iter, ast.Call):
                awaited_call_ids.add(id(node.iter))

        for parent in ast.walk(tree):
            if not isinstance(parent, ast.Call):
                continue
            func = parent.func
            if not isinstance(func, ast.Attribute):
                continue
            if func.attr not in SYNC_FIRESTORE_METHODS:
                continue
            if not _chain_includes_firestore_root(func.value):
                continue
            if id(parent) in awaited_call_ids:
                continue
            self.findings.append(
                Finding(
                    path=self.path,
                    line=parent.lineno,
                    col=parent.col_offset,
                    message=(
                        "sync Firestore call `." + func.attr + "(...)` inside async def "
                        "wrap with `await run_in_threadpool(...)` or use the async client"
                    ),
                )
            )


def lint_source(source: str, path: str = "<string>"):
    """Lint a single source string. Returns findings in source order."""
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        return [Finding(path=path, line=e.lineno or 0, col=e.offset or 0,
                        message="syntax error: " + str(e.msg))]
    visitor = _AsyncFunctionVisitor(path)
    visitor.visit(tree)
    return visitor.findings


def lint_file(path: Path):
    """Lint a file path; returns findings."""
    try:
        source = path.read_text(encoding="utf-8")
    except OSError as e:
        return [Finding(path=str(path), line=0, col=0,
                        message="could not read file: " + str(e))]
    return lint_source(source, path=str(path))


def iter_python_files(root: Path):
    """Yield .py files under ``root`` (excluding venv and __pycache__)."""
    skip = {"venv", ".venv", "__pycache__", "node_modules", ".git"}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip]
        for fn in filenames:
            if fn.endswith(".py"):
                yield Path(dirpath) / fn


def lint_paths(paths):
    """Lint each path (file or directory). Returns merged findings."""
    out = []
    for p in paths:
        if p.is_dir():
            for f in iter_python_files(p):
                out.extend(lint_file(f))
        elif p.is_file():
            out.extend(lint_file(p))
    return out


def _default_root() -> Path:
    """Default scan target: ``<repo>/backend/app/api``."""
    here = Path(__file__).resolve()
    return here.parents[2] / "backend" / "app" / "api"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="async_safety",
        description="Flag sync Firestore calls inside async def functions.",
    )
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="Files or dirs to scan (default: backend/app/api).",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero when any finding is reported (CI mode).",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    targets = args.paths or [_default_root()]
    findings = lint_paths(targets)

    for f in findings:
        print(f.format_gnu())

    if findings:
        print("\n" + str(len(findings)) + " finding(s) across " + str(len(targets)) + " target(s).",
              file=sys.stderr)
    else:
        print("async_safety: no findings.", file=sys.stderr)

    if args.check and findings:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
