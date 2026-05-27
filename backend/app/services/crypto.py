"""Field-level encryption for PII at rest (Fernet / AES-128-CBC + HMAC)."""
from __future__ import annotations

import logging
from base64 import urlsafe_b64encode
from functools import lru_cache
from hashlib import sha256
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from app.config import settings

logger = logging.getLogger(__name__)

PREFIX = "enc:v1:"


def _derive_dev_key(secret: str) -> bytes:
    """Derive a stable Fernet key from SECRET_KEY (development fallback only)."""
    return urlsafe_b64encode(sha256(secret.encode("utf-8")).digest())


@lru_cache(maxsize=1)
def _fernet() -> Optional[MultiFernet]:
    raw = (getattr(settings, "FIELD_ENCRYPTION_KEY", None) or "").strip()
    keys: list[Fernet] = []
    if raw:
        keys.append(Fernet(raw.encode() if isinstance(raw, str) else raw))
    elif settings.ENVIRONMENT != "production":
        keys.append(Fernet(_derive_dev_key(settings.SECRET_KEY)))
    else:
        return None
    prev = getattr(settings, "FIELD_ENCRYPTION_KEY_PREVIOUS", "") or ""
    if prev.strip():
        keys.append(Fernet(prev.strip().encode()))
    return MultiFernet(keys) if keys else None


def encrypt_field(plaintext: str) -> str:
    """Encrypt a string; returns prefixed ciphertext or plaintext if crypto disabled."""
    if plaintext is None or plaintext == "":
        return plaintext
    if str(plaintext).startswith(PREFIX):
        return str(plaintext)
    f = _fernet()
    if f is None:
        return plaintext
    token = f.encrypt(str(plaintext).encode("utf-8")).decode("utf-8")
    return PREFIX + token


def decrypt_field(value: str) -> str:
    """Decrypt prefixed ciphertext; legacy plaintext passes through."""
    if value is None or value == "":
        return value
    text = str(value)
    if not text.startswith(PREFIX):
        return text
    f = _fernet()
    if f is None:
        logger.warning("FIELD_ENCRYPTION_KEY not configured; cannot decrypt PII field")
        return text
    try:
        return f.decrypt(text[len(PREFIX) :].encode("utf-8")).decode("utf-8")
    except InvalidToken:
        logger.error("Failed to decrypt field (invalid token)")
        return text


def encrypt_doc_fields(doc: dict, fields: tuple[str, ...]) -> dict:
    if not doc:
        return doc
    out = dict(doc)
    for field in fields:
        if out.get(field) not in (None, ""):
            out[field] = encrypt_field(str(out[field]))
    return out


def decrypt_doc_fields(doc: dict, fields: tuple[str, ...]) -> dict:
    if not doc:
        return doc
    out = dict(doc)
    for field in fields:
        if out.get(field) not in (None, ""):
            out[field] = decrypt_field(str(out[field]))
    return out
