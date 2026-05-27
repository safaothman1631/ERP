"""Module access gate — enforce enabled_modules + license expiry on API routes."""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt

from app.config import get_settings
from app.services.module_registry import ALWAYS_ON, module_for_path
from app.services.onboarding_prefs import OnboardingPreferencesRepository, fetch_prefs
from app.services.org_license import is_license_valid

_settings = get_settings()
_ENABLED_CACHE: dict[str, tuple[float, Optional[list[str]]]] = {}
_CACHE_TTL = 60


def _cache_get(org_id: str) -> Optional[list[str]] | object:
    import time
    entry = _ENABLED_CACHE.get(org_id)
    if not entry:
        return _SENTINEL
    ts, val = entry
    if time.time() - ts > _CACHE_TTL:
        _ENABLED_CACHE.pop(org_id, None)
        return _SENTINEL
    return val


_SENTINEL = object()


def _cache_set(org_id: str, val: Optional[list[str]]) -> None:
    import time
    _ENABLED_CACHE[org_id] = (time.time(), val)


def invalidate_enabled_cache(org_id: str) -> None:
    _ENABLED_CACHE.pop(org_id, None)


def get_enabled_modules(org_id: str) -> Optional[list[str]]:
    """Return enabled modules list, or None for legacy 'all modules' passthrough."""
    cached = _cache_get(org_id)
    if cached is not _SENTINEL:
        return cached  # type: ignore[return-value]

    repo = OnboardingPreferencesRepository(org_id)
    doc = fetch_prefs(repo, org_id)
    if not doc:
        _cache_set(org_id, None)
        return None

    completed = bool(doc.get("completed"))
    modules = doc.get("enabled_modules") or []

    if completed and not modules:
        _cache_set(org_id, None)
        return None

    if not completed and not modules:
        enabled = sorted(ALWAYS_ON)
        _cache_set(org_id, enabled)
        return enabled

    merged = sorted(set(modules) | set(ALWAYS_ON))
    _cache_set(org_id, merged)
    return merged


def is_module_enabled(org_id: str, module: str) -> bool:
    if module in ALWAYS_ON:
        return True
    enabled = get_enabled_modules(org_id)
    if enabled is None:
        return True
    return module in enabled


def require_module(module: str):
    """FastAPI dependency — block when module is not enabled for the org."""
    from app.services.auth import get_current_user

    def _dep(user: dict = Depends(get_current_user)):
        org_id = user.get("org_id")
        if not org_id:
            raise HTTPException(status_code=403, detail={"code": "module_disabled", "module": module})
        if module in ALWAYS_ON:
            return user
        if not is_license_valid(org_id):
            raise HTTPException(status_code=403, detail={"code": "license_expired", "module": module})
        if not is_module_enabled(org_id, module):
            raise HTTPException(status_code=403, detail={"code": "module_disabled", "module": module})
        return user

    return _dep


def _decode_user_from_request(request: Request) -> Optional[dict]:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, _settings.SECRET_KEY, algorithms=[_settings.ALGORITHM])
        return {"user_id": payload.get("sub"), "org_id": payload.get("org_id")}
    except JWTError:
        return None


async def module_gate_middleware(request: Request, call_next):
    """HTTP middleware — enforce module gate on mutating API calls."""
    path = request.url.path
    module = module_for_path(path)
    if not module or module in ALWAYS_ON:
        return await call_next(request)

    user_ctx = _decode_user_from_request(request)
    if not user_ctx or not user_ctx.get("org_id"):
        return await call_next(request)

    org_id = user_ctx["org_id"]
    method = request.method.upper()

    if not is_license_valid(org_id):
        if method in {"POST", "PUT", "PATCH", "DELETE"}:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=403,
                content={"detail": {"code": "license_expired", "module": module}},
            )
        return await call_next(request)

    if not is_module_enabled(org_id, module):
        if method in {"POST", "PUT", "PATCH", "DELETE"}:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=403,
                content={"detail": {"code": "module_disabled", "module": module}},
            )

    return await call_next(request)
