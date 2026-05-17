"""
Unit tests for Task 3.1 — Auth Backend Implementation.

Tests the new functionality added in task 3.1:
  - JWT access token with 1-hour expiry (Requirement 2.8)
  - JWT refresh token with 7-day expiry (Requirement 2.8)
  - verify_refresh_token() validation
  - Brute-force IP blocking (Requirement 6.11)
  - create_refresh_token() structure and claims
"""

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch, call

import pytest
from jose import jwt

# ---------------------------------------------------------------------------
# Shared test fixtures
# ---------------------------------------------------------------------------

_TEST_SECRET = "test-secret-key-that-is-long-enough-for-testing"
_TEST_ALGORITHM = "HS256"

_MOCK_SETTINGS = MagicMock()
_MOCK_SETTINGS.SECRET_KEY = _TEST_SECRET
_MOCK_SETTINGS.ALGORITHM = _TEST_ALGORITHM
_MOCK_SETTINGS.ACCESS_TOKEN_EXPIRE_MINUTES = 1440
_MOCK_SETTINGS.REFRESH_TOKEN_EXPIRE_DAYS = 7


@pytest.fixture(autouse=True)
def patch_settings():
    """Patch settings so tests never touch the real .env file."""
    with patch("app.services.auth.settings", _MOCK_SETTINGS):
        yield


@pytest.fixture()
def mock_db():
    """Return a mock Firestore client."""
    db = MagicMock()
    db.collection.return_value.document.return_value.get.return_value.exists = False
    return db


@pytest.fixture()
def mock_cache():
    """Return a mock in-memory cache (always misses by default)."""
    cache = MagicMock()
    cache.get.return_value = None
    return cache


# ---------------------------------------------------------------------------
# 1. Refresh Token Creation (Requirement 2.8)
# ---------------------------------------------------------------------------


class TestRefreshTokenCreation:
    """Requirement 2.8: refresh token must expire after 7 days."""

    def test_create_refresh_token_returns_string(self):
        """create_refresh_token must return a non-empty string."""
        from app.services.auth import create_refresh_token

        token = create_refresh_token({"sub": "user-1", "org_id": "org-1"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_refresh_token_has_7_day_expiry(self):
        """Refresh token exp claim must be approximately 7 days from now."""
        from app.services.auth import create_refresh_token

        before = datetime.utcnow()
        token = create_refresh_token({"sub": "user-1", "org_id": "org-1"})
        after = datetime.utcnow()

        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])
        exp = datetime.utcfromtimestamp(payload["exp"])

        expected_min = before + timedelta(days=7) - timedelta(seconds=5)
        expected_max = after + timedelta(days=7) + timedelta(seconds=5)

        assert expected_min <= exp <= expected_max, (
            f"Refresh token expiry {exp} is outside the expected 7-day window"
        )

    def test_refresh_token_has_token_type_refresh(self):
        """Refresh token must have token_type='refresh' claim."""
        from app.services.auth import create_refresh_token

        token = create_refresh_token({"sub": "user-1", "org_id": "org-1"})
        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])
        assert payload.get("token_type") == "refresh"

    def test_refresh_token_has_unique_jti(self):
        """Two refresh tokens must have different jti values."""
        from app.services.auth import create_refresh_token

        token_a = create_refresh_token({"sub": "user-1", "org_id": "org-1"})
        token_b = create_refresh_token({"sub": "user-1", "org_id": "org-1"})

        payload_a = jwt.decode(token_a, _TEST_SECRET, algorithms=["HS256"])
        payload_b = jwt.decode(token_b, _TEST_SECRET, algorithms=["HS256"])

        assert payload_a["jti"] != payload_b["jti"]

    def test_refresh_token_preserves_user_claims(self):
        """Refresh token must preserve sub and org_id claims."""
        from app.services.auth import create_refresh_token

        token = create_refresh_token({"sub": "user-42", "org_id": "org-99"})
        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])

        assert payload["sub"] == "user-42"
        assert payload["org_id"] == "org-99"

    def test_refresh_token_uses_hs256(self):
        """Refresh token must use HS256 algorithm."""
        from app.services.auth import create_refresh_token

        token = create_refresh_token({"sub": "user-1", "org_id": "org-1"})
        header = jwt.get_unverified_header(token)
        assert header["alg"] == "HS256"


# ---------------------------------------------------------------------------
# 2. Access Token 1-Hour Expiry (Requirement 2.8)
# ---------------------------------------------------------------------------


