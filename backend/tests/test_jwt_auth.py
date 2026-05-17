"""
Unit tests for JWT authentication in backend/app/services/auth.py.

Covers:
  - JWT uses HS256 algorithm                        (Requirement 6.3)
  - Token expiration is set to 1440 minutes (24h)   (Requirement 6.4)
  - SECRET_KEY is never logged or exposed            (Requirement 2.5)
  - Token creation, decoding, and revocation logic
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from jose import jwt

# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

# A strong test secret that satisfies the 32-char minimum
_TEST_SECRET = "test-secret-key-that-is-long-enough-for-testing"
_TEST_ALGORITHM = "HS256"

# Minimal settings mock
_MOCK_SETTINGS = MagicMock()
_MOCK_SETTINGS.SECRET_KEY = _TEST_SECRET
_MOCK_SETTINGS.ALGORITHM = _TEST_ALGORITHM
_MOCK_SETTINGS.ACCESS_TOKEN_EXPIRE_MINUTES = 1440


@pytest.fixture(autouse=True)
def patch_settings():
    """Patch get_settings() so tests never touch the real .env file."""
    with patch("app.services.auth.settings", _MOCK_SETTINGS):
        yield


# ---------------------------------------------------------------------------
# 1. Algorithm — HS256
# ---------------------------------------------------------------------------


class TestJWTAlgorithm:
    """Requirement 6.3: JWT must use the HS256 algorithm."""

    def test_create_access_token_uses_hs256(self):
        """Token header must declare alg=HS256."""
        from app.services.auth import create_access_token

        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        # Decode without verification to inspect the header
        header = jwt.get_unverified_header(token)
        assert header["alg"] == "HS256", (
            f"Expected alg=HS256 in token header, got {header['alg']!r}"
        )

    def test_token_is_verifiable_with_hs256(self):
        """Token must be verifiable using HS256 and the correct secret."""
        from app.services.auth import create_access_token

        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])
        assert payload["sub"] == "user-1"
        assert payload["org_id"] == "org-1"

    def test_token_rejected_with_wrong_algorithm(self):
        """A token decoded with a different algorithm must raise JWTError."""
        from app.services.auth import create_access_token
        from jose import JWTError

        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        with pytest.raises(JWTError):
            jwt.decode(token, _TEST_SECRET, algorithms=["RS256"])

    def test_settings_algorithm_is_hs256(self):
        """The ALGORITHM setting must be 'HS256'."""
        # Verify the real config default (not the mock)
        from app.config import Settings

        s = Settings()
        assert s.ALGORITHM == "HS256"


# ---------------------------------------------------------------------------
# 2. Token expiration — 1440 minutes (24 hours)
# ---------------------------------------------------------------------------


class TestTokenExpiration:
    """Requirement 6.4: Token expiration must default to 1440 minutes (24 hours)."""

    def test_default_expiry_is_1440_minutes(self):
        """Token exp claim must be approximately 1440 minutes from now."""
        from app.services.auth import create_access_token

        before = datetime.utcnow()
        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        after = datetime.utcnow()

        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])
        exp = datetime.utcfromtimestamp(payload["exp"])

        # Allow ±5 seconds of clock drift
        expected_min = before + timedelta(minutes=1440) - timedelta(seconds=5)
        expected_max = after + timedelta(minutes=1440) + timedelta(seconds=5)

        assert expected_min <= exp <= expected_max, (
            f"Token expiry {exp} is outside the expected 24-hour window "
            f"[{expected_min}, {expected_max}]"
        )

    def test_settings_expire_minutes_is_1440(self):
        """The ACCESS_TOKEN_EXPIRE_MINUTES setting must default to 1440."""
        from app.config import Settings

        s = Settings()
        assert s.ACCESS_TOKEN_EXPIRE_MINUTES == 1440, (
            f"Expected ACCESS_TOKEN_EXPIRE_MINUTES=1440, got {s.ACCESS_TOKEN_EXPIRE_MINUTES}"
        )

    def test_custom_expiry_overrides_default(self):
        """Passing expires_delta must override the 1440-minute default."""
        from app.services.auth import create_access_token

        custom_delta = timedelta(minutes=30)
        before = datetime.utcnow()
        token = create_access_token(
            {"sub": "user-1", "org_id": "org-1"},
            expires_delta=custom_delta,
        )
        after = datetime.utcnow()

        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])
        exp = datetime.utcfromtimestamp(payload["exp"])

        expected_min = before + custom_delta - timedelta(seconds=5)
        expected_max = after + custom_delta + timedelta(seconds=5)

        assert expected_min <= exp <= expected_max, (
            f"Custom expiry {exp} is outside the expected 30-minute window"
        )

    def test_expired_token_raises_jwt_error(self):
        """A token with a past expiry must be rejected on decode."""
        from app.services.auth import create_access_token
        from jose import JWTError

        token = create_access_token(
            {"sub": "user-1", "org_id": "org-1"},
            expires_delta=timedelta(seconds=-1),  # already expired
        )
        with pytest.raises(JWTError):
            jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])


# ---------------------------------------------------------------------------
# 3. Token structure — jti claim
# ---------------------------------------------------------------------------


class TestTokenStructure:
    """Tokens must include a unique jti claim for revocation support."""

    def test_token_contains_jti_claim(self):
        """Every token must include a non-empty jti claim."""
        from app.services.auth import create_access_token

        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])
        assert "jti" in payload
        assert payload["jti"]  # non-empty

    def test_each_token_has_unique_jti(self):
        """Two tokens created from the same data must have different jti values."""
        from app.services.auth import create_access_token

        token_a = create_access_token({"sub": "user-1", "org_id": "org-1"})
        token_b = create_access_token({"sub": "user-1", "org_id": "org-1"})

        payload_a = jwt.decode(token_a, _TEST_SECRET, algorithms=["HS256"])
        payload_b = jwt.decode(token_b, _TEST_SECRET, algorithms=["HS256"])

        assert payload_a["jti"] != payload_b["jti"], (
            "Two tokens for the same user must have distinct jti values"
        )

    def test_token_payload_preserves_custom_claims(self):
        """Custom claims in the data dict must be present in the decoded token."""
        from app.services.auth import create_access_token

        data = {"sub": "user-42", "org_id": "org-99", "role": "admin"}
        token = create_access_token(data)
        payload = jwt.decode(token, _TEST_SECRET, algorithms=["HS256"])

        assert payload["sub"] == "user-42"
        assert payload["org_id"] == "org-99"
        assert payload["role"] == "admin"


# ---------------------------------------------------------------------------
# 4. SECRET_KEY safety — never logged or exposed
# ---------------------------------------------------------------------------


class TestSecretKeySafety:
    """Requirement 2.5: SECRET_KEY must never appear in logs or API responses."""

    def test_secret_key_not_in_settings_repr(self):
        """Settings.__repr__ must not include the SECRET_KEY value."""
        from app.config import Settings

        s = Settings(SECRET_KEY="my-super-secret-key-that-must-not-leak")
        repr_str = repr(s)
        assert "my-super-secret-key-that-must-not-leak" not in repr_str, (
            f"SECRET_KEY value leaked in Settings repr: {repr_str!r}"
        )

    def test_secret_key_repr_shows_redacted(self):
        """Settings.__repr__ must show '<redacted>' instead of the key value."""
        from app.config import Settings

        s = Settings()
        assert "<redacted>" in repr(s)

    def test_create_access_token_does_not_log_secret(self, caplog):
        """create_access_token must not write the SECRET_KEY to any log."""
        from app.services.auth import create_access_token

        with caplog.at_level(logging.DEBUG):
            create_access_token({"sub": "user-1", "org_id": "org-1"})

        for message in caplog.messages:
            assert _TEST_SECRET not in message, (
                f"SECRET_KEY leaked into log: {message!r}"
            )

    def test_token_does_not_contain_secret_key(self):
        """The JWT string itself must not contain the SECRET_KEY."""
        from app.services.auth import create_access_token

        token = create_access_token({"sub": "user-1", "org_id": "org-1"})
        assert _TEST_SECRET not in token, (
            "SECRET_KEY must not appear in the JWT string"
        )


# ---------------------------------------------------------------------------
# 5. Password utilities
# ---------------------------------------------------------------------------


class TestPasswordUtilities:
    """Basic sanity checks for hash_password and verify_password."""

    def test_hash_password_returns_bcrypt_hash(self):
        """hash_password must return a bcrypt hash string."""
        from app.services.auth import hash_password

        hashed = hash_password("TestPassword1")
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")

    def test_verify_password_correct(self):
        """verify_password must return True for a matching password."""
        from app.services.auth import hash_password, verify_password

        hashed = hash_password("TestPassword1")
        assert verify_password("TestPassword1", hashed) is True

    def test_verify_password_wrong(self):
        """verify_password must return False for a non-matching password."""
        from app.services.auth import hash_password, verify_password

        hashed = hash_password("TestPassword1")
        assert verify_password("WrongPassword1", hashed) is False

    def test_validate_password_strength_too_short(self):
        """Passwords shorter than 8 characters must be rejected."""
        from app.services.auth import validate_password_strength
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            validate_password_strength("Ab1")
        assert exc_info.value.status_code == 400

    def test_validate_password_strength_no_uppercase(self):
        """Passwords without an uppercase letter must be rejected."""
        from app.services.auth import validate_password_strength
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            validate_password_strength("password1")
        assert exc_info.value.status_code == 400

    def test_validate_password_strength_no_digit(self):
        """Passwords without a digit must be rejected."""
        from app.services.auth import validate_password_strength
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            validate_password_strength("Password")
        assert exc_info.value.status_code == 400

    def test_validate_password_strength_common_password(self):
        """Common/weak passwords must be rejected."""
        from app.services.auth import validate_password_strength
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            validate_password_strength("Password1")  # "password1" is in the blocklist
        assert exc_info.value.status_code == 400

    def test_validate_password_strength_valid(self):
        """A strong password must pass validation without raising."""
        from app.services.auth import validate_password_strength

        # Should not raise
        validate_password_strength("Str0ng!Pass#2024")
