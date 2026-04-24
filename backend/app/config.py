from pydantic_settings import BaseSettings
from functools import lru_cache
import os
import sys
import logging

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────
# Required env vars that must be set in prod
# ─────────────────────────────────────────
_REQUIRED_PROD_VARS: list[str] = [
    "SECRET_KEY",
    "CORS_ORIGINS",
    "FIREBASE_CREDENTIALS_PATH",
]

_INSECURE_DEFAULTS = {
    "SECRET_KEY": "dev-only-insecure-key-change-me-in-production",
}


class Settings(BaseSettings):
    SECRET_KEY: str = "dev-only-insecure-key-change-me-in-production"
    APP_NAME: str = "Zoho Books Local"
    DEBUG: bool = False
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    ALGORITHM: str = "HS256"
    UPLOAD_DIR: str = "uploads"
    PDF_TEMPLATE_DIR: str = "templates"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
    
    # Firebase settings
    FIREBASE_CREDENTIALS_PATH: str = "serviceAccountKey.json"
    FIREBASE_STORAGE_BUCKET: str = ""
    CACHE_TTL_SECONDS: int = 300
    CACHE_ENABLED: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def validate_env() -> None:
    """Startup env validator — logs warnings in dev, fails hard in prod.

    Production mode is opt-in via ENVIRONMENT=production. This avoids the
    footgun where a fresh dev machine (no .env, DEBUG defaults to False)
    is treated as production and refuses to start.
    """
    is_prod = os.environ.get("ENVIRONMENT", "development").lower() == "production"
    errors: list[str] = []

    for var in _REQUIRED_PROD_VARS:
        val = os.environ.get(var)
        default = _INSECURE_DEFAULTS.get(var)
        if is_prod:
            if not val:
                errors.append(f"Missing required env var: {var}")
            elif default and val == default:
                errors.append(f"Insecure default still used for: {var}")
        else:
            if default and os.environ.get(var, default) == default:
                logger.warning("⚠  %s is using insecure dev default — set a real value before production", var)

    if errors:
        for e in errors:
            logger.critical("STARTUP BLOCKED: %s", e)
        sys.exit(1)

