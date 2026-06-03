"""Public API gateway (Pool 3.6 — third-party integrations).

A bounded, versioned, API-key-authenticated read-only surface for external
integrations, plus a small management router (normal user auth) to mint, list
and revoke keys.

Two routers are exported in ``ALL_ROUTERS``:

* ``public_router`` (prefix ``/api/public/v1``) — authenticated by the
  ``X-API-Key`` header via :class:`ApiKeyRepository`. Each key resolves its own
  ``org_id`` so every endpoint is implicitly org-scoped. A per-key in-process
  token-bucket limits traffic (``_RATE_LIMIT_PER_MIN`` req/min → HTTP 429 with a
  ``Retry-After`` header). Endpoints are read-only: catalog, contacts, items,
  invoices.

* ``keys_router`` (prefix ``/api/public/keys``) — authenticated by the normal
  ``get_current_user`` and gated by the ``api_keys.manage`` permission. Create
  (returns plaintext once), list (masked), and revoke keys.

Security: plaintext keys are never stored or logged; only a sha256 hash + a
short non-secret prefix live in Firestore.
"""
from __future__ import annotations

import secrets
import threading
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from pydantic import BaseModel, Field

from app.firestore.api_keys import (
    ApiKeyRepository,
    _hash_key,
    _KEY_PREFIX,
    _PREFIX_BODY_LEN,
)
from app.services.permissions import require_perm

# Permission code gating key management. NOT auto-registered here — the
# orchestrator must add it to ``permissions.ALL_PERMISSIONS`` (see return notes).
PERM_MANAGE_KEYS = "api_keys.manage"

# OpenAPI document served by the app (see app/main.py: openapi_url).
_OPENAPI_URL = "/api/openapi.json"

# ─────────────────────────────────────────────────────────────────────────────
# Per-key in-process token-bucket rate limiter
# ─────────────────────────────────────────────────────────────────────────────
_RATE_LIMIT_PER_MIN = 120
_RATE_WINDOW_SECONDS = 60.0

_buckets: dict[str, tuple[float, float]] = {}  # key_id -> (tokens, last_refill_ts)
_buckets_lock = threading.Lock()


def _rate_limit_check(key_id: str) -> tuple[bool, int]:
    """Token-bucket admission for ``key_id``.

    Returns ``(allowed, retry_after_seconds)``. Refills at
    ``_RATE_LIMIT_PER_MIN`` tokens per ``_RATE_WINDOW_SECONDS``; one token per
    request. When empty, ``retry_after`` is the whole seconds until the next
    token is available.
    """
    rate = _RATE_LIMIT_PER_MIN / _RATE_WINDOW_SECONDS  # tokens per second
    now = time.monotonic()
    with _buckets_lock:
        tokens, last = _buckets.get(key_id, (float(_RATE_LIMIT_PER_MIN), now))
        tokens = min(float(_RATE_LIMIT_PER_MIN), tokens + (now - last) * rate)
        if tokens >= 1.0:
            _buckets[key_id] = (tokens - 1.0, now)
            return True, 0
        _buckets[key_id] = (tokens, now)
        retry_after = max(1, int((1.0 - tokens) / rate) + 1)
        return False, retry_after


def _reset_rate_limits() -> None:
    """Clear all buckets (test helper)."""
    with _buckets_lock:
        _buckets.clear()


# ─────────────────────────────────────────────────────────────────────────────
# API-key auth dependency
# ─────────────────────────────────────────────────────────────────────────────
def api_key_auth(
    response: Response,
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
) -> dict:
    """Resolve and authenticate an API key from the ``X-API-Key`` header.

    Returns the (org-scoped) key record. Raises 401 when the header is missing,
    the key is unknown/inactive, and 429 when the per-key rate limit is hit.
    """
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required (X-API-Key header)",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    # Public callers don't present an org, so resolve the key across orgs by its
    # public prefix + constant-time hash compare, then trust the record's org_id.
    record = _resolve_key(x_api_key)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    allowed, retry_after = _rate_limit_check(record["id"])
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
            headers={"Retry-After": str(retry_after)},
        )
    return record


