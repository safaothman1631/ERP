"""Platform stats endpoint tests."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class TestPlatformStats:
    @patch("app.api.platform.stats.get_db")
    @patch("app.api.platform.stats.require_platform_admin")
    def test_stats_counts(self, mock_guard, mock_db):
        from app.api.platform.stats import platform_stats

        mock_guard.return_value = {"id": "admin-1"}
        db = MagicMock()

        org_active = MagicMock()
        org_active.to_dict.return_value = {"name": "A", "status": "active"}
        org_active.id = "org-a"

        org_suspended = MagicMock()
        org_suspended.to_dict.return_value = {"name": "B", "status": "suspended", "suspended_at": "2026-01-01"}
        org_suspended.id = "org-b"

        db.collection.return_value.limit.return_value.stream.side_effect = [
            [org_active, org_suspended],
            [],
            [],
        ]
        mock_db.return_value = db

        with patch("app.api.platform.stats.get_license", return_value={}):
            result = platform_stats(user={"id": "admin-1"})
        assert result["organizations"]["active"] == 1
        assert result["organizations"]["suspended"] == 1
