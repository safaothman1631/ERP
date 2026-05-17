"""
Backend JWT authentication service.

This module implements JWT-based API authentication using the HS256 algorithm.
All tokens are signed with the application SECRET_KEY and expire after
ACCESS_TOKEN_EXPIRE_MINUTES (default: 1440 minutes / 24 hours).

Security guarantees:
  - Algorithm: HS256 (HMAC-SHA256) — symmetric, fast, and widely supported.
  - Access token expiry: 60 minutes (1 hour) for login-issued tokens.
  - Refresh token expiry: 7 days (Requirement 2.8).
  - Per-token revocation: every token carries a unique ``jti`` (JWT ID) that
    can be added to a denylist (Firestore + in-memory cache) to support
    logout, password-change invalidation, and admin force-logout.
  - SECRET_KEY is NEVER written to logs, error messages, or API responses.
  - Brute-force IP blocking: IPs with excessive failed logins are blocked
    for 24 hours (Requirement 6.11).

Requirements covered: 2.8, 6.3, 6.4, 6.11
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

# Token type claim values
_TOKEN_TYPE_ACCESS = "access"
_TOKEN_TYPE_REFRESH = "refresh"

# Brute-force IP blocking: block after this many failed attempts within the window
_IP_BLOCK_THRESHOLD = 20          # failed attempts across all accounts from one IP
_IP_BLOCK_DURATION_HOURS = 24     # block duration in hours (Requirement 6.11)
_IP_FAIL_WINDOW_MINUTES = 60      # rolling window for counting IP failures


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
    Login-issued expiry: 60 minutes / 1 hour (Requirement 2.8)

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
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4()), "token_type": _TOKEN_TYPE_ACCESS})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a signed JWT refresh token with a 7-day expiry.

    Refresh tokens are long-lived and used to obtain new access tokens
    without requiring the user to re-authenticate.

    Requirement 2.8: refresh token expires after 7 days.

    Args:
        data: Payload claims (e.g. ``sub``, ``org_id``).

    Returns:
        A signed JWT refresh token string.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "jti": str(uuid.uuid4()),
        "token_type": _TOKEN_TYPE_REFRESH,
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_refresh_token(token: str) -> dict:
    """Decode and validate a refresh token.

    Args:
        token: The JWT refresh token string.

    Returns:
        The decoded payload dict.

    Raises:
        HTTPException: 401 if the token is invalid, expired, revoked, or not
            a refresh token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="توکنی نوێکردنەوە نادروستە",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise credentials_exception

    # Must be a refresh token
    if payload.get("token_type") != _TOKEN_TYPE_REFRESH:
        raise credentials_exception

    jti = payload.get("jti")
    if jti and is_token_revoked(jti):
        raise credentials_exception

    return payload


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
# Brute-force IP blocking (Requirement 6.11)
# ─────────────────────────────────────────────────────────────────────────────

def record_ip_failure(ip: str) -> None:
    """Record a failed login attempt for an IP address.

    After ``_IP_BLOCK_THRESHOLD`` failures within ``_IP_FAIL_WINDOW_MINUTES``,
    the IP is blocked for ``_IP_BLOCK_DURATION_HOURS`` hours.

    Args:
        ip: The client IP address string.
    """
    if not ip:
        return
    db = get_db()
    doc_ref = db.collection("ip_login_failures").document(ip)
    doc = doc_ref.get()
    now = datetime.utcnow()

    if doc.exists:
        data = doc.to_dict()
        # Reset counter if the window has passed
        window_start = data.get("window_start")
        if isinstance(window_start, str):
            try:
                window_start = datetime.fromisoformat(window_start)
            except Exception:
                window_start = None
        if window_start and (now - window_start).total_seconds() > _IP_FAIL_WINDOW_MINUTES * 60:
            # New window
            doc_ref.set({
                "ip": ip,
                "fail_count": 1,
                "window_start": now.isoformat(),
                "blocked_until": None,
                "updated_at": now.isoformat(),
            })
            return
        fail_count = int(data.get("fail_count", 0)) + 1
        update: dict = {"fail_count": fail_count, "updated_at": now.isoformat()}
        if fail_count >= _IP_BLOCK_THRESHOLD:
            blocked_until = now + timedelta(hours=_IP_BLOCK_DURATION_HOURS)
            update["blocked_until"] = blocked_until.isoformat()
            update["fail_count"] = 0  # reset after blocking
        doc_ref.update(update)
    else:
        doc_ref.set({
            "ip": ip,
            "fail_count": 1,
            "window_start": now.isoformat(),
            "blocked_until": None,
            "updated_at": now.isoformat(),
        })


