"""Per-tenant signing certificate storage in GCP Secret Manager.

The PKCS#12 blob (cert + private key) is uploaded once per tenant by an
admin and never retrieved over the wire — only the in-process worker that
performs signing reads it. The password is stored as a sibling secret so
it can be rotated independently.

Secret naming convention (single GCP project for all tenants):
    tenant-{tenant_id}-efakhata-cert
    tenant-{tenant_id}-efakhata-cert-password

We *never* log the password or the PKCS#12 bytes. Failures log only the
secret name and the exception class.

If ``google-cloud-secret-manager`` is not installed (dev / CI), we fall
back to an in-process dict-backed store so the rest of the e-Fakhata
machinery can be exercised without GCP credentials. The fallback is
gated on ``EFAKHATA_LOCAL_CERT_STORE=1`` to make the choice explicit.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


class CertNotFound(Exception):
    """Raised when no certificate is stored for the tenant."""


class CertStoreUnavailable(Exception):
    """Raised when Secret Manager is unreachable / unauthorized."""


@dataclass
class CertMetadata:
    tenant_id: str
    version: str           # Secret Manager version label, "latest" by default
    uploaded_at: datetime
    fingerprint: str       # SHA-256 hex of the PKCS#12 bytes (for audit)
    subject: Optional[str] = None
    not_after: Optional[datetime] = None
    revoked: bool = False
    revoked_reason: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Local in-process fallback (dev only)
# ─────────────────────────────────────────────────────────────────────────────


_LOCAL_STORE: dict[str, tuple[bytes, str, CertMetadata]] = {}


def _use_local() -> bool:
    return os.environ.get("EFAKHATA_LOCAL_CERT_STORE") == "1"


# ─────────────────────────────────────────────────────────────────────────────
# Secret name helpers
# ─────────────────────────────────────────────────────────────────────────────


def _cert_secret_name(tenant_id: str) -> str:
    project = os.environ.get("GCP_PROJECT_ID", "default")
    return f"projects/{project}/secrets/tenant-{tenant_id}-efakhata-cert"


def _password_secret_name(tenant_id: str) -> str:
    project = os.environ.get("GCP_PROJECT_ID", "default")
    return f"projects/{project}/secrets/tenant-{tenant_id}-efakhata-cert-password"


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────


def upload_tenant_cert(
    tenant_id: str,
    p12_bytes: bytes,
    password: str,
    *,
    subject: Optional[str] = None,
    not_after: Optional[datetime] = None,
) -> CertMetadata:
    """Store the PKCS#12 cert + password as a new secret version.

    Returns the metadata record (the bytes themselves are never echoed).
    """
    import hashlib

    if not p12_bytes:
        raise ValueError("p12_bytes must be non-empty")
    if not password:
        raise ValueError("password must be non-empty")

    fingerprint = hashlib.sha256(p12_bytes).hexdigest()
    metadata = CertMetadata(
        tenant_id=tenant_id,
        version="latest",
        uploaded_at=datetime.utcnow(),
        fingerprint=fingerprint,
        subject=subject,
        not_after=not_after,
    )

    if _use_local():
        _LOCAL_STORE[tenant_id] = (p12_bytes, password, metadata)
        logger.info("efakhata_cert_uploaded_local", extra={"tenant_id": tenant_id,
                                                             "fingerprint": fingerprint[:16]})
        return metadata

    try:
        from google.cloud import secretmanager  # type: ignore
    except ImportError as exc:
        raise CertStoreUnavailable(
            "google-cloud-secret-manager not installed; set "
            "EFAKHATA_LOCAL_CERT_STORE=1 for the dev fallback"
        ) from exc

    client = secretmanager.SecretManagerServiceClient()
    cert_name = _cert_secret_name(tenant_id)
    pwd_name = _password_secret_name(tenant_id)

    try:
        # Create the secret containers (idempotent on AlreadyExists).
        _ensure_secret(client, cert_name)
        _ensure_secret(client, pwd_name)
        client.add_secret_version(
            request={"parent": cert_name, "payload": {"data": p12_bytes}}
        )
        client.add_secret_version(
            request={"parent": pwd_name, "payload": {"data": password.encode("utf-8")}}
        )
    except Exception as exc:
        # NEVER log password or p12 bytes.
        logger.exception("efakhata_cert_upload_failed",
                         extra={"tenant_id": tenant_id})
        raise CertStoreUnavailable("Secret Manager write failed") from exc

    logger.info("efakhata_cert_uploaded",
                extra={"tenant_id": tenant_id, "fingerprint": fingerprint[:16]})
    return metadata


def load_tenant_cert(tenant_id: str) -> tuple[bytes, str]:
    """Return ``(p12_bytes, password)`` for the latest active version.

    Raises ``CertNotFound`` if none exists, ``CertStoreUnavailable`` on
    transient backend errors. Callers must hold the result in process
    memory only — *never* persist or transmit.
    """
    if _use_local():
        if tenant_id not in _LOCAL_STORE:
            raise CertNotFound(f"no cert for tenant {tenant_id}")
        p12, pwd, meta = _LOCAL_STORE[tenant_id]
        if meta.revoked:
            raise CertNotFound(f"cert for tenant {tenant_id} is revoked")
        return p12, pwd

    try:
        from google.cloud import secretmanager  # type: ignore
    except ImportError as exc:
        raise CertStoreUnavailable("Secret Manager client not installed") from exc

    client = secretmanager.SecretManagerServiceClient()
    cert_v = _cert_secret_name(tenant_id) + "/versions/latest"
    pwd_v = _password_secret_name(tenant_id) + "/versions/latest"

    try:
        cert_resp = client.access_secret_version(request={"name": cert_v})
        pwd_resp = client.access_secret_version(request={"name": pwd_v})
    except Exception as exc:
        # Distinguish NotFound from transport errors at the API layer; here
        # we map any "NotFound"-style failure to CertNotFound by name.
        name = exc.__class__.__name__
        if "NotFound" in name:
            raise CertNotFound(f"no cert for tenant {tenant_id}") from exc
        raise CertStoreUnavailable(str(exc)) from exc

    return cert_resp.payload.data, pwd_resp.payload.data.decode("utf-8")


def list_tenant_certs(tenant_id: str) -> list[CertMetadata]:
    """List all versions for audit. Local store returns the single current."""
    if _use_local():
        if tenant_id not in _LOCAL_STORE:
            return []
        return [_LOCAL_STORE[tenant_id][2]]

    try:
        from google.cloud import secretmanager  # type: ignore
    except ImportError:
        return []
    client = secretmanager.SecretManagerServiceClient()
    cert_name = _cert_secret_name(tenant_id)
    out: list[CertMetadata] = []
    try:
        for v in client.list_secret_versions(request={"parent": cert_name}):
            # We only learn create_time / state from Secret Manager; the
            # detailed fingerprint/subject lives in a sibling Firestore
            # record. Build a minimal record so audit screens have *something*.
            out.append(
                CertMetadata(
                    tenant_id=tenant_id,
                    version=v.name.split("/")[-1],
                    uploaded_at=v.create_time.replace(tzinfo=None) if v.create_time else datetime.utcnow(),
                    fingerprint="",
                    revoked=(v.state and v.state.name == "DISABLED"),
                )
            )
    except Exception:
        logger.exception("efakhata_cert_list_failed", extra={"tenant_id": tenant_id})
        return []
    return out


def revoke_tenant_cert(tenant_id: str, reason: str) -> None:
    """Disable the latest version. Callers must follow up with a fresh upload."""
    if _use_local():
        if tenant_id not in _LOCAL_STORE:
            raise CertNotFound(f"no cert for tenant {tenant_id}")
        p12, pwd, meta = _LOCAL_STORE[tenant_id]
        meta.revoked = True
        meta.revoked_reason = reason
        _LOCAL_STORE[tenant_id] = (p12, pwd, meta)
        logger.info("efakhata_cert_revoked_local",
                    extra={"tenant_id": tenant_id, "reason": reason})
        return

    try:
        from google.cloud import secretmanager  # type: ignore
    except ImportError as exc:
        raise CertStoreUnavailable("Secret Manager client not installed") from exc

    client = secretmanager.SecretManagerServiceClient()
    cert_v = _cert_secret_name(tenant_id) + "/versions/latest"
    try:
        client.disable_secret_version(request={"name": cert_v})
    except Exception as exc:
        raise CertStoreUnavailable(str(exc)) from exc
    logger.info("efakhata_cert_revoked",
                extra={"tenant_id": tenant_id, "reason": reason})


# ─────────────────────────────────────────────────────────────────────────────
# Internal: Secret Manager ensure-secret helper
# ─────────────────────────────────────────────────────────────────────────────


def _ensure_secret(client, full_name: str) -> None:
    """Create the secret container if it does not yet exist."""
    parent = "/".join(full_name.split("/")[:2])  # projects/{p}
    secret_id = full_name.split("/")[-1]
    try:
        client.get_secret(request={"name": full_name})
    except Exception as exc:
        if "NotFound" not in exc.__class__.__name__:
            raise
        client.create_secret(
            request={
                "parent": parent,
                "secret_id": secret_id,
                "secret": {"replication": {"automatic": {}}},
            }
        )
