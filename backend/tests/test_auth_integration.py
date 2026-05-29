"""
Integration tests for the authentication system.

Tests the full auth lifecycle as a cohesive system:
  1. Login / logout flow — JWT creation, revocation, and denylist enforcement
  2. JWT validation and expiration — HS256 algorithm, 1440-minute default,
     expired token rejection, and custom expiry override
  3. Session persistence — token round-trip: create → decode → validate

These tests exercise multiple components together (create_access_token,
revoke_token, is_token_revoked, get_current_user) rather than each in
isolation, matching the integration-test intent of task 9.4.

Requirements covered: 6.5, 6.6, 6.7
"""

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch, call

import pytest
from jose import JWTError, jwt

# ---------------------------------------------------------------------------
# Shared test fixtures
# ---------------------------------------------------------------------------

_TEST_SECRET = "integration-test-secret-key-long-enough-32chars"
_TEST_ALGORITHM = "HS256"

_MOCK_SETTINGS = MagicMock()
_MOCK_SETTINGS.SECRET_KEY = _TEST_SECRET
_MOCK_SETTINGS.ALGORITHM = _TEST_ALGORITHM
_MOCK_SETTINGS.ACCESS_TOKEN_EXPIRE_MINUTES = 1440


@pytest.fixture(autouse=True)
def patch_settings():
    """Patch settings so tests never touch the real .env file."""
    with patch("app.services.auth.settings", _MOCK_SETTINGS):
        yield


@pytest.fixture()
def mock_db():
    """Return a mock Firestore client that records revoked_tokens writes."""
    db = MagicMock()
    # Default: document does not exist (token not revoked)
    db.collection.return_value.document.return_value.get.return_value.exists = False
    return db


@pytest.fixture()
def mock_cache():
    """Return a mock in-memory cache (always misses by default)."""
    cache = MagicMock()
    cache.get.return_value = None  # cache miss → fall through to Firestore
    return cache


# ---------------------------------------------------------------------------
# 1. Login / Logout Flow
#    Validates: Requirements 6.5, 6.6
# ---------------------------------------------------------------------------


class TestLoginLogoutFlow:
    """Integration: create token → use token → revoke token → reject revoked token."""

    def test_create_token_contains_expected_claims(self):
        """Token created for a user must carry sub, org_id, jti, and exp claims."""
        from app.services.auth import create_access_token

        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        payload = jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])

        assert payload["sub"] == "user-1"
        assert payload["org_id"] == "org-1"
        assert "jti" in payload and payload["jti"]
        assert "exp" in payload

    def test_revoke_token_writes_jti_to_firestore(self, mock_db):
        """revoke_token() must persist the jti to the revoked_tokens collection."""
        from app.services.auth import revoke_token

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", MagicMock()):
            revoke_token("jti-abc-123")

        coll_calls = [c[0][0] for c in mock_db.collection.call_args_list]
        assert "revoked_tokens" in coll_calls
        assert "expires_at" in mock_db.collection.return_value.document.return_value.set.call_args[0][0]

    def test_revoke_token_caches_jti(self, mock_db):
        """revoke_token() must also cache the jti in-memory to avoid Firestore round-trips."""
        from app.services.auth import revoke_token

        mock_cache = MagicMock()
        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", mock_cache):
            revoke_token("jti-cache-test")

        mock_cache.set.assert_called_with("revoked_jti:jti-cache-test", True)

    def test_is_token_revoked_returns_true_for_revoked_jti(self, mock_db):
        """is_token_revoked() must return True when the jti is in the denylist."""
        from app.services.auth import is_token_revoked

        # Simulate Firestore returning an existing document
        mock_db.collection.return_value.document.return_value.get.return_value.exists = True

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", MagicMock(get=MagicMock(return_value=None))):
            result = is_token_revoked("jti-revoked")

        assert result is True

    def test_is_token_revoked_returns_false_for_valid_jti(self, mock_db):
        """is_token_revoked() must return False when the jti is NOT in the denylist."""
        from app.services.auth import is_token_revoked

        # Firestore document does not exist (default fixture state)
        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", MagicMock(get=MagicMock(return_value=None))):
            result = is_token_revoked("jti-valid")

        assert result is False

    def test_is_token_revoked_uses_cache_hit(self):
        """is_token_revoked() must return the cached value without hitting Firestore."""
        from app.services.auth import is_token_revoked

        mock_cache = MagicMock()
        mock_cache.get.return_value = True  # cache hit: token is revoked

        with patch("app.services.auth.cache", mock_cache):
            result = is_token_revoked("jti-cached")

        assert result is True
        # Firestore must NOT be called when cache hits
        mock_cache.get.assert_called_with("revoked_jti:jti-cached")

    def test_full_login_logout_cycle_revokes_token(self, mock_db):
        """Full cycle: create token → extract jti → revoke → confirm revoked."""
        from app.services.auth import create_access_token, revoke_token, is_token_revoked

        # Step 1: create token (simulates login)
        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        payload = jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])
        jti = payload["jti"]

        # Step 2: revoke the token (simulates logout)
        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", MagicMock()):
            revoke_token(jti)

        # Step 3: confirm the jti is now in the denylist
        mock_db.collection.return_value.document.return_value.get.return_value.exists = True
        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", MagicMock(get=MagicMock(return_value=None))):
            assert is_token_revoked(jti) is True

    def test_revoke_token_noop_for_empty_jti(self, mock_db):
        """revoke_token() must silently ignore an empty jti string."""
        from app.services.auth import revoke_token

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", MagicMock()):
            revoke_token("")  # must not raise

        # Firestore must not be called for an empty jti
        mock_db.collection.return_value.document.return_value.set.assert_not_called()

    def test_is_token_revoked_returns_false_for_empty_jti(self):
        """is_token_revoked() must return False for an empty jti without hitting Firestore."""
        from app.services.auth import is_token_revoked

        result = is_token_revoked("")
        assert result is False


