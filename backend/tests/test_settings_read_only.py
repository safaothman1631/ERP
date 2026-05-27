"""Tests for read-only settings categories and specialist read access."""
from __future__ import annotations

import pytest

from app.services.settings_category_gate import (
    has_settings_read_access,
    has_settings_write_access,
    is_read_only_category,
)


def test_activity_category_is_read_only():
    assert is_read_only_category("activity") is True
    assert has_settings_write_access({"role": "admin", "org_id": "org1"}, "activity") is False


def test_admin_can_write_sales():
    assert has_settings_write_access({"role": "admin", "org_id": "org1"}, "sales") is True


def test_sales_specialist_read_sales(monkeypatch):
    monkeypatch.setattr(
        "app.services.settings_category_gate.is_module_enabled",
        lambda org_id, mod: mod == "sales",
    )
    user = {"role": "sales", "org_id": "org1", "permissions": []}
    assert has_settings_read_access(user, "sales") is True
    assert has_settings_read_access(user, "crm") is False


def test_viewer_cannot_write_sales():
    assert has_settings_write_access({"role": "viewer", "org_id": "org1"}, "sales") is False
