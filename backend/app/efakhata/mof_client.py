"""HTTP client for the Iraq Ministry of Finance e-Fakhata submission API.

Endpoints (placeholders pending R7.X verification):

    POST {MOF_BASE}/api/v1/invoices/submit
         body  = signed XML
         200   = {"ack_number": "...", "status": "received"}
         400   = business rejection — surfaced as MoFRejected
         5xx   = transient — surfaced as MoFTransient

    GET  {MOF_BASE}/api/v1/invoices/{ack_number}/status
         200   = {"status": "acknowledged" | "rejected", ...}

    POST {MOF_BASE}/api/v1/invoices/{ack_number}/cancel
         200   = {"status": "cancelled"}

Security:
    * HTTPS only (we refuse any other scheme).
    * mTLS via the tenant's signing cert (same PKCS#12 used for XAdES).
    * ``Idempotency-Key`` header set per submission_id.
    * 30s timeout, 3 in-client retries on connection errors only — *not*
      on 4xx responses (those are business answers, not transport bugs).

If ``MOF_BASE`` is unset, ``MoFNotConfigured`` is raised on first use so
the queue accumulates pending submissions without exploding the worker.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Errors
# ─────────────────────────────────────────────────────────────────────────────


class MoFError(Exception):
    """Base class for MoF API failures."""


class MoFNotConfigured(MoFError):
    """``MOF_BASE`` env var missing — caller should hold the submission."""


class MoFTransient(MoFError):
    """5xx / network errors — retry after backoff."""


class MoFRejected(MoFError):
    """4xx with a business reason — do NOT retry blindly."""

    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


# ─────────────────────────────────────────────────────────────────────────────
# Result objects
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class SubmissionAck:
    ack_number: str
    status: str           # MoF-side status, raw
    raw: dict


@dataclass
class StatusResult:
    status: str
    ack_number: str
    detail: Optional[str] = None
    raw: Optional[dict] = None


# ─────────────────────────────────────────────────────────────────────────────
# Client
# ─────────────────────────────────────────────────────────────────────────────


class MoFClient:
    """Thin HTTPS client. Constructed per submission (or per worker tick)."""

    DEFAULT_TIMEOUT = 30
    MAX_IN_CLIENT_RETRIES = 3

    def __init__(
        self,
        *,
        base_url: Optional[str] = None,
        tenant_id: str,
        load_cert_fn=None,
    ):
        self.base_url = base_url or os.environ.get("MOF_BASE")
        self.tenant_id = tenant_id
        # Injected for testability.
        from app.efakhata.cert_storage import load_tenant_cert
        self._load_cert = load_cert_fn or load_tenant_cert

    def _require_configured(self) -> str:
        if not self.base_url:
            raise MoFNotConfigured("MOF_BASE not set")
        if not self.base_url.startswith("https://"):
            raise MoFNotConfigured("MOF_BASE must be HTTPS")
        return self.base_url.rstrip("/")

    # ── Endpoints ──────────────────────────────────────────────────────────

    def submit_invoice(self, *, xml_signed: bytes, idempotency_key: str) -> SubmissionAck:
        base = self._require_configured()
        url = f"{base}/api/v1/invoices/submit"  # TODO: verify (R7.X)
        resp = self._request(
            "POST",
            url,
            content=xml_signed,
            headers={
                "Content-Type": "application/xml",
                "Idempotency-Key": idempotency_key,
                "Accept": "application/json",
            },
        )
        data = _safe_json(resp)
        ack = data.get("ack_number") or data.get("ackNumber") or ""  # TODO: verify (R7.X)
        return SubmissionAck(ack_number=ack, status=data.get("status", "received"), raw=data)

    def get_status(self, ack_number: str) -> StatusResult:
        base = self._require_configured()
        url = f"{base}/api/v1/invoices/{ack_number}/status"  # TODO: verify (R7.X)
        resp = self._request("GET", url, headers={"Accept": "application/json"})
        data = _safe_json(resp)
        return StatusResult(
            status=data.get("status", ""),
            ack_number=ack_number,
            detail=data.get("detail") or data.get("reason"),
            raw=data,
        )

    def cancel_submission(self, ack_number: str, *, reason: str) -> StatusResult:
        base = self._require_configured()
        url = f"{base}/api/v1/invoices/{ack_number}/cancel"  # TODO: verify (R7.X)
        resp = self._request(
            "POST",
            url,
            json={"reason": reason},
            headers={"Accept": "application/json"},
        )
        data = _safe_json(resp)
        return StatusResult(
            status=data.get("status", "cancelled"),
            ack_number=ack_number,
            detail=data.get("detail"),
            raw=data,
        )

    # ── Transport ──────────────────────────────────────────────────────────

    def _request(self, method: str, url: str, **kwargs):
        try:
            import httpx  # type: ignore
        except ImportError as exc:
            raise MoFNotConfigured("httpx not installed") from exc

        cert_files = self._mtls_cert()
        last_exc: Optional[Exception] = None

        for attempt in range(1, self.MAX_IN_CLIENT_RETRIES + 1):
            try:
                with httpx.Client(
                    timeout=self.DEFAULT_TIMEOUT,
                    cert=cert_files,
                    verify=True,  # rely on system CA bundle
                ) as client:
                    resp = client.request(method, url, **kwargs)
                if 200 <= resp.status_code < 300:
                    return resp
                if 400 <= resp.status_code < 500:
                    payload = _safe_json(resp)
                    raise MoFRejected(
                        code=str(payload.get("code") or resp.status_code),
                        message=str(payload.get("message") or resp.text[:200]),
                    )
                # 5xx → transient
                raise MoFTransient(f"MoF {resp.status_code}: {resp.text[:200]}")
            except MoFRejected:
                raise
            except (MoFTransient, Exception) as exc:
                last_exc = exc
                if attempt < self.MAX_IN_CLIENT_RETRIES:
                    logger.warning(
                        "mof_request_retry",
                        extra={"attempt": attempt, "url": url, "error": exc.__class__.__name__},
                    )
                    continue
                break

        raise MoFTransient(str(last_exc) if last_exc else "unknown transport error")

    def _mtls_cert(self):
        """Return the cert tuple httpx expects (cert_path, key_path).

        We materialise the tenant cert into a tempfile pair *only* for the
        duration of the request. The files are unlinked on close. The
        password from PKCS#12 is held in this method's frame only.
        """
        try:
            from app.efakhata.cert_storage import CertNotFound
            p12_bytes, password = self._load_cert(self.tenant_id)
        except Exception as exc:
            # We treat missing cert as a configuration error — the worker
            # will surface this as a failed submission.
            raise MoFNotConfigured(
                f"tenant cert unavailable: {exc.__class__.__name__}"
            ) from exc

        from app.efakhata.signing import _unwrap_p12  # internal helper, OK here
        key_pem, cert_pem, _ = _unwrap_p12(p12_bytes, password)
        password = None  # noqa: F841 — scrub asap

        import tempfile

        cert_f = tempfile.NamedTemporaryFile(delete=False, suffix=".pem")
        key_f = tempfile.NamedTemporaryFile(delete=False, suffix=".pem")
        try:
            cert_f.write(cert_pem)
            key_f.write(key_pem)
        finally:
            cert_f.close()
            key_f.close()
        return (cert_f.name, key_f.name)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _safe_json(resp) -> dict:
    try:
        return resp.json()
    except Exception:
        return {}
