"""Idempotency replay for critical mutating API paths (Wave I)."""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Optional

from fastapi import Request, Response
from fastapi.responses import JSONResponse

from app.config import settings
from app.middleware.audit import _decode_user
from app.services.idempotency import IdempotencyService

logger = logging.getLogger(__name__)

# Only honor Idempotency-Key on these prefixes (avoids breaking uploads/exports)
_IDEMPOTENCY_PREFIXES = (
    "/api/pos/",
    "/api/invoices",
    "/api/journals",
    "/api/expenses",
    "/api/purchase_orders",
    "/api/inventory/transfers",
    "/api/payroll/runs",
    "/api/banking/",
    "/api/chatter",
)


def _path_eligible(path: str) -> bool:
    return any(path.startswith(p) for p in _IDEMPOTENCY_PREFIXES)


def _resolve_org_id(request: Request) -> str:
    org = getattr(request.state, "org_id", None)
    if org:
        return org
    user = _decode_user(request)
    if user and user.get("org_id"):
        return user["org_id"]
    return "anonymous"


async def _read_body(request: Request) -> bytes:
    body = await request.body()

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    request._receive = receive  # type: ignore[attr-defined]
    return body


async def idempotency_middleware(request: Request, call_next):
    if not getattr(settings, "IDEMPOTENCY_ENABLED", True):
        return await call_next(request)

    key = request.headers.get("Idempotency-Key") or request.headers.get("idempotency-key")
    if not key or request.method.upper() not in {"POST", "PUT", "PATCH", "DELETE"}:
        return await call_next(request)

    path = request.url.path
    if not _path_eligible(path):
        return await call_next(request)

    body = await _read_body(request)
    body_hash = hashlib.sha256(body).hexdigest()
    org_id = _resolve_org_id(request)
    scope = f"{request.method}:{path}"

    svc = IdempotencyService(org_id)
    existing = svc.get(scope, key)
    if existing:
        if existing.get("body_hash") and existing["body_hash"] != body_hash:
            return JSONResponse(
                status_code=409,
                content={"code": "idempotency_conflict", "message": "Key reused with different body"},
            )
        cached = existing.get("response") or {}
        if existing.get("status") == "completed" and cached:
            return JSONResponse(
                status_code=int(cached.get("status_code", 200)),
                content=cached.get("body"),
            )

    svc.create_key(scope, key, body_hash=body_hash)
    response: Response = await call_next(request)

    content_type = (response.headers.get("content-type") or "").lower()
    if response.status_code >= 500 or response.status_code == 204:
        return response
    if "application/json" not in content_type:
        return response

    try:
        resp_body = b""
        if hasattr(response, "body_iterator"):
            chunks = [chunk async for chunk in response.body_iterator]
            resp_body = b"".join(chunks)
        payload = json.loads(resp_body) if resp_body else {}
    except Exception:
        logger.debug("idempotency_skip_non_json", extra={"path": path})
        return response

    if response.status_code < 500:
        svc.complete(
            scope,
            key,
            {
                "status_code": response.status_code,
                "body": payload,
            },
        )
    return JSONResponse(status_code=response.status_code, content=payload)