def _resolve_key(plaintext: str) -> Optional[dict]:
    """Resolve a plaintext key to its record across orgs.

    ``ApiKeyRepository.verify`` pins ``org_id`` (BaseRepository always scopes
    list), but a public caller doesn't present an org. We query the ``api_keys``
    collection directly by the public, non-secret ``key_prefix`` (narrow + cheap)
    and then constant-time compare the stored sha256 hash. The matched record's
    own ``org_id`` is trusted for downstream scoping.
    """
    if not plaintext or not plaintext.startswith(_KEY_PREFIX):
        return None
    body = plaintext[len(_KEY_PREFIX):]
    if len(body) < _PREFIX_BODY_LEN:
        return None
    key_prefix = f"{_KEY_PREFIX}{body[:_PREFIX_BODY_LEN]}"

    repo = ApiKeyRepository(org_id="__public__")
    try:
        from app.firebase_client import safe_query

        q = repo.collection.where("key_prefix", "==", key_prefix).limit(25)
        candidates = [{"id": d.id, **d.to_dict()} for d in safe_query(q)]
    except Exception:
        return None

    target_hash = _hash_key(plaintext)
    for rec in candidates:
        if not rec.get("is_active", False):
            continue
        if secrets.compare_digest(str(rec.get("key_hash", "")), target_hash):
            try:
                repo.collection.document(rec["id"]).update({"last_used_at": datetime.utcnow()})
            except Exception:
                pass
            return rec
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Public read-only router
# ─────────────────────────────────────────────────────────────────────────────
public_router = APIRouter(prefix="/api/public/v1", tags=["Public API"])

# Default page size for public list endpoints (kept modest for third parties).
_DEFAULT_LIMIT = 25
_MAX_LIMIT = 100


def _page(repo, *, order_by: str, limit: int, cursor: Optional[str]):
    """Cursor-paginated list via the repo's indexed ``list_page``."""
    limit = max(1, min(int(limit or _DEFAULT_LIMIT), _MAX_LIMIT))
    page = repo.list_page(order_by=order_by, limit=limit, cursor_id=cursor)
    return {
        "data": page.items,
        "next_cursor": page.next_cursor,
        "has_more": page.has_more,
    }


@public_router.get("/catalog")
def catalog(key: dict = Depends(api_key_auth)):
    """List the public resources exposed to integrations + the OpenAPI URL."""
    return {
        "version": "v1",
        "openapi_url": _OPENAPI_URL,
        "scopes": key.get("scopes", []),
        "resources": [
            {"name": "contacts", "path": "/api/public/v1/contacts", "methods": ["GET"]},
            {"name": "items", "path": "/api/public/v1/items", "methods": ["GET"]},
            {"name": "invoices", "path": "/api/public/v1/invoices", "methods": ["GET"]},
        ],
    }


@public_router.get("/contacts")
def list_contacts(
    key: dict = Depends(api_key_auth),
    limit: int = Query(_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
    cursor: Optional[str] = Query(default=None),
):
    """List the key org's contacts (read-only, cursor-paginated)."""
    from app.firestore.contacts import ContactRepository

    return _page(ContactRepository(key["org_id"]), order_by="created_at", limit=limit, cursor=cursor)


@public_router.get("/items")
def list_items(
    key: dict = Depends(api_key_auth),
    limit: int = Query(_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
    cursor: Optional[str] = Query(default=None),
):
    """List the key org's items (read-only, cursor-paginated)."""
    from app.firestore.items import ItemRepository

    return _page(ItemRepository(key["org_id"]), order_by="created_at", limit=limit, cursor=cursor)


@public_router.get("/invoices")
def list_invoices(
    key: dict = Depends(api_key_auth),
    limit: int = Query(_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
    cursor: Optional[str] = Query(default=None),
):
    """List the key org's invoices (read-only, cursor-paginated)."""
    from app.firestore.invoices import InvoiceRepository

    return _page(InvoiceRepository(key["org_id"]), order_by="created_at", limit=limit, cursor=cursor)


# ─────────────────────────────────────────────────────────────────────────────
# Key-management router (normal user auth + api_keys.manage permission)
# ─────────────────────────────────────────────────────────────────────────────
keys_router = APIRouter(prefix="/api/public/keys", tags=["Public API"])


class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    scopes: list[str] = Field(default_factory=list)


@keys_router.post("", status_code=201)
def create_api_key(
    payload: ApiKeyCreate,
    user: dict = Depends(require_perm(PERM_MANAGE_KEYS)),
):
    """Create a new API key. The plaintext is returned ONCE in ``plaintext_key``."""
    repo = ApiKeyRepository(user["org_id"])
    return repo.create(name=payload.name, scopes=payload.scopes)


@keys_router.get("")
def list_api_keys(user: dict = Depends(require_perm(PERM_MANAGE_KEYS))):
    """List the org's API keys (masked — never returns the hash or plaintext)."""
    repo = ApiKeyRepository(user["org_id"])
    return repo.list_masked()


@keys_router.delete("/{key_id}")
def revoke_api_key(
    key_id: str,
    user: dict = Depends(require_perm(PERM_MANAGE_KEYS)),
):
    """Revoke (deactivate) an API key."""
    repo = ApiKeyRepository(user["org_id"])
    revoked = repo.revoke(key_id)
    if revoked is None:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"success": True, "key": revoked}


# Bulk-registration convenience for ``app.main`` (mirrors quick_create.ALL_ROUTERS).
ALL_ROUTERS = [public_router, keys_router]

__all__ = ["public_router", "keys_router", "ALL_ROUTERS"]
