"""
Backend JWT authentication service.

This module implements JWT-based API authentication using the HS256 algorithm.
All tokens are signed with the application SECRET_KEY and expire after
ACCESS_TOKEN_EXPIRE_MINUTES (default: 1440 minutes / 24 hours).

Security guarantees:
  - Algorithm: HS256 (HMAC-SHA256) — symmetric, fast, and widely supported.
  - Token expiry: 1440 minutes (24 hours) by default, configurable via
    the ACCESS_TOKEN_EXPIRE_MINUTES setting.
  - Per-token revocation: every token carries a unique ``jti`` (JWT ID) that
    can be added to a denylist (Firestore + in-memory cache) to support
    logout, password-change invalidation, and admin force-logout.
  - SECRET_KEY is NEVER written to logs, error messages, or API responses.

Requirements covered: 6.3, 6.4
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional
import uuid

from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.config import get_settings
from app.firebase_client import get_db
from app.cache import cache

# ─────────────────────────────────────────────────────────────────────────────
# Module-level settings — loaded once at import time via lru_cache.
# ─────────────────────────────────────────────────────────────────────────────
settings = get_settings()

# OAuth2 bearer scheme — clients must send "Authorization: Bearer <token>"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ─────────────────────────────────────────────────────────────────────────────
# Password utilities
# ─────────────────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt.

    Args:
        password: The plain-text password to hash.

    Returns:
        A bcrypt-hashed password string safe for storage.
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# FIX-48: Password policy — minimum 8 chars + 1 upper + 1 digit; reject common weak passwords.
_COMMON_WEAK_PASSWORDS = {
    "12345678", "123456789", "password", "password1", "qwerty12",
    "abc12345", "letmein1", "welcome1", "admin123", "iloveyou1",
    "passw0rd", "111111111", "1qaz2wsx", "qwertyui", "1q2w3e4r",
}


def validate_password_strength(password: str) -> None:
    """Enforce password policy. Raises HTTPException(400) with Kurdish message.

    Policy rules:
      - Minimum 8 characters
      - At least one uppercase letter
      - At least one digit
      - Must not be a known common/weak password

    Args:
        password: The plain-text password to validate.

    Raises:
        HTTPException: 400 Bad Request if the password does not meet policy.
    """
    if not isinstance(password, str) or len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ووشەی نهێنی دەبێت لانیکەم ٨ پیت بێت",
        )
    if not any(c.isupper() for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ووشەی نهێنی دەبێت لانیکەم یەک پیتی گەورە تێدابێت",
        )
    if not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ووشەی نهێنی دەبێت لانیکەم یەک ژمارە تێدابێت",
        )
    if password.lower() in _COMMON_WEAK_PASSWORDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ئەم ووشە نهێنییە زۆر سادەیە و قبووڵ ناکرێت",
        )


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a bcrypt hash.

    Args:
        plain_password: The plain-text password provided by the user.
        hashed_password: The bcrypt hash stored in the database.

    Returns:
        True if the password matches the hash, False otherwise.
    """
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


# ─────────────────────────────────────────────────────────────────────────────
# JWT token creation and validation
# ─────────────────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token using the HS256 algorithm.

    The token is signed with ``settings.SECRET_KEY`` using the HS256
    (HMAC-SHA256) algorithm.  A unique ``jti`` (JWT ID) claim is embedded
    in every token to support per-token revocation.

    Algorithm: HS256 (Requirement 6.3)
    Default expiry: 1440 minutes / 24 hours (Requirement 6.4)

    Args:
        data: Payload claims to embed in the token (e.g. ``sub``, ``org_id``).
        expires_delta: Optional custom expiry duration.  When omitted the
            value from ``settings.ACCESS_TOKEN_EXPIRE_MINUTES`` (1440) is used.

    Returns:
        A signed JWT string.  The SECRET_KEY is never included in the return
        value or any log output.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    # jti enables per-token revocation (logout, password change, admin force-logout)
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4())})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def revoke_token(jti: str, exp: Optional[datetime] = None) -> None:
    """Add a token's jti to the denylist until its natural expiry.

    Revoked tokens are stored in the Firestore ``revoked_tokens`` collection
    and cached in-memory to avoid a Firestore round-trip on every request.

    Args:
        jti: The JWT ID claim from the token to revoke.
        exp: Optional expiry datetime of the token.  Defaults to
            ``now + ACCESS_TOKEN_EXPIRE_MINUTES`` when not provided.
    """
    if not jti:
        return
    db = get_db()
    db.collection("revoked_tokens").document(jti).set({
        "jti": jti,
        "revoked_at": datetime.utcnow().isoformat(),
        "exp": (exp or datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)).isoformat(),
    })
    cache.set(f"revoked_jti:{jti}", True)


def is_token_revoked(jti: str) -> bool:
    """Check whether a token has been revoked.

    Results are cached in-memory for 60 seconds to avoid a Firestore
    round-trip on every authenticated request.

    Args:
        jti: The JWT ID claim to check.

    Returns:
        True if the token has been revoked, False otherwise.
    """
    if not jti:
        return False
    cached = cache.get(f"revoked_jti:{jti}")
    if cached is not None:
        return bool(cached)
    db = get_db()
    doc = db.collection("revoked_tokens").document(jti).get()
    revoked = doc.exists
    cache.set(f"revoked_jti:{jti}", revoked)
    return revoked


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI dependency — resolves the current authenticated user
# ─────────────────────────────────────────────────────────────────────────────

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """FastAPI dependency: decode and validate a Bearer JWT, return the user.

    Validates the token signature (HS256 + SECRET_KEY), checks expiry, and
    rejects tokens that have been explicitly revoked.  The SECRET_KEY is
    never written to logs or included in error responses.

    Args:
        token: Bearer token extracted from the ``Authorization`` header by
            the ``oauth2_scheme`` dependency.

    Returns:
        A dict containing the Firestore user document fields plus ``id`` and
        ``_jti`` (used by the ``/logout`` endpoint for revocation).

    Raises:
        HTTPException: 401 Unauthorized if the token is missing, invalid,
            expired, or revoked, or if the user no longer exists / is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="ناسنامەکەت نادروستە",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],  # HS256
        )
        user_id: str = payload.get("sub")
        org_id: str = payload.get("org_id")
        jti: Optional[str] = payload.get("jti")
        if user_id is None or org_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Reject revoked tokens (logout, password reset, admin force-logout)
    if jti and is_token_revoked(jti):
        raise credentials_exception

    # Get user from Firestore
    db = get_db()
    user_doc = db.collection("users").document(user_id).get()
    if not user_doc.exists:
        raise credentials_exception

    user_data = {"id": user_doc.id, **user_doc.to_dict()}
    if not user_data.get("is_active", False):
        raise credentials_exception
    user_data["_jti"] = jti  # used by /logout endpoint

    return user_data

