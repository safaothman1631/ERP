"""Wave E9 — GDPR delete uses anonymization path."""
from unittest.mock import MagicMock, patch

from app.services.gdpr_service import request_user_deletion


def test_request_user_deletion_anonymizes():
    mock_repo = MagicMock()
    mock_repo.get.return_value = {"org_id": "org-1", "name": "User"}
    mock_repo.update.return_value = {"deletion_status": "pending"}
    with patch("app.services.gdpr_service.UserRepository", return_value=mock_repo):
        out = request_user_deletion("org-1", "u1", requested_by="admin")
    assert out["deletion_status"] == "pending"
    mock_repo.update.assert_called_once()
