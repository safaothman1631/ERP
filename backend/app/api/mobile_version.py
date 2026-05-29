"""Mobile in-app update gate endpoint.

Spec refs: growth-to-100 requirements.md §R5.8, design.md §5.5 + §5.7,
tasks.md T-G.5.13.

Public — no auth required, called on every cold start before login. The
backend reads from the global ``mobile_versions`` Firestore collection
(keyed by platform). If no doc is present, we serve a permissive default
that never blocks the user.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter

from app.firestore.mobile_devices import MobileVersionConfigRepository
from app.schemas.mobile_devices import VersionCheckRequest, VersionCheckResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mobile", tags=["mobile"])


_DEFAULT_CONFIG = {
    "min_version": "0.0.0",
    "latest_version": "0.0.0",
    "force_update": False,
    "update_url_ios": "https://apps.apple.com/app/zoho-kurdish/idTBD",
    "update_url_android": "https://play.google.com/store/apps/details?id=com.zoho.kurdishierp",
    "update_message_ku": "گەشتکردن بۆ نوێکارییەکی نوێ بەردەستە.",
    "update_message_ar": "تحديث جديد متاح.",
    "update_message_en": "A new update is available.",
}


def _compare(a: str, b: str) -> int:
    """Compare two semver-ish version strings. Returns -1, 0, 1."""
    pa = [int(x) if x.isdigit() else 0 for x in a.split(".")]
    pb = [int(x) if x.isdigit() else 0 for x in b.split(".")]
    for i in range(max(len(pa), len(pb))):
        x = pa[i] if i < len(pa) else 0
        y = pb[i] if i < len(pb) else 0
        if x != y:
            return -1 if x < y else 1
    return 0


def _load_config(platform: str) -> dict:
    try:
        repo = MobileVersionConfigRepository()
        doc = repo.get_for_platform(platform)
        if doc:
            return doc
    except Exception as e:  # noqa: BLE001
        logger.warning("version-config load failed; serving default: %s", e)
    return _DEFAULT_CONFIG


@router.post("/version-check", response_model=VersionCheckResponse)
def version_check(req: VersionCheckRequest) -> VersionCheckResponse:
    config = _load_config(req.platform)

    min_v = config.get("min_version", "0.0.0")
    latest_v = config.get("latest_version", "0.0.0")
    force = bool(config.get("force_update", False))

    # Evaluate: if current < min_v OR force flag set → force update.
    if not force:
        force = _compare(req.current_version, min_v) < 0

    update_url = {
        "ios": config.get("update_url_ios", _DEFAULT_CONFIG["update_url_ios"]),
        "android": config.get("update_url_android", _DEFAULT_CONFIG["update_url_android"]),
    }
    update_message = {
        "ku": config.get("update_message_ku", _DEFAULT_CONFIG["update_message_ku"]),
        "ar": config.get("update_message_ar", _DEFAULT_CONFIG["update_message_ar"]),
        "en": config.get("update_message_en", _DEFAULT_CONFIG["update_message_en"]),
    }

    return VersionCheckResponse(
        min_version=min_v,
        latest_version=latest_v,
        force_update=force,
        update_url=update_url,
        update_message=update_message,
    )