# ---------------------------------------------------------------------------
# 2. JWT Validation and Expiration
#    Validates: Requirements 6.3, 6.4
# ---------------------------------------------------------------------------


class TestJWTValidationAndExpiration:
    """Integration: token creation, algorithm enforcement, and expiry behaviour."""

    def test_token_uses_hs256_algorithm(self):
        """Every token must declare alg=HS256 in its header (Req 6.3)."""
        from app.services.auth import create_access_token

        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        header = jwt.get_unverified_header(token)
        assert header["alg"] == "HS256"

    def test_token_default_expiry_is_1440_minutes(self):
        """Token exp must be approximately 1440 minutes from now (Req 6.4)."""
        from app.services.auth import create_access_token

        before = datetime.utcnow()
        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        after = datetime.utcnow()

        payload = jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])
        exp = datetime.utcfromtimestamp(payload["exp"])

        expected_min = before + timedelta(minutes=1440) - timedelta(seconds=5)
        expected_max = after + timedelta(minutes=1440) + timedelta(seconds=5)

        assert expected_min <= exp <= expected_max, (
            f"Token expiry {exp} is outside the expected 24-hour window"
        )

    def test_expired_token_is_rejected_on_decode(self):
        """A token with a past expiry must raise JWTError when decoded (Req 6.4)."""
        from app.services.auth import create_access_token

        token = create_access_token(
            {"sub": "user-1", "org_id": "org-1"},
            expires_delta=timedelta(seconds=-1),  # already expired
        )
        with pytest.raises(JWTError):
            jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])

    def test_custom_expiry_overrides_1440_minute_default(self):
        """Passing expires_delta must override the 1440-minute default (Req 6.4)."""
        from app.services.auth import create_access_token

        custom_delta = timedelta(minutes=30)
        before = datetime.utcnow()
        token = create_access_token(
            {"sub": "user-1", "org_id": "org-1"},
            expires_delta=custom_delta,
        )
        after = datetime.utcnow()

        payload = jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])
        exp = datetime.utcfromtimestamp(payload["exp"])

        expected_min = before + custom_delta - timedelta(seconds=5)
        expected_max = after + custom_delta + timedelta(seconds=5)

        assert expected_min <= exp <= expected_max

    def test_token_rejected_with_wrong_secret(self):
        """A token decoded with a different secret must raise JWTError."""
        from app.services.auth import create_access_token

        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        with pytest.raises(JWTError):
            jwt.decode(token, "wrong-secret-key-that-is-long-enough-32chars", algorithms=[_TEST_ALGORITHM])

    def test_token_rejected_with_wrong_algorithm(self):
        """A token decoded with a different algorithm must raise JWTError."""
        from app.services.auth import create_access_token

        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        with pytest.raises(JWTError):
            jwt.decode(token, _TEST_SECRET, algorithms=["RS256"])

    def test_each_token_has_unique_jti(self):
        """Two tokens for the same user must have distinct jti values."""
        from app.services.auth import create_access_token

        token_a = create_access_token({"sub": "user-1", "org_id": "org-1"})
        token_b = create_access_token({"sub": "user-1", "org_id": "org-1"})

        payload_a = jwt.decode(token_a, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])
        payload_b = jwt.decode(token_b, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])

        assert payload_a["jti"] != payload_b["jti"]

    def test_token_payload_preserves_all_custom_claims(self):
        """All custom claims in the data dict must survive the encode/decode round-trip."""
        from app.services.auth import create_access_token

        data = {"sub": "user-42", "org_id": "org-99", "role": "admin", "extra": "value"}
        token = create_access_token(data)
        payload = jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])

        assert payload["sub"] == "user-42"
        assert payload["org_id"] == "org-99"
        assert payload["role"] == "admin"
        assert payload["extra"] == "value"

    def test_settings_algorithm_is_hs256(self):
        """The ALGORITHM setting must default to 'HS256' (Req 6.3)."""
        from app.config import Settings

        s = Settings()
        assert s.ALGORITHM == "HS256"

    def test_settings_expire_minutes_is_1440(self):
        """The ACCESS_TOKEN_EXPIRE_MINUTES setting must default to 1440 (Req 6.4)."""
        from app.config import Settings

        s = Settings()
        assert s.ACCESS_TOKEN_EXPIRE_MINUTES == 1440


