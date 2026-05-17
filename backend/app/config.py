"""
Backend environment configuration.

Uses pydantic-settings (BaseSettings) to load values from environment variables
and the .env file.  A validate_env() function performs startup checks that are
environment-aware:

  * production  → hard-fail (sys.exit) on any missing or insecure value
  * development → log warnings but continue

SECRET_KEY is NEVER written to logs or error messages.
"""

from __future__ import annotations

import logging
import os
import sys
from functools import lru_cache

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Cloud Run identity markers (used to detect workload-identity / ADC)
# ─────────────────────────────────────────────────────────────────────────────
_CLOUD_RUN_ENV_MARKERS: tuple[str, ...] = (
    "K_SERVICE",
    "K_REVISION",
    "K_CONFIGURATION",
)

# ─────────────────────────────────────────────────────────────────────────────
# Variables that MUST be explicitly set in production
# ─────────────────────────────────────────────────────────────────────────────
_REQUIRED_PROD_VARS: list[str] = [
    "SECRET_KEY",
    "DATABASE_URL",
    "CORS_ORIGINS",
    "ENVIRONMENT",
]

# ─────────────────────────────────────────────────────────────────────────────
# Insecure dev-only defaults — if these values reach production we block startup
# ─────────────────────────────────────────────────────────────────────────────
_INSECURE_DEFAULTS: dict[str, str] = {
    "SECRET_KEY": "dev-only-insecure-key-change-me-in-production",
    "DATABASE_URL": "sqlite:///./zoho_books.db",
}

# Minimum acceptable SECRET_KEY length (characters)
_MIN_SECRET_KEY_LENGTH = 32


# ─────────────────────────────────────────────────────────────────────────────
# Settings model
# ─────────────────────────────────────────────────────────────────────────────

