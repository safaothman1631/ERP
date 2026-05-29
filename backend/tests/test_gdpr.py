"""GDPR deletion service tests."""
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.services.gdpr_service import GRACE_DAYS, request_user_deletion, _anon_label


def test_anon_label_stable():
    assert _anon_label("user-abc") == _anon_label("user-abc")
    assert _anon_label("user-abc").startswith("Deleted User ")


@patch("app.services.gdpr_service.UserRepository")
def test_request_user_deletion_requires_existing_user(mock_repo_cls):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.get.return_value = None

    with pytest.raises(ValueError, match="user not found"):
        request_user_deletion("org1", "missing", requested_by="admin1")


@patch("app.services.gdpr_service.UserRepository")
def test_request_user_deletion_schedules_grace(mock_repo_cls):
    mock_repo = MagicMock()
    mock_repo_cls.return_value = mock_repo
    mock_repo.get.return_value = {"id": "u1", "org_id": "org1", "email": "a@b.com"}
    mock_repo.update.return_value = {"id": "u1", "deletion_status": "pending"}

    request_user_deletion("org1", "u1", requested_by="admin1", reason="dsr")

    mock_repo.update.assert_called_once()
    payload = mock_repo.update.call_args[0][1]
    assert payload["deletion_status"] == "pending"
    assert payload["email"] is None
    assert payload["active"] is False
    scheduled = datetime.fromisoformat(payload["deletion_scheduled_at"])
    requested = datetime.fromisoformat(payload["deletion_requested_at"])
    assert (scheduled - requested).days == GRACE_DAYS