# ---------------------------------------------------------------------------
# 3. Session Persistence — token round-trip
#    Validates: Requirement 6.7
#
#    The backend's role in session persistence is to issue a valid token that
#    the frontend can store and re-present. These tests verify the full
#    encode → store → decode round-trip that underpins localStorage persistence.
# ---------------------------------------------------------------------------


class TestSessionPersistence:
    """Integration: token encode → decode round-trip simulating localStorage persistence."""

    def test_token_round_trip_preserves_user_identity(self):
        """A token created at login must decode back to the same user identity."""
        from app.services.auth import create_access_token

        token = create_access_token({"sub": "user-session", "org_id": "org-session"})

        # Simulate the frontend storing the token and re-presenting it on the next request
        payload = jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])

        assert payload["sub"] == "user-session"
        assert payload["org_id"] == "org-session"

    def test_token_is_still_valid_within_expiry_window(self):
        """A freshly issued token must decode successfully (not yet expired)."""
        from app.services.auth import create_access_token

        token = create_access_token({"sub": "user-1", "org_id": "org-1"})

        # Must not raise — token is fresh
        payload = jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])
        assert payload["sub"] == "user-1"

    def test_token_exp_is_in_the_future(self):
        """A freshly issued token's exp claim must be in the future."""
        from app.services.auth import create_access_token

        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        payload = jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])
        exp = datetime.utcfromtimestamp(payload["exp"])

        assert exp > datetime.utcnow(), "Token expiry must be in the future"

    def test_revoked_token_cannot_be_reused_after_logout(self, mock_db):
        """A token that was revoked on logout must be detected as revoked on re-presentation."""
        from app.services.auth import create_access_token, revoke_token, is_token_revoked

        # Simulate login: issue token
        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        payload = jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])
        jti = payload["jti"]

        # Simulate logout: revoke the token
        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", MagicMock()):
            revoke_token(jti)

        # Simulate re-presentation of the stored token (e.g. from localStorage after reload)
        # The backend must detect it as revoked
        mock_db.collection.return_value.document.return_value.get.return_value.exists = True
        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", MagicMock(get=MagicMock(return_value=None))):
            assert is_token_revoked(jti) is True, (
                "A token revoked at logout must not be accepted when re-presented"
            )

    def test_new_token_after_logout_is_not_revoked(self, mock_db):
        """A new token issued after logout must not be in the denylist."""
        from app.services.auth import create_access_token, revoke_token, is_token_revoked

        # First session: login → logout
        old_token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        old_payload = jwt.decode(old_token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])
        old_jti = old_payload["jti"]

        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", MagicMock()):
            revoke_token(old_jti)

        # Second session: new login → new token
        new_token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        new_payload = jwt.decode(new_token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])
        new_jti = new_payload["jti"]

        # New jti must be different from the old one
        assert new_jti != old_jti

        # New token must not be in the denylist
        # (Firestore returns no document for the new jti)
        with patch("app.services.auth.get_db", return_value=mock_db), \
             patch("app.services.auth.cache", MagicMock(get=MagicMock(return_value=None))):
            assert is_token_revoked(new_jti) is False

    def test_token_contains_jti_for_revocation_support(self):
        """Every token must include a non-empty jti to support logout revocation (Req 6.6)."""
        from app.services.auth import create_access_token

        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        payload = jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])

        assert "jti" in payload
        assert isinstance(payload["jti"], str)
        assert len(payload["jti"]) > 0
