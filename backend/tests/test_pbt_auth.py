"""
Property-Based Tests for JWT Token Validity (Property 6).

**Validates: Requirements 2.8, 6.3**

Property 6 (P6):
    ∀ JWT token t: is_valid(t) ↔ t.exp > now() ∧ t.signature_valid ∧ ¬is_revoked(t)

Uses Hypothesis to generate random exp_offset values and verify that
verify_token() correctly classifies tokens as valid or expired.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from hypothesis import given, settings as h_settings, assume
from hypothesis import strategies as st
from jose import jwt

# ─────────────────────────────────────────────────────────────────────────────
# Test settings / mocks
# ─────────────────────────────────────────────────────────────────────────────

_TEST_SECRET = "test-secret-key-that-is-long-enough-for-testing-pbt"
_TEST_ALGORITHM = "HS256"

_MOCK_SETTINGS = MagicMock()
_MOCK_SETTINGS.SECRET_KEY = _TEST_SECRET
_MOCK_SETTINGS.ALGORITHM = _TEST_ALGORITHM
_MOCK_SETTINGS.ACCESS_TOKEN_EXPIRE_MINUTES = 1440
_MOCK_SETTINGS.REFRESH_TOKEN_EXPIRE_DAYS = 7


@pytest.fixture(autouse=True)
def patch_auth_settings():
    """Patch settings and Firestore so tests run without external dependencies."""
    with (
        patch("app.services.auth.settings", _MOCK_SETTINGS),
        patch("app.services.auth.get_db") as mock_db,
        patch("app.services.auth.cache") as mock_cache,
    ):
        # Default: no tokens are revoked
        mock_cache.get.return_value = None
        mock_db.return_value.collection.return_value.document.return_value.get.return_value.exists = False
        yield


# ─────────────────────────────────────────────────────────────────────────────
# P6: JWT Validity Property
# ─────────────────────────────────────────────────────────────────────────────


class TestP6JWTValidity:
    """
    Property 6: دروستی Token Expiry
    **Validates: Requirements 2.8, 6.3**

    ∀ JWT token t: is_valid(t) ↔ t.exp > now() ∧ t.signature_valid ∧ ¬is_revoked(t)
    """

    @given(exp_offset=st.integers(min_value=60, max_value=3600))
    @h_settings(max_examples=50)
    def test_p6_future_token_is_valid(self, exp_offset):
        """
        **Validates: Requirements 2.8, 6.3**

        A token with exp in the future (exp_offset > 0) must be valid.
        """
        from app.services.auth import create_token, verify_token

        token = create_token(exp_offset=exp_offset)
        assert verify_token(token) is True, (
            f"Token with exp_offset={exp_offset}s (future) should be valid"
        )

    @given(exp_offset=st.integers(min_value=-3600, max_value=-1))
    @h_settings(max_examples=50)
    def test_p6_expired_token_is_invalid(self, exp_offset):
        """
        **Validates: Requirements 2.8, 6.3**

        A token with exp in the past (exp_offset < 0) must be invalid.
        """
        from app.services.auth import create_token, verify_token

        token = create_token(exp_offset=exp_offset)
        assert verify_token(token) is False, (
            f"Token with exp_offset={exp_offset}s (past) should be invalid"
        )

    @given(exp_offset=st.integers(min_value=-3600, max_value=3600))
    @h_settings(max_examples=100)
    def test_p6_validity_matches_expiry(self, exp_offset):
        """
        **Validates: Requirements 2.8, 6.3**

        Core P6 property: verify_token(t) == (exp_offset > 0).
        Tokens expiring in the future are valid; tokens already expired are not.
        Note: exp_offset=0 is excluded (boundary — may be valid or expired depending on clock).
        """
        assume(exp_offset != 0)  # exclude exact boundary

        from app.services.auth import create_token, verify_token

        token = create_token(exp_offset=exp_offset)
        is_valid = verify_token(token)
        expected_valid = exp_offset > 0

        assert is_valid == expected_valid, (
            f"verify_token() returned {is_valid} for exp_offset={exp_offset}s, "
            f"expected {expected_valid}"
        )

    def test_p6_tampered_token_is_invalid(self):
        """
        **Validates: Requirements 6.3**

        A token with a tampered signature must be rejected.
        """
        from app.services.auth import create_token, verify_token

        token = create_token(exp_offset=3600)
        # Tamper with the signature (last segment)
        parts = token.split(".")
        assert len(parts) == 3
        tampered = parts[0] + "." + parts[1] + ".invalidsignature"
        assert verify_token(tampered) is False

    def test_p6_revoked_token_is_invalid(self):
        """
        **Validates: Requirements 6.3**

        A token that has been explicitly revoked must be invalid even if not expired.
        """
        from app.services.auth import create_token, verify_token, revoke_token
        from jose import jwt as _jwt

        token = create_token(exp_offset=3600)
        payload = _jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])
        jti = payload["jti"]

        # Revoke the token
        with patch("app.services.auth.get_db") as mock_db:
            mock_db.return_value.collection.return_value.document.return_value.set.return_value = None
            with patch("app.services.auth.cache") as mock_cache:
                # Simulate revoked state: cache returns True for this jti
                mock_cache.get.side_effect = lambda key: True if key == f"revoked_jti:{jti}" else None
                assert verify_token(token) is False, (
                    "Revoked token should be invalid even if not expired"
                )

    def test_p6_empty_token_is_invalid(self):
        """
        **Validates: Requirements 6.3**

        An empty string must not be considered a valid token.
        """
        from app.services.auth import verify_token

        assert verify_token("") is False

    def test_p6_malformed_token_is_invalid(self):
        """
        **Validates: Requirements 6.3**

        A malformed (non-JWT) string must not be considered valid.
        """
        from app.services.auth import verify_token

        assert verify_token("not.a.jwt") is False
        assert verify_token("completely-invalid") is False

    def test_p6_wrong_secret_token_is_invalid(self):
        """
        **Validates: Requirements 6.3**

        A token signed with a different secret must be rejected.
        """
        from app.services.auth import verify_token
        import uuid

        # Create a token signed with a DIFFERENT secret
        payload = {
            "sub": "user-1",
            "org_id": "org-1",
            "exp": datetime.utcnow() + timedelta(hours=1),
            "jti": str(uuid.uuid4()),
        }
        wrong_secret_token = jwt.encode(payload, "wrong-secret-key-totally-different", algorithm="HS256")
        assert verify_token(wrong_secret_token) is False


# ─────────────────────────────────────────────────────────────────────────────
# Additional unit tests for create_token helper
# ─────────────────────────────────────────────────────────────────────────────


class TestCreateTokenHelper:
    """Unit tests for the create_token() helper used in PBT."""

    def test_create_token_positive_offset_produces_future_exp(self):
        """create_token with positive offset must produce a future exp."""
        from app.services.auth import create_token

        token = create_token(exp_offset=3600)
        payload = jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])
        exp = datetime.utcfromtimestamp(payload["exp"])
        assert exp > datetime.utcnow()

    def test_create_token_negative_offset_produces_past_exp(self):
        """create_token with negative offset must produce a past exp."""
        from app.services.auth import create_token
        from jose import JWTError

        token = create_token(exp_offset=-3600)
        # Decoding with expiry check should raise
        with pytest.raises(JWTError):
            jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])

    def test_create_token_includes_jti(self):
        """create_token must include a jti claim."""
        from app.services.auth import create_token

        token = create_token(exp_offset=3600)
        payload = jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])
        assert "jti" in payload and payload["jti"]

    def test_create_token_custom_data(self):
        """create_token must include custom data claims."""
        from app.services.auth import create_token

        token = create_token(exp_offset=3600, data={"sub": "custom-user", "org_id": "custom-org"})
        payload = jwt.decode(token, _TEST_SECRET, algorithms=[_TEST_ALGORITHM])
        assert payload["sub"] == "custom-user"
        assert payload["org_id"] == "custom-org"
