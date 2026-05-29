"""Decode org_id from JWT early for rate-limit / idempotency middleware."""
from __future__ import annotations

from fastapi import Request

from app.middleware.audit import _decode_user


async def org_context_middleware(request: Request, call_next):
    user = _decode_user(request)
    if user and user.get("org_id"):
        request.state.org_id = user["org_id"]
        request.state.user = user
    return await call_next(request)
