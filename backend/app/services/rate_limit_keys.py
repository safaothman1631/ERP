"""Per-tenant rate limit key functions (Wave Q)."""
from __future__ import annotations

from fastapi import Request


def per_org_key(request: Request) -> str:
    org = getattr(request.state, "org_id", None)
    if org:
        return f"org:{org}:{request.url.path}"
    if request.client:
        return f"ip:{request.client.host}:{request.url.path}"
    return f"ip:unknown:{request.url.path}"


def per_org_action(action: str):
    def _key(request: Request) -> str:
        org = getattr(request.state, "org_id", None) or "anon"
        return f"org:{org}:{action}"
    return _key
