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

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# FIX-48: Password policy — minimum 8 chars + 1 upper + 1 digit; reject common weak passwords.
_COMMON_WEAK_PASSWORDS = {
    "12345678", "123456789", "password", "password1", "qwerty12",
    "abc12345", "letmein1", "welcome1", "admin123", "iloveyou1",
    "passw0rd", "111111111", "1qaz2wsx", "qwertyui", "1q2w3e4r",
}


def validate_password_strength(password: str) -> None:
    """Enforce password policy. Raises HTTPException(400) with Kurdish message."""
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
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    # jti enables per-token revocation (logout, password change, admin force-logout)
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4())})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def revoke_token(jti: str, exp: Optional[datetime] = None) -> None:
    """Add a token's jti to the denylist until its natural expiry."""
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
    """Check denylist; cached for 60s to avoid Firestore round-trip per request."""
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


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Get current user from JWT token (returns dict from Firestore)"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="ناسنامەکەت نادروستە",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
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

