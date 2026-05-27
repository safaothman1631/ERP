"""Tests for module access request lifecycle."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _admin():
    return {"id": "admin-1", "org_id": "org-1", "role": "admin", "email": "a@test.com"}


def _user():
    return {"id": "user-1", "org_id": "org-1", "role": "viewer", "email": "u@test.com"}


class TestModuleRequests:
    @patch("app.api.onboarding._open_pending_for_user", return_value=None)
    @patch("app.api.onboarding.ModuleAccessRequestRepository")
    @patch("app.api.onboarding.assert_modules_allowed")
    @patch("app.api.onboarding.get_allowed_modules")
    def test_create_request_success(self, mock_pool, _assert, mock_repo_cls, _pending):
        from app.api.onboarding import ModuleRequestCreate, create_module_request

        mock_pool.return_value = ["accounting", "banking", "sales", "pos"]
        repo = MagicMock()
        mock_repo_cls.return_value = repo
        repo.create.return_value = {"id": "req-1", "status": "pending"}

        payload = ModuleRequestCreate(requested_modules=["sales", "pos"], industry_id="retail")
        result = create_module_request(payload, user=_user())
        assert result["status"] == "pending"
        repo.create.assert_called_once()

    @patch("app.api.onboarding._open_pending_for_user", return_value={"id": "existing"})
    def test_duplicate_pending_returns_409(self, _pending):
        from app.api.onboarding import ModuleRequestCreate, create_module_request

        with pytest.raises(HTTPException) as exc:
            create_module_request(ModuleRequestCreate(requested_modules=["sales"]), user=_user())
        assert exc.value.status_code == 409

    @patch("app.api.onboarding.merge_enabled_modules")
    @patch("app.api.onboarding._audit_module_action")
    @patch("app.api.onboarding.get_allowed_modules")
    @patch("app.api.onboarding.ModuleAccessRequestRepository")
    def test_approve_merges_modules(self, mock_repo_cls, mock_pool, _audit, mock_merge):
        from app.api.onboarding import ModuleRequestApprove, approve_module_request

        mock_pool.return_value = ["accounting", "banking", "sales", "pos", "inventory"]
        repo = MagicMock()
        mock_repo_cls.return_value = repo
        repo.get.return_value = {
            "id": "req-1",
            "org_id": "org-1",
            "status": "pending",
            "requested_modules": ["sales", "pos", "inventory"],
            "industry_id": "retail",
        }
        repo.update.return_value = {"id": "req-1", "status": "approved"}
        mock_merge.return_value = {"completed": True}

        approve_module_request("req-1", ModuleRequestApprove(), user=_admin())
        mock_merge.assert_called_once()
        args = mock_merge.call_args[0]
        assert "sales" in args[1]
        assert "pos" in args[1]

    @patch("app.api.onboarding.require_module_approval_for_org", return_value=True)
    @patch("app.api.onboarding.user_has_perm", return_value=False)
    def test_put_preferences_blocked_without_approve_perm(self, _perm, _policy):
        from app.api.onboarding import OnboardingPreferencesPayload, upsert_preferences

        with pytest.raises(HTTPException) as exc:
            upsert_preferences(
                OnboardingPreferencesPayload(enabled_modules=["sales"], completed=True),
                user=_user(),
            )
        assert exc.value.status_code == 403

    @patch("app.api.onboarding.assert_modules_allowed", side_effect=ValueError("outside pool"))
    @patch("app.api.onboarding._open_pending_for_user", return_value=None)
    def test_create_request_pool_violation_400(self, _pending, _assert):
        from app.api.onboarding import ModuleRequestCreate, create_module_request

        with pytest.raises(HTTPException) as exc:
            create_module_request(
                ModuleRequestCreate(requested_modules=["manufacturing"]),
                user=_user(),
            )
        assert exc.value.status_code == 400