class TestAccessToken1HourExpiry:
    """Requirement 2.8: access token issued at login must expire after 1 hour."""

    def test_access_token_with_1h_delta_expires_in_1_hour(self):
        """create_access_token with expires_delta=1h must expire in ~1 hour."""
        from app.services.auth import create_access_token

        before = datetime.utcnow()
        token = create_access_token(
            {"sub": "user-1", "org_id": "org-1"},
            expires_delta=timedelta(hours=1),
        )
        after = datetime.utcnow()

        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])
        exp = datetime.utcfromtimestamp(payload["exp"])

        expected_min = before + timedelta(hours=1) - timedelta(seconds=5)
        expected_max = after + timedelta(hours=1) + timedelta(seconds=5)

        assert expected_min <= exp <= expected_max, (
            f"Access token expiry {exp} is outside the expected 1-hour window"
        )

    def test_access_token_has_token_type_access(self):
        """Access token must have token_type='access' claim."""
        from app.services.auth import create_access_token

        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])
        assert payload.get("token_type") == "access"


# ---------------------------------------------------------------------------
# 3. verify_refresh_token (Requirement 2.8)
# ---------------------------------------------------------------------------


class TestVerifyRefreshToken:
    """Tests for verify_refresh_token() validation."""

    def test_valid_refresh_token_returns_payload(self, mock_db, mock_cache):
        """A valid refresh token must return the decoded payload."""
        from app.services.auth import create_refresh_token, verify_refresh_token

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            token = create_refresh_token({"sub": "user-1", "org_id": "org-1"})
            payload = verify_refresh_token(token)

        assert payload["sub"] == "user-1"
        assert payload["org_id"] == "org-1"
        assert payload["token_type"] == "refresh"

    def test_access_token_rejected_as_refresh_token(self, mock_db, mock_cache):
        """An access token must be rejected by verify_refresh_token."""
        from app.services.auth import create_access_token, verify_refresh_token
        from fastapi import HTTPException

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            access_token = create_access_token({"sub": "user-1", "org_id": "org-1"})
            with pytest.raises(HTTPException) as exc_info:
                verify_refresh_token(access_token)

        assert exc_info.value.status_code == 401

    def test_expired_refresh_token_raises_401(self, mock_db, mock_cache):
        """An expired refresh token must raise HTTPException 401."""
        from app.services.auth import verify_refresh_token
        from fastapi import HTTPException

        # Create an already-expired refresh token manually
        payload = {
            "sub": "user-1",
            "org_id": "org-1",
            "token_type": "refresh",
            "jti": "test-jti",
            "exp": datetime.utcnow() - timedelta(seconds=1),
        }
        expired_token = jwt.encode(payload, _TEST_SECRET, algorithm="HS256")

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            with pytest.raises(HTTPException) as exc_info:
                verify_refresh_token(expired_token)

        assert exc_info.value.status_code == 401

    def test_invalid_token_raises_401(self, mock_db, mock_cache):
        """A malformed token must raise HTTPException 401."""
        from app.services.auth import verify_refresh_token
        from fastapi import HTTPException

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            with pytest.raises(HTTPException) as exc_info:
                verify_refresh_token("not.a.valid.token")

        assert exc_info.value.status_code == 401

    def test_revoked_refresh_token_raises_401(self, mock_db, mock_cache):
        """A revoked refresh token must raise HTTPException 401."""
        from app.services.auth import create_refresh_token, verify_refresh_token
        from fastapi import HTTPException

        # Make cache return True (token is revoked)
        mock_cache.get.return_value = True

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            token = create_refresh_token({"sub": "user-1", "org_id": "org-1"})
            with pytest.raises(HTTPException) as exc_info:
                verify_refresh_token(token)

        assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# 4. IP Brute-Force Blocking (Requirement 6.11)
# ---------------------------------------------------------------------------


