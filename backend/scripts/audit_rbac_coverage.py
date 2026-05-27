#!/usr/bin/env python3
"""Audit FastAPI routes for require_perm coverage on mutating endpoints."""
from __future__ import annotations

import argparse
import sys
from inspect import getclosurevars
from pathlib import Path
from typing import Iterable

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.routing import APIRoute  # noqa: E402

MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

PHASE2_PREFIXES = (
    "/api/banking",
    "/api/hr",
    "/api/payroll",
    "/api/manufacturing",
    "/api/projects",
    "/api/crm",
    "/api/reports",
    "/api/exports",
)

EXEMPT_EXACT = frozenset({"/", "/api/health", "/openapi.json", "/docs", "/redoc"})
EXEMPT_PREFIXES = (
    "/api/auth/",
    "/static/",
)


def _callable_is_require_perm(fn) -> bool:
    if not callable(fn):
        return False
    name = getattr(fn, "__name__", None)
    if name != "_dep":
        return False
    try:
        closure = getclosurevars(fn)
    except TypeError:
        return False
    return "code" in closure.nonlocals


def _dependant_has_require_perm(dependant) -> bool:
    if dependant is None:
        return False
    call = getattr(dependant, "call", None)
    if _callable_is_require_perm(call):
        return True
    for child in getattr(dependant, "dependencies", []) or []:
        if _dependant_has_require_perm(child):
            return True
    return False


def _route_has_require_perm(route: APIRoute) -> bool:
    for dep in getattr(route, "dependencies", []) or []:
        fn = getattr(dep, "dependency", None) or getattr(dep, "call", None)
        if _callable_is_require_perm(fn):
            return True
    return _dependant_has_require_perm(getattr(route, "dependant", None))


def _path_exempt(path: str) -> bool:
    if path in EXEMPT_EXACT:
        return True
    return any(path.startswith(prefix) for prefix in EXEMPT_PREFIXES)


def _in_scope(path: str, prefixes: Iterable[str]) -> bool:
    for prefix in prefixes:
        if path == prefix or path.startswith(prefix + "/"):
            return True
    return False


def audit_rbac_coverage(app, *, scope_prefixes: Iterable[str] | None = None) -> list[dict]:
    prefixes = tuple(scope_prefixes or PHASE2_PREFIXES)
    findings: list[dict] = []

    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        path = route.path
        if _path_exempt(path):
            continue
        if scope_prefixes is not None and not _in_scope(path, prefixes):
            continue

        methods = set(route.methods or set()) & MUTATING_METHODS
        if not methods:
            continue

        if not _route_has_require_perm(route):
            findings.append(
                {
                    "path": path,
                    "methods": sorted(methods),
                    "name": route.name,
                    "tags": list(route.tags or []),
                }
            )
    return findings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Audit RBAC coverage for mutating API routes")
    parser.add_argument(
        "--scope",
        choices=("phase2", "all"),
        default="phase2",
        help="phase2 = high-risk modules only; all = entire app",
    )
    args = parser.parse_args(argv)

    from app.main import app  # noqa: WPS433 — local import after sys.path setup

    scope_prefixes = None if args.scope == "all" else PHASE2_PREFIXES
    unprotected = audit_rbac_coverage(app, scope_prefixes=scope_prefixes)

    total_checked = sum(
        1
        for route in app.routes
        if isinstance(route, APIRoute)
        and not _path_exempt(route.path)
        and (scope_prefixes is None or _in_scope(route.path, scope_prefixes))
        and (set(route.methods or set()) & MUTATING_METHODS)
    )
    protected = total_checked - len(unprotected)

    print(f"RBAC audit scope: {args.scope}")
    print(f"Mutating routes checked: {total_checked}")
    print(f"Protected: {protected}")
    print(f"Unprotected: {len(unprotected)}")

    if unprotected:
        print("\nUnprotected routes:")
        for item in unprotected:
            methods = ",".join(item["methods"])
            print(f"  [{methods}] {item['path']} ({item['name']})")
        return 1

    print("\nAll mutating routes in scope are protected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
