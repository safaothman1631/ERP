"""
Unit tests for permission-based settings access in backend/app/api/system.py

Covers:
  - _require_settings_write: allows admin role (Requirement 12.4)
  - _require_settings_write: allows owner role (Requirement 12.4)
  - _require_settings_write: denies non-admin/non-owner roles (Requirement 12.4)
  - _require_settings_write: allows users with settings.update permission (Requirement 12.4)
  - _log_settings_change: writes an audit log entry (Requirement 12.5)
  - _log_settings_change: never raises even if Firestore fails (Requirement 12.5)
  - upsert_setting endpoint: enforces permission check
  - upsert_setting endpoint: writes audit log on success

Requirements: 12.4, 12.5
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Make the backend package importable
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(role: str = "admin", perms: list | None = None) -> dict:
    """Build a minimal user dict as returned by get_current_user."""
    return {
        "id": "user-1",
        "email": "test@example.com",
        "name": "Test User",
        "display_name": "Test User",
        "org_id": "org-1",
        "role": role,
        "is_active": True,
        "_permissions": perms or [],
    }


# ===========================================================================
# _require_settings_write
# ===========================================================================

class TestRequireSettingsWrite:
    """Tests for _require_settings_write() — Requirement 12.4."""

    def _call(self, user: dict, category: str | None = None):
        from app.api.system import _require_settings_write
        _require_settings_write(user, category)

    def test_admin_role_is_allowed(self):
        """Admin role must pass without raising (Req 12.4)."""
        user = _make_user(role="admin")
        # Should not raise
        with patch("app.services.settings_category_gate.user_has_perm", return_value=False):
            self._call(user)  # no exception

    def test_owner_role_is_allowed(self):
        """Owner role must pass without raising (Req 12.4)."""
        user = _make_user(role="owner")
        with patch("app.services.settings_category_gate.user_has_perm", return_value=False):
            self._call(user)  # no exception

    def test_viewer_role_is_denied(self):
        """Viewer role must raise 403 (Req 12.4)."""
        from fastapi import HTTPException
        user = _make_user(role="viewer")
        with patch("app.services.settings_category_gate.user_has_perm", return_value=False):
            with pytest.raises(HTTPException) as exc_info:
                self._call(user)
        assert exc_info.value.status_code == 403

    def test_accountant_role_is_denied(self):
        """Accountant role must raise 403 (Req 12.4)."""
        from fastapi import HTTPException
        user = _make_user(role="accountant")
        with patch("app.services.settings_category_gate.user_has_perm", return_value=False):
            with pytest.raises(HTTPException) as exc_info:
                self._call(user)
        assert exc_info.value.status_code == 403

    def test_sales_role_is_denied(self):
        """Sales role must raise 403 (Req 12.4)."""
        from fastapi import HTTPException
        user = _make_user(role="sales")
        with patch("app.services.settings_category_gate.user_has_perm", return_value=False):
            with pytest.raises(HTTPException) as exc_info:
                self._call(user)
        assert exc_info.value.status_code == 403

    def test_member_role_is_denied(self):
        """Generic member role must raise 403 (Req 12.4)."""
        from fastapi import HTTPException
        user = _make_user(role="member")
        with patch("app.services.settings_category_gate.user_has_perm", return_value=False):
            with pytest.raises(HTTPException) as exc_info:
                self._call(user)
        assert exc_info.value.status_code == 403

    def test_settings_update_permission_grants_access(self):
        """A user with settings.update permission must pass even without admin role (Req 12.4)."""
        user = _make_user(role="custom")
        with patch("app.services.settings_category_gate.user_has_perm", return_value=True):
            self._call(user)  # no exception

    def test_403_detail_is_informative(self):
        """The 403 response must include a meaningful detail message."""
        from fastapi import HTTPException
        user = _make_user(role="viewer")
        with patch("app.services.settings_category_gate.user_has_perm", return_value=False):
            with pytest.raises(HTTPException) as exc_info:
                self._call(user)
        assert exc_info.value.detail  # non-empty detail

    def test_category_specific_permission_grants_access(self):
        """A user with a category-specific write permission must pass."""
        user = _make_user(role="custom")
        with patch(
            "app.services.settings_category_gate.user_has_perm",
            side_effect=lambda _user, code: code == "settings.fiscal",
        ):
            self._call(user, "fiscal")  # no exception


class TestRequireSettingsRead:
    """Tests for _require_settings_read() read-tier behavior."""

    def _call(self, user: dict, category: str | None = None):
        from app.api.system import _require_settings_read

        _require_settings_read(user, category)

    def test_manager_role_is_allowed(self):
        user = _make_user(role="manager")
        with patch("app.services.settings_category_gate.user_has_perm", return_value=False):
            self._call(user, "sales")

    def test_settings_read_permission_is_allowed(self):
        user = _make_user(role="custom")
        with patch(
            "app.services.settings_category_gate.user_has_perm",
            side_effect=lambda _user, code: code == "settings.read",
        ):
            self._call(user, "sales")

    def test_viewer_without_permissions_is_denied(self):
        user = _make_user(role="viewer")
        with patch("app.services.settings_category_gate.user_has_perm", return_value=False):
            with pytest.raises(HTTPException) as exc_info:
                self._call(user, "sales")
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail["code"] == "permission_denied"


# ===========================================================================
# _log_settings_change
# ===========================================================================

class TestLogSettingsChange:
    """Tests for _log_settings_change() — Requirement 12.5."""

    def test_writes_audit_log_entry(self):
        """_log_settings_change must create an audit log document (Req 12.5)."""
        from app.api.system import _log_settings_change

        mock_repo = MagicMock()
        mock_repo.create.return_value = {"id": "audit-1"}

        with patch("app.api.system.AuditLogRepository", return_value=mock_repo):
            user = _make_user(role="admin")
            _log_settings_change(user, "sales", "blob", {"old": True}, {"new": True})

        mock_repo.create.assert_called_once()
        payload = mock_repo.create.call_args[0][0]

        assert payload["entity_type"] == "settings"
        assert payload["entity_id"] == "sales/blob"
        assert payload["action"] == "update"
        assert payload["user_id"] == "user-1"
        assert payload["changes"]["category"] == "sales"
        assert payload["changes"]["key"] == "blob"
        assert payload["changes"]["old_value"] == {"old": True}
        assert payload["changes"]["new_value"] == {"new": True}

    def test_audit_log_includes_user_email(self):
        """Audit log entry must include the user's email for traceability (Req 12.5)."""
        from app.api.system import _log_settings_change

        mock_repo = MagicMock()
        with patch("app.api.system.AuditLogRepository", return_value=mock_repo):
            user = _make_user(role="admin")
            _log_settings_change(user, "general", "key1", None, "new-value")

        payload = mock_repo.create.call_args[0][0]
        assert payload["user_email"] == "test@example.com"

    def test_audit_log_includes_timestamp(self):
        """Audit log entry must include a created_at timestamp (Req 12.5)."""
        from app.api.system import _log_settings_change

        mock_repo = MagicMock()
        with patch("app.api.system.AuditLogRepository", return_value=mock_repo):
            user = _make_user(role="admin")
            _log_settings_change(user, "general", "key1", None, "value")

        payload = mock_repo.create.call_args[0][0]
        assert "created_at" in payload
        assert payload["created_at"]  # non-empty

    def test_audit_log_never_raises_on_firestore_error(self):
        """_log_settings_change must swallow Firestore errors (Req 12.5).

        Audit logging must never block the main settings write operation.
        """
        from app.api.system import _log_settings_change

        mock_repo = MagicMock()
        mock_repo.create.side_effect = RuntimeError("Firestore unavailable")

        with patch("app.api.system.AuditLogRepository", return_value=mock_repo):
            user = _make_user(role="admin")
            # Must not raise
            _log_settings_change(user, "general", "key1", None, "value")

    def test_audit_log_records_old_and_new_values(self):
        """Audit log must capture both old and new values for change tracking (Req 12.5)."""
        from app.api.system import _log_settings_change

        mock_repo = MagicMock()
        old_val = {"theme": "light", "lang": "ku"}
        new_val = {"theme": "dark", "lang": "ku"}

        with patch("app.api.system.AuditLogRepository", return_value=mock_repo):
            user = _make_user(role="admin")
            _log_settings_change(user, "ui", "blob", old_val, new_val)

        payload = mock_repo.create.call_args[0][0]
        assert payload["changes"]["old_value"] == old_val
        assert payload["changes"]["new_value"] == new_val

    def test_audit_log_handles_none_old_value(self):
        """Audit log must handle None old_value (new key being created) (Req 12.5)."""
        from app.api.system import _log_settings_change

        mock_repo = MagicMock()
        with patch("app.api.system.AuditLogRepository", return_value=mock_repo):
            user = _make_user(role="admin")
            _log_settings_change(user, "general", "new_key", None, "first-value")

        payload = mock_repo.create.call_args[0][0]
        assert payload["changes"]["old_value"] is None
        assert payload["changes"]["new_value"] == "first-value"


class TestSettingsCategoryEndpointModuleGate:
    """GET /settings/{category} should enforce module gate as well."""

    def test_standard_get_sales_returns_403_when_module_is_disabled(self):
        from app.api.system import router as system_router
        from app.services.auth import get_current_user

        app = FastAPI()
        app.include_router(system_router)
        app.dependency_overrides[get_current_user] = lambda: _make_user(role="manager")

        with patch(
            "app.api.system.require_module_for_category",
            side_effect=HTTPException(
                status_code=403,
                detail={"code": "module_disabled", "module": "sales"},
            ),
        ), patch("app.api.system._settings_service.get_bag") as mock_get_bag:
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/api/system/settings/sales")

        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "module_disabled"
        mock_get_bag.assert_not_called()
