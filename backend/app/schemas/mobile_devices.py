"""Schemas for device registration + mobile version-check.

Spec refs: growth-to-100 requirements.md §R5.8 (version-check),
§R5.9 (FCM token registration), design.md §5.4–§5.5.
"""
from __future__ import annotations

from typing import Dict, Literal, Optional

from pydantic import BaseModel, Field


# ── /api/devices/register ────────────────────────────────────────────────

class DeviceRegisterRequest(BaseModel):
    fcm_token: str = Field(..., min_length=10, max_length=4096)
    platform: Literal["ios", "android"]
    app_version: str = Field(..., min_length=1, max_length=32)
    device_model: str = Field("", max_length=120)


class DeviceResponse(BaseModel):
    id: str
    fcm_token: str
    platform: Literal["ios", "android"]
    app_version: str
    device_model: str
    user_id: str
    tenant_id: str
    created_at: str
    last_seen_at: Optional[str] = None


# ── /api/mobile/version-check ─────────────────────────────────────────────

class VersionCheckRequest(BaseModel):
    platform: Literal["ios", "android"]
    current_version: str = Field(..., min_length=1, max_length=32)


class VersionCheckResponse(BaseModel):
    min_version: str
    latest_version: str
    force_update: bool
    update_url: Dict[str, str] = Field(
        default_factory=lambda: {
            "ios": "https://apps.apple.com/app/zoho-kurdish/idTBD",
            "android": "https://play.google.com/store/apps/details?id=com.zoho.kurdishierp",
        }
    )
    update_message: Dict[str, str] = Field(
        default_factory=lambda: {
            "ku": "تکایە ئەپەکە نوێ بکەرەوە بۆ بەردەوامی.",
            "ar": "يرجى تحديث التطبيق للمتابعة.",
            "en": "Please update the app to continue.",
        }
    )


# ── /api/admin/mobile/version-config ─────────────────────────────────────

class VersionConfigUpdate(BaseModel):
    platform: Literal["ios", "android"]
    min_version: str = Field(..., min_length=1, max_length=32)
    latest_version: str = Field(..., min_length=1, max_length=32)
    force_update: bool = False
    update_url: Optional[str] = None
    update_message_ku: Optional[str] = Field(None, max_length=500)
    update_message_ar: Optional[str] = Field(None, max_length=500)
    update_message_en: Optional[str] = Field(None, max_length=500)


class VersionConfigResponse(BaseModel):
    platform: str
    min_version: str
    latest_version: str
    force_update: bool
    update_url: str
    update_message: Dict[str, str]
    updated_at: str
    updated_by: Optional[str] = None
