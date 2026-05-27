"""Tests for org license bundles and pool validation."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class TestOrgLicense:
    @patch("app.services.org_license.OrganizationRepository")
    def test_pos_only_bundle_modules(self, mock_repo_cls):
        from app.services.org_license import BUNDLES, get_allowed_modules, invalidate_license_cache

        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.get.return_value = {
            "id": "org-1",
            "license": {"bundle_id": "pos_only"},
        }
        invalidate_license_cache("org-1")

        allowed = get_allowed_modules("org-1")
        assert "pos" in allowed
        assert "sales" in allowed
        assert "purchase" not in allowed
        assert "accounting" in allowed
        assert "banking" in allowed

    @patch("app.services.org_license.OrganizationRepository")
    def test_legacy_no_cap_returns_none(self, mock_repo_cls):
        from app.services.org_license import get_allowed_modules, invalidate_license_cache

        mock_repo = MagicMock()
        mock_repo_cls.return_value = mock_repo
        mock_repo.get.return_value = {"id": "org-2", "license": {}}
        invalidate_license_cache("org-2")

        assert get_allowed_modules("org-2") is None

    @patch("app.services.org_license.get_allowed_modules")
    def test_assert_modules_allowed_rejects_outside_pool(self, mock_allowed):
        from app.services.org_license import assert_modules_allowed

        mock_allowed.return_value = ["accounting", "banking", "sales", "pos"]
        with pytest.raises(ValueError, match="manufacturing"):
            assert_modules_allowed("org-1", ["sales", "manufacturing"])

    def test_bundle_definitions(self):
        from app.services.org_license import BUNDLES

        assert "pos_only" in BUNDLES
        assert "trading" in BUNDLES
        assert "full_core" in BUNDLES
        assert "purchase" not in BUNDLES["pos_only"]