def is_ip_blocked(ip: str) -> bool:
    """Check whether an IP address is currently blocked due to brute-force.

    Requirement 6.11: block IPs with excessive failed logins for 24 hours.

    Args:
        ip: The client IP address string.

    Returns:
        True if the IP is currently blocked, False otherwise.
    """
    if not ip:
        return False
    # Check in-memory cache first
    cached = cache.get(f"ip_blocked:{ip}")
    if cached is not None:
        return bool(cached)

    db = get_db()
    doc = db.collection("ip_login_failures").document(ip).get()
    if not doc.exists:
        return False

    data = doc.to_dict()
    blocked_until = data.get("blocked_until")
    if not blocked_until:
        return False

    if isinstance(blocked_until, str):
        try:
            blocked_until = datetime.fromisoformat(blocked_until)
        except Exception:
            return False

    if isinstance(blocked_until, datetime) and blocked_until > datetime.utcnow():
        # Cache the block status for 60 seconds
        cache.set(f"ip_blocked:{ip}", True)
        return True

    return False


def reset_ip_failures(ip: str) -> None:
    """Reset the failure counter for an IP after a successful login.

    Args:
        ip: The client IP address string.
    """
    if not ip:
        return
    try:
        db = get_db()
        db.collection("ip_login_failures").document(ip).delete()
        cache.set(f"ip_blocked:{ip}", False)
    except Exception:
        pass  # Never block a successful login due to cleanup failure


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI dependency — resolves the current authenticated user
# ─────────────────────────────────────────────────────────────────────────────

def create_token(exp_offset: int, data: Optional[dict] = None) -> str:
    """Create a JWT token with a custom expiry offset for testing purposes.

    This helper is used by property-based tests (P6) to generate tokens with
    arbitrary expiry offsets — positive offsets produce valid (future) tokens,
    negative offsets produce expired (past) tokens.

    Args:
        exp_offset: Seconds to add to ``now()`` for the ``exp`` claim.
            Positive → token expires in the future (valid).
            Negative → token already expired (invalid).
        data: Optional payload claims.  Defaults to a minimal test payload.

    Returns:
        A signed JWT string.
    """
    payload = data.copy() if data else {"sub": "test-user", "org_id": "test-org"}
    expire = datetime.utcnow() + timedelta(seconds=exp_offset)
    payload.update({
        "exp": expire,
        "jti": str(uuid.uuid4()),
        "token_type": _TOKEN_TYPE_ACCESS,
    })
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> bool:
    """Verify whether a JWT access token is currently valid.

    A token is considered valid if and only if ALL of the following hold:
      1. The signature is valid (signed with SECRET_KEY using HS256).
      2. The ``exp`` claim is in the future (token has not expired).
      3. The token has not been explicitly revoked (jti not in denylist).

    This function is intentionally non-raising — it returns ``False`` for any
    invalid/expired/revoked token rather than raising an exception, making it
    suitable for use in property-based tests and boolean guard checks.

    Property 6 (P6): is_valid(t) ↔ t.exp > now() ∧ t.signature_valid ∧ ¬is_revoked(t)
    Validates: Requirements 2.8, 6.3

    Args:
        token: The JWT string to validate.

    Returns:
        True if the token is valid, False otherwise.
    """
    if not token:
        return False
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except JWTError:
        # Covers: invalid signature, expired token, malformed token
        return False

    # Check revocation via jti denylist
    jti = payload.get("jti")
    if jti and is_token_revoked(jti):
        return False

    return True


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

