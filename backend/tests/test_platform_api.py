"""Tests for platform license API guard."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class TestPlatformApi:
    @patch("app.api.platform._guards.user_has_perm", return_value=False)
    def test_non_platform_user_forbidden(self, _perm):
        from app.api.platform import require_platform_admin

        with pytest.raises(HTTPException) as exc:
            require_platform_admin(user={"id": "u1", "org_id": "org-1", "role": "admin"})
        assert exc.value.status_code == 403

    @patch("app.api.platform._guards._platform_admin_ids", return_value={"vendor-1"})
    @patch("app.api.platform._guards.user_has_perm", return_value=True)
    def test_platform_admin_allowlist(self, _perm, _ids):
        from app.api.platform import require_platform_admin

        with pytest.raises(HTTPException) as exc:
            require_platform_admin(user={"id": "other", "org_id": "org-1", "role": "admin"})
        assert exc.value.status_code == 403

        user = require_platform_admin(user={"id": "vendor-1", "org_id": "org-1", "role": "admin"})
        assert user["id"] == "vendor-1"

    @patch("app.api.platform.licenses.audit_platform")
    @patch("app.api.platform.licenses.set_org_license")
    @patch("app.api.platform.licenses.OrganizationRepository")
    def test_update_license(self, mock_repo_cls, mock_set, _audit):
        from app.api.platform import LicenseUpdatePayload, update_org_license

        mock_repo_cls.return_value.get.return_value = {"id": "org-2"}
        mock_set.return_value = {"bundle_id": "pos_only", "allowed_modules": ["pos"]}

        result = update_org_license(
            "org-2",
            LicenseUpdatePayload(bundle_id="pos_only"),
            user={"id": "vendor-1"},
        )
        assert result["license"]["bundle_id"] == "pos_only"