class TestIPBruteForceBlocking:
    """Requirement 6.11: block IPs with excessive failed logins for 24 hours."""

    def test_is_ip_blocked_returns_false_for_unknown_ip(self, mock_db, mock_cache):
        """An IP with no failure record must not be blocked."""
        from app.services.auth import is_ip_blocked

        mock_db.collection.return_value.document.return_value.get.return_value.exists = False

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            result = is_ip_blocked("192.168.1.1")

        assert result is False

    def test_is_ip_blocked_returns_false_for_empty_ip(self, mock_db, mock_cache):
        """An empty IP string must not be blocked."""
        from app.services.auth import is_ip_blocked

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            result = is_ip_blocked("")

        assert result is False

    def test_is_ip_blocked_returns_true_when_blocked_until_in_future(self, mock_db, mock_cache):
        """An IP with blocked_until in the future must be blocked."""
        from app.services.auth import is_ip_blocked

        future = (datetime.utcnow() + timedelta(hours=23)).isoformat()
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {"blocked_until": future}
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            result = is_ip_blocked("10.0.0.1")

        assert result is True

    def test_is_ip_blocked_returns_false_when_block_expired(self, mock_db, mock_cache):
        """An IP whose block has expired must not be blocked."""
        from app.services.auth import is_ip_blocked

        past = (datetime.utcnow() - timedelta(hours=1)).isoformat()
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {"blocked_until": past}
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            result = is_ip_blocked("10.0.0.1")

        assert result is False

    def test_is_ip_blocked_uses_cache(self, mock_db, mock_cache):
        """is_ip_blocked must use cache to avoid Firestore round-trips."""
        from app.services.auth import is_ip_blocked

        mock_cache.get.return_value = True  # cache hit: blocked

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            result = is_ip_blocked("10.0.0.1")

        assert result is True
        # Firestore should NOT be called when cache hits
        mock_db.collection.assert_not_called()

    def test_record_ip_failure_creates_new_record(self, mock_db, mock_cache):
        """record_ip_failure must create a new record for a new IP."""
        from app.services.auth import record_ip_failure

        mock_doc = MagicMock()
        mock_doc.exists = False
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            record_ip_failure("192.168.1.100")

        # Should call set() to create the record
        mock_db.collection.return_value.document.return_value.set.assert_called_once()
        call_args = mock_db.collection.return_value.document.return_value.set.call_args[0][0]
        assert call_args["fail_count"] == 1
        assert call_args["ip"] == "192.168.1.100"

    def test_record_ip_failure_increments_existing_count(self, mock_db, mock_cache):
        """record_ip_failure must increment the fail_count for an existing IP."""
        from app.services.auth import record_ip_failure

        # Existing record with 5 failures, within the window
        window_start = (datetime.utcnow() - timedelta(minutes=10)).isoformat()
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "fail_count": 5,
            "window_start": window_start,
            "blocked_until": None,
        }
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            record_ip_failure("192.168.1.100")

        mock_db.collection.return_value.document.return_value.update.assert_called_once()
        update_args = mock_db.collection.return_value.document.return_value.update.call_args[0][0]
        assert update_args["fail_count"] == 6

    def test_record_ip_failure_blocks_after_threshold(self, mock_db, mock_cache):
        """record_ip_failure must set blocked_until after reaching the threshold."""
        from app.services.auth import record_ip_failure, _IP_BLOCK_THRESHOLD

        # Existing record at threshold - 1 failures
        window_start = (datetime.utcnow() - timedelta(minutes=10)).isoformat()
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "fail_count": _IP_BLOCK_THRESHOLD - 1,
            "window_start": window_start,
            "blocked_until": None,
        }
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            record_ip_failure("192.168.1.100")

        update_args = mock_db.collection.return_value.document.return_value.update.call_args[0][0]
        assert "blocked_until" in update_args
        assert update_args["blocked_until"] is not None

    def test_reset_ip_failures_deletes_record(self, mock_db, mock_cache):
        """reset_ip_failures must delete the IP failure record."""
        from app.services.auth import reset_ip_failures

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            reset_ip_failures("192.168.1.100")

        mock_db.collection.return_value.document.return_value.delete.assert_called_once()

    def test_reset_ip_failures_clears_cache(self, mock_db, mock_cache):
        """reset_ip_failures must clear the IP block cache entry."""
        from app.services.auth import reset_ip_failures

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            reset_ip_failures("192.168.1.100")

        mock_cache.set.assert_called_with("ip_blocked:192.168.1.100", False)

    def test_record_ip_failure_noop_for_empty_ip(self, mock_db, mock_cache):
        """record_ip_failure must be a no-op for empty IP strings."""
        from app.services.auth import record_ip_failure

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            record_ip_failure("")  # Should not raise

        mock_db.collection.assert_not_called()


# ---------------------------------------------------------------------------
# 5. Config Settings (Requirement 2.8)
# ---------------------------------------------------------------------------


class TestConfigSettings:
    """Verify new config settings for token expiry."""

    def test_refresh_token_expire_days_default_is_7(self):
        """REFRESH_TOKEN_EXPIRE_DAYS must default to 7."""
        from app.config import Settings

        s = Settings()
        assert s.REFRESH_TOKEN_EXPIRE_DAYS == 7

    def test_access_token_expire_minutes_short_default_is_60(self):
        """ACCESS_TOKEN_EXPIRE_MINUTES_SHORT must default to 60."""
        from app.config import Settings

        s = Settings()
        assert s.ACCESS_TOKEN_EXPIRE_MINUTES_SHORT == 60
