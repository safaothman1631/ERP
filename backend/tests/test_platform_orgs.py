"""Platform org management tests."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class TestPlatformOrgs:
    @patch("app.api.platform.orgs.OrganizationRepository")
    @patch("app.api.platform.orgs.require_platform_admin")
    def test_get_org_not_found(self, mock_guard, mock_repo_cls):
        from app.api.platform.orgs import get_org

        mock_guard.return_value = {"id": "admin-1"}
        mock_repo_cls.return_value.get.return_value = None
        with pytest.raises(HTTPException) as exc:
            get_org("missing", user={"id": "admin-1"})
        assert exc.value.status_code == 404
