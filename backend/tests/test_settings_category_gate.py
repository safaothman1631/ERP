"""Unit tests for settings category gate service."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _user(role: str = "member") -> dict:
    return {
        "id": "u-1",
        "org_id": "org-1",
        "role": role,
    }


class TestCategoryModuleGate:
    def test_modules_for_category_single(self):
        from app.services.settings_category_gate import modules_for_category

        assert modules_for_category("sales") == ("sales",)

    def test_modules_for_category_or_gate(self):
        from app.services.settings_category_gate import modules_for_category

        assert modules_for_category("payment_methods") == ("sales", "pos")

    @patch("app.services.settings_category_gate.is_module_enabled")
    @patch("app.services.settings_category_gate.is_license_valid", return_value=True)
    def test_unmapped_category_is_passthrough(self, _valid, mock_enabled):
        from app.services.settings_category_gate import require_module_for_category

        require_module_for_category("org-1", "general")
        mock_enabled.assert_not_called()

    @patch("app.services.settings_category_gate.is_module_enabled", return_value=False)
    @patch("app.services.settings_category_gate.is_license_valid", return_value=True)
    def test_raises_module_disabled_for_single_module_category(self, _valid, _enabled):
        from app.services.settings_category_gate import require_module_for_category

        with pytest.raises(HTTPException) as exc_info:
            require_module_for_category("org-1", "sales")
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail["code"] == "module_disabled"
        assert exc_info.value.detail["module"] == "sales"

    @patch("app.services.settings_category_gate.is_license_valid", return_value=True)
    @patch(
        "app.services.settings_category_gate.is_module_enabled",
        side_effect=lambda _org_id, module: module == "pos",
    )
    def test_or_module_gate_allows_when_any_required_module_is_enabled(self, _enabled, _valid):
        from app.services.settings_category_gate import require_module_for_category

        require_module_for_category("org-1", "payment_methods")

    @patch("app.services.settings_category_gate.is_license_valid", return_value=False)
    def test_raises_license_expired_when_license_is_invalid(self, _valid):
        from app.services.settings_category_gate import require_module_for_category

        with pytest.raises(HTTPException) as exc_info:
            require_module_for_category("org-1", "sales")
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail["code"] == "license_expired"


class TestCategoryPermissionHelpers:
    def test_write_access_allows_category_specific_permission(self):
        from app.services.settings_category_gate import has_settings_write_access

        with patch(
            "app.services.settings_category_gate.user_has_perm",
            side_effect=lambda _user, code: code == "settings.fiscal",
        ):
            assert has_settings_write_access(_user(), "fiscal") is True

    def test_read_access_allows_manager_without_extra_permission(self):
        from app.services.settings_category_gate import has_settings_read_access

        with patch("app.services.settings_category_gate.user_has_perm", return_value=False):
            assert has_settings_read_access(_user(role="manager"), "sales") is True


class TestDefaultSeeding:
    def test_seed_default_bags_only_for_missing_categories(self):
        from app.services.settings_category_gate import seed_default_bags_for_modules

        fake_repo = MagicMock()

        def _list(*, filters, limit):
            category = next(f["value"] for f in filters if f["field"] == "category")
            if category == "sales":
                return ([], 0)
            return ([{"id": "existing"}], 1)

        fake_repo.list.side_effect = _list

        with patch("app.firestore.system.SettingsRepository", return_value=fake_repo), patch(
            "app.services.settings_service.get_sales_settings",
            return_value={"quote_expiry_days": 30},
        ) as mock_defaults, patch(
            "app.services.settings_service.set_bag"
        ) as mock_set_bag:
            seeded = seed_default_bags_for_modules("org-1", ["sales"])

        assert seeded == ["sales"]
        mock_defaults.assert_called_once_with("org-1")
        mock_set_bag.assert_called_once_with("org-1", "sales", {"quote_expiry_days": 30})
