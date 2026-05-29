"""Firestore repositories for mobile push devices + version config.

Spec ref: growth-to-100 design.md §5.4 (token lifecycle), §5.7 (mobile_versions
collection). Devices are scoped per-tenant (collection ``mobile_devices``).
Version config lives in a single top-level collection ``mobile_versions`` keyed
by platform — there is no per-tenant version config (server-side enforcement
is global).
"""
from __future__ import annotations

from typing import Optional

from app.firestore.base import BaseRepository


class MobileDeviceRepository(BaseRepository):
    """Per-tenant scoped registry of (user_id, fcm_token) tuples.

    A single user can have multiple devices (phone + tablet). We dedupe on
    ``fcm_token`` to avoid duplicate notifications when the same physical
    device re-registers after a token rotation.
    """

    collection_name = "mobile_devices"

    def find_by_token(self, fcm_token: str) -> Optional[dict]:
        rows, _ = self.list(
            filters=[{"field": "fcm_token", "op": "==", "value": fcm_token}],
            limit=1,
        )
        return rows[0] if rows else None

    def list_for_user(self, user_id: str) -> list[dict]:
        rows, _ = self.list(
            filters=[{"field": "user_id", "op": "==", "value": user_id}],
            limit=50,
        )
        return rows

    def list_for_tenant(self) -> list[dict]:
        # BaseRepository.list already scopes by tenant; no filter needed.
        rows, _ = self.list(limit=500)
        return rows


class MobileVersionConfigRepository(BaseRepository):
    """Global (non-tenant-scoped) collection for the min/latest version policy.

    Despite inheriting BaseRepository, this repo is constructed with
    ``org_id="_global"`` so reads/writes share a single config across the
    fleet. Only super-admin endpoints write here; the public version-check
    endpoint reads it.
    """

    collection_name = "mobile_versions"

    def __init__(self):
        super().__init__("_global")

    def get_for_platform(self, platform: str) -> Optional[dict]:
        return self.get(platform)
