"""Minimum-app-version enforcement middleware.

Spec ref: growth-to-100 requirements.md §R5.8 ("WHEN the running version is
below ``min_supported_version``, the app SHALL display a non-dismissible
modal"). The middleware adds a server-side belt-and-suspenders layer so a
compromised or stale client cannot bypass the modal: any API call from a
below-min mobile version receives ``426 Upgrade Required`` with a JSON body
the frontend converts into the force-update modal.

Headers expected on mobile requests (set by the Capacitor shell):
  X-App-Platform : "ios" | "android"
  X-App-Version  : "1.4.1"

If headers are absent (web client), the middleware is a no-op.

Cache: the min-version per platform is cached in-process for 60s to avoid a
Firestore round trip on every request.
"""
from __future__ import annotations

import logging
import time
from typing import Dict, Tuple

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

log = logging.getLogger(__name__)


# ── Config cache ─────────────────────────────────────────────────────────

_CACHE_TTL_SECONDS = 60
_cache: Dict[str, Tuple[float, dict]] = {}


def _load_min_version(platform: str) -> dict:
    now = time.time()
    cached = _cache.get(platform)
    if cached and (now - cached[0] < _CACHE_TTL_SECONDS):
        return cached[1]

    try:
        from app.firestore.mobile_devices import MobileVersionConfigRepository
        repo = MobileVersionConfigRepository()
        doc = repo.get_for_platform(platform) or {}
    except Exception as e:  # noqa: BLE001
        log.warning("min-version cache refresh failed; failing open: %s", e)
        doc = {}

    _cache[platform] = (now, doc)
    return doc


def _compare(a: str, b: str) -> int:
    pa = [int(x) if x.isdigit() else 0 for x in a.split(".")]
    pb = [int(x) if x.isdigit() else 0 for x in b.split(".")]
    for i in range(max(len(pa), len(pb))):
        x = pa[i] if i < len(pa) else 0
        y = pb[i] if i < len(pb) else 0
        if x != y:
            return -1 if x < y else 1
    return 0


# ── Routes exempt from the gate (must always succeed for the modal to work) ─

_EXEMPT_PREFIXES = (
    "/api/mobile/version-check",
    "/api/auth/",          # users must be able to log out
    "/api/health",
    "/api/devices",        # registration / unregistration
    "/api/docs",
    "/api/openapi",
)


def _is_exempt(path: str) -> bool:
    return any(path.startswith(p) for p in _EXEMPT_PREFIXES)


# ── Middleware ────────────────────────────────────────────────────────────

class MinAppVersionMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        platform = (request.headers.get("X-App-Platform") or "").strip().lower()
        current = (request.headers.get("X-App-Version") or "").strip()

        if not platform or not current or platform not in ("ios", "android"):
            return await call_next(request)
        if _is_exempt(request.url.path):
            return await call_next(request)

        config = _load_min_version(platform)
        min_v = config.get("min_version") or "0.0.0"
        force = bool(config.get("force_update", False))

        below_min = _compare(current, min_v) < 0
        if not (below_min or force):
            return await call_next(request)

        # Block — return 426 Upgrade Required (RFC 7231 §6.5.15).
        return JSONResponse(
            status_code=426,
            content={
                "code": "MOBILE_UPGRADE_REQUIRED",
                "message": "Your app version is no longer supported. Please update to continue.",
                "min_version": min_v,
                "current_version": current,
                "force_update": True,
                "update_url": (
                    config.get("update_url")
                    or (
                        "https://apps.apple.com/app/zoho-kurdish/idTBD"
                        if platform == "ios"
                        else "https://play.google.com/store/apps/details?id=com.zoho.kurdishierp"
                    )
                ),
                "update_message": {
                    "ku": config.get("update_message_ku", "تکایە ئەپەکە نوێ بکەرەوە."),
                    "ar": config.get("update_message_ar", "يرجى تحديث التطبيق."),
                    "en": config.get("update_message_en", "Please update the app."),
                },
            },
        )


def reset_cache_for_tests() -> None:
    """Convenience hook for unit tests."""
    _cache.clear()
