"""
Property-Based Tests for Backup API access control (Property 14).

**Validates: Requirements 10.3**

Property 14: Cross-org download is rejected
    For any user with org_id = A attempting to download a backup record with
    org_id = B where A != B, the endpoint SHALL return HTTP 403 regardless of
    the user's role (admin, owner, or member).
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from hypothesis import assume, given, settings as h_settings
from hypothesis import strategies as st

from app.api.backup import download_backup


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_user(org_id: str, role: str = "admin") -> dict:
    """Return a minimal user dict as returned by get_current_user."""
    return {
        "uid": f"user-{org_id}",
        "org_id": org_id,
        "role": role,
        "email": f"user@{org_id}.example.com",
    }


def _make_backup_doc(backup_id: str, org_id: str) -> MagicMock:
    """Return a mock Firestore document snapshot for a backup record."""
    doc = MagicMock()
    doc.exists = True
    doc.id = backup_id
    doc.to_dict.return_value = {
        "id": backup_id,
        "org_id": org_id,
        "filename": f"backup_20240115_020000.json.gz",
        "storage_path": f"backups/{org_id}/2024-01-15/backup_20240115_020000.json.gz",
        "created_at": "2024-01-15T02:00:00+00:00",
        "status": "success",
        "integrity_status": "verified",
        "total_documents": 42,
        "collections_backed_up": ["users", "invoices"],
        "file_size_bytes": 1024,
        "checksum_sha256": "a" * 64,
        "error_message": None,
    }
    return doc


# ─────────────────────────────────────────────────────────────────────────────
# Property 14: Cross-org download is rejected
# ─────────────────────────────────────────────────────────────────────────────

# Feature: system-health-backup, Property 14
@given(
    org_a=st.text(min_size=1, max_size=50),
    org_b=st.text(min_size=1, max_size=50),
    role=st.sampled_from(["admin", "owner", "member"]),
)
@h_settings(max_examples=100)
def test_property14_cross_org_download_is_rejected(
    org_a: str, org_b: str, role: str
) -> None:
    """
    **Validates: Requirements 10.3**

    # Feature: system-health-backup, Property 14: Cross-org download is rejected

    For any user with org_id = A attempting to download a backup record with
    org_id = B where A != B, the download_backup endpoint SHALL raise HTTP 403
    regardless of the user's role (admin, owner, or member).
    """
    # Ensure the two org IDs are distinct — this is the cross-org scenario
    assume(org_a != org_b)

    backup_id = "backup-doc-id-123"
    user = _make_user(org_id=org_a, role=role)
    backup_doc = _make_backup_doc(backup_id=backup_id, org_id=org_b)

    mock_db = MagicMock()
    mock_db.collection.return_value.document.return_value.get.return_value = backup_doc

    with patch("app.api.backup.get_db", return_value=mock_db):
        with pytest.raises(HTTPException) as exc_info:
            download_backup(backup_id=backup_id, user=user)

    assert exc_info.value.status_code == 403, (
        f"Expected HTTP 403 for cross-org download "
        f"(user org_id={org_a!r}, backup org_id={org_b!r}, role={role!r}), "
        f"but got HTTP {exc_info.value.status_code}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Supplementary unit tests (boundary values and role-specific checks)
# ─────────────────────────────────────────────────────────────────────────────

class TestCrossOrgDownloadUnit:
    """Unit tests that pin specific role and org combinations."""

    def _call(self, user_org: str, backup_org: str, role: str) -> None:
        """Call download_backup with the given org/role combination."""
        backup_id = "test-backup-id"
        user = _make_user(org_id=user_org, role=role)
        backup_doc = _make_backup_doc(backup_id=backup_id, org_id=backup_org)

        mock_db = MagicMock()
        mock_db.collection.return_value.document.return_value.get.return_value = backup_doc

        with patch("app.api.backup.get_db", return_value=mock_db):
            return download_backup(backup_id=backup_id, user=user)

    def test_admin_cross_org_gets_403(self):
        """An admin user requesting a backup from a different org gets HTTP 403."""
        with pytest.raises(HTTPException) as exc_info:
            self._call(user_org="org-a", backup_org="org-b", role="admin")
        assert exc_info.value.status_code == 403

    def test_owner_cross_org_gets_403(self):
        """An owner user requesting a backup from a different org gets HTTP 403."""
        with pytest.raises(HTTPException) as exc_info:
            self._call(user_org="org-a", backup_org="org-b", role="owner")
        assert exc_info.value.status_code == 403

    def test_member_cross_org_gets_403(self):
        """A member user requesting a backup from a different org gets HTTP 403."""
        with pytest.raises(HTTPException) as exc_info:
            self._call(user_org="org-a", backup_org="org-b", role="member")
        assert exc_info.value.status_code == 403

    def test_same_org_admin_does_not_get_403_from_org_check(self):
        """
        A user requesting their own org's backup should NOT be rejected by the
        org-scoping check (HTTP 403 from org mismatch).

        Note: the endpoint may still fail for other reasons (e.g. StorageService
        not configured in tests), but the org-scoping guard must not fire.
        """
        backup_id = "test-backup-id"
        org_id = "org-same"
        user = _make_user(org_id=org_id, role="admin")
        backup_doc = _make_backup_doc(backup_id=backup_id, org_id=org_id)

        mock_db = MagicMock()
        mock_db.collection.return_value.document.return_value.get.return_value = backup_doc

        mock_storage = MagicMock()
        mock_storage.get_signed_url.return_value = "https://storage.example.com/signed-url"

        with patch("app.api.backup.get_db", return_value=mock_db), \
             patch("app.api.backup.StorageService", return_value=mock_storage):
            result = download_backup(backup_id=backup_id, user=user)

        # The org-scoping check must not have raised 403
        assert result["url"] == "https://storage.example.com/signed-url"
        assert result["expires_in_minutes"] == 60

    def test_nonexistent_backup_gets_404(self):
        """Requesting a backup that does not exist returns HTTP 404."""
        backup_id = "nonexistent-id"
        user = _make_user(org_id="org-a", role="admin")

        missing_doc = MagicMock()
        missing_doc.exists = False

        mock_db = MagicMock()
        mock_db.collection.return_value.document.return_value.get.return_value = missing_doc

        with patch("app.api.backup.get_db", return_value=mock_db):
            with pytest.raises(HTTPException) as exc_info:
                download_backup(backup_id=backup_id, user=user)

        assert exc_info.value.status_code == 404

    def test_cross_org_check_fires_before_storage_access(self):
        """
        The org-scoping 403 must be raised before any Cloud Storage access.
        StorageService must never be called for a cross-org request.
        """
        backup_id = "test-backup-id"
        user = _make_user(org_id="org-a", role="admin")
        backup_doc = _make_backup_doc(backup_id=backup_id, org_id="org-b")

        mock_db = MagicMock()
        mock_db.collection.return_value.document.return_value.get.return_value = backup_doc

        mock_storage_class = MagicMock()

        with patch("app.api.backup.get_db", return_value=mock_db), \
             patch("app.api.backup.StorageService", mock_storage_class):
            with pytest.raises(HTTPException) as exc_info:
                download_backup(backup_id=backup_id, user=user)

        assert exc_info.value.status_code == 403
        # StorageService must not have been instantiated or called
        mock_storage_class.assert_not_called()