class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file.

    All fields have sensible development defaults so the app starts without
    any configuration on a fresh clone.  Production deployments MUST override
    the values flagged as insecure defaults.
    """

    # ── Core ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "Zoho Books Local"
    ENVIRONMENT: str = "development"  # "development" | "production"
    DEBUG: bool = False

    # ── Security ──────────────────────────────────────────────────────────────
    # NOTE: SECRET_KEY is intentionally excluded from __repr__ / logs.
    SECRET_KEY: str = "dev-only-insecure-key-change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours (legacy default; login uses 60 min)
    # Requirement 2.8: access token = 1 hour, refresh token = 7 days
    ACCESS_TOKEN_EXPIRE_MINUTES_SHORT: int = 60   # 1 hour for login-issued access tokens
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7            # 7 days for refresh tokens
    ALGORITHM: str = "HS256"

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./zoho_books.db"

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://localhost:3000"
    )

    # ── Firebase ──────────────────────────────────────────────────────────────
    FIREBASE_CREDENTIALS_PATH: str = "serviceAccountKey.json"
    FIREBASE_STORAGE_BUCKET: str = ""

    # ── File paths ────────────────────────────────────────────────────────────
    UPLOAD_DIR: str = "uploads"
    PDF_TEMPLATE_DIR: str = "templates"

    # ── Cache ─────────────────────────────────────────────────────────────────
    CACHE_TTL_SECONDS: int = 300
    CACHE_ENABLED: bool = True

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    # Requirement 10.3: rate limiting is optional (opt-in via settings)
    RATE_LIMITING_ENABLED: bool = False
    # Requirement 10.2: default rate limit based on IP address
    # Format: "<count>/<period>" e.g. "100/minute", "1000/hour"
    DEFAULT_RATE_LIMIT: str = "100/minute"

    class Config:
        env_file = ".env"
        extra = "ignore"

    def __repr__(self) -> str:  # pragma: no cover
        """Never include SECRET_KEY in the string representation."""
        return (
            f"Settings(APP_NAME={self.APP_NAME!r}, "
            f"ENVIRONMENT={self.ENVIRONMENT!r}, "
            f"DEBUG={self.DEBUG!r}, "
            f"DATABASE_URL={self.DATABASE_URL!r}, "
            f"SECRET_KEY=<redacted>)"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Cached settings accessor
# ─────────────────────────────────────────────────────────────────────────────

@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


# ─────────────────────────────────────────────────────────────────────────────
# Environment validation
# ─────────────────────────────────────────────────────────────────────────────

def validate_env() -> None:
    """Validate required environment variables at startup.

    Behaviour is environment-aware:

    * ``ENVIRONMENT=production``
        Hard-fail (``sys.exit(1)``) if any required variable is absent,
        still set to an insecure default, or violates a security rule.

    * ``ENVIRONMENT=development`` (default)
        Log ``WARNING`` messages for every issue found but allow the
        process to continue.

    SECRET_KEY is **never** written to log output or error messages.

    Requirements covered: 2.1, 2.2, 2.3, 2.4, 2.5
    """
    env_value = os.environ.get("ENVIRONMENT", "development").lower()
    is_prod = env_value == "production"
    errors: list[str] = []
    warnings: list[str] = []

    # ── 1. Required variables must be present ─────────────────────────────────
    for var in _REQUIRED_PROD_VARS:
        val = os.environ.get(var)
        if not val:
            msg = f"Missing required environment variable: {var}"
            if is_prod:
                errors.append(msg)
            else:
                warnings.append(msg)

    # ── 2. Insecure defaults must not reach production ────────────────────────
    for var, insecure_default in _INSECURE_DEFAULTS.items():
        current = os.environ.get(var, insecure_default)
        if current == insecure_default:
            # Never mention the actual SECRET_KEY value in the message
            if var == "SECRET_KEY":
                msg = "SECRET_KEY is using the insecure development default — set a strong random value before deploying"
            else:
                msg = f"{var} is using the insecure development default ({insecure_default!r}) — override before deploying"
            if is_prod:
                errors.append(msg)
            else:
                warnings.append(msg)

    # ── 3. SECRET_KEY length check ────────────────────────────────────────────
    secret_key = os.environ.get("SECRET_KEY", "")
    if secret_key and len(secret_key) < _MIN_SECRET_KEY_LENGTH:
        msg = (
            f"SECRET_KEY is too short (minimum {_MIN_SECRET_KEY_LENGTH} characters) "
            "— use a cryptographically random value"
        )
        if is_prod:
            errors.append(msg)
        else:
            warnings.append(msg)

    # ── 4. DEBUG must be False in production ──────────────────────────────────
    debug_raw = os.environ.get("DEBUG", "false").lower()
    if is_prod and debug_raw in ("1", "true", "yes"):
        errors.append("DEBUG must not be enabled in production (set DEBUG=false)")
    elif not is_prod and debug_raw in ("1", "true", "yes"):
        warnings.append("DEBUG is enabled — ensure this is intentional for development")

    # ── 5. CORS_ORIGINS must not be a wildcard in production ──────────────────
    cors_raw = os.environ.get("CORS_ORIGINS", "")
    if cors_raw:
        origins = [o.strip() for o in cors_raw.split(",") if o.strip()]
        if is_prod and "*" in origins:
            errors.append(
                "CORS_ORIGINS contains '*' which allows any origin — "
                "specify explicit origins in production"
            )
        if not origins:
            msg = "CORS_ORIGINS is set but contains no valid origins after parsing"
            if is_prod:
                errors.append(msg)
            else:
                warnings.append(msg)

    # ── 6. Firebase credentials check ────────────────────────────────────────
    if is_prod:
        has_explicit_creds = bool(
            os.environ.get("FIREBASE_CREDENTIALS_PATH")
            or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        )
        has_cloud_run_identity = any(
            os.environ.get(marker) for marker in _CLOUD_RUN_ENV_MARKERS
        )
        if not has_explicit_creds and not has_cloud_run_identity:
            errors.append(
                "Missing Firebase credentials: set FIREBASE_CREDENTIALS_PATH, "
                "GOOGLE_APPLICATION_CREDENTIALS, or run inside Cloud Run with ADC"
            )
    else:
        firebase_path = os.environ.get("FIREBASE_CREDENTIALS_PATH", "")
        if firebase_path and not os.path.exists(firebase_path):
            warnings.append(
                f"FIREBASE_CREDENTIALS_PATH={firebase_path!r} does not exist — "
                "Firebase features may not work"
            )

    # ── 7. DATABASE_URL basic sanity check ───────────────────────────────────
    db_url = os.environ.get("DATABASE_URL", "")
    if db_url and not (
        db_url.startswith("sqlite")
        or db_url.startswith("postgresql")
        or db_url.startswith("mysql")
        or db_url.startswith("postgres")
    ):
        msg = f"DATABASE_URL has an unrecognised scheme — verify the connection string"
        if is_prod:
            errors.append(msg)
        else:
            warnings.append(msg)

    # ── Emit warnings (development) ───────────────────────────────────────────
    for w in warnings:
        logger.warning("⚠  ENV WARNING: %s", w)

    # ── Fail hard in production ───────────────────────────────────────────────
    if errors:
        for e in errors:
            logger.critical("STARTUP BLOCKED: %s", e)
        sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# Module-level validation — runs when this module is first imported
# ─────────────────────────────────────────────────────────────────────────────
validate_env()
