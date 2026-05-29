"""File-upload validation (SF4 / T-SF.4.7).

A single choke-point every upload handler should call before persisting bytes
to Cloud Storage. It defends against the common upload attack classes:

  * **Oversized uploads** (DoS / storage exhaustion) — hard size cap.
  * **Content-type spoofing** — the declared ``Content-Type`` is cross-checked
    against the file's *magic bytes* (signature sniff). A ``.png`` that is
    really an HTML/SVG/script payload is rejected.
  * **Disallowed types** — only an explicit allowlist of MIME types is
    accepted; everything else is denied (deny-by-default).
  * **Dangerous filenames** — path-traversal (``../``), absolute paths, null
    bytes, and double-extension tricks (``invoice.pdf.exe``) are stripped or
    rejected, and a safe storage name is returned.
  * **Malware** — when ``UPLOAD_CLAMAV_ENABLED`` is set, the bytes are streamed
    to a ClamAV daemon (``clamd``) over TCP/unix-socket; a hit raises. ClamAV is
    optional and off by default so dev/test never need the daemon.

This module is intentionally dependency-light: magic-byte sniffing is done with
a small built-in signature table (no ``python-magic``/libmagic native dep), and
ClamAV is imported lazily only when the flag is on.

Usage::

    from app.services.upload_validation import validate_upload, UploadValidationError

    try:
        result = validate_upload(
            file_bytes=data,
            filename=upload.filename,
            declared_content_type=upload.content_type,
            category="image",      # or "document", "spreadsheet", "any"
        )
    except UploadValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    storage.upload_attachment(data, result.safe_filename, ..., result.content_type)

Requirements covered: T-SF.4.7 (file-upload validation), OWASP Top-10 A05/A08.
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("upload_validation")

# ── Size caps ────────────────────────────────────────────────────────────────

#: Absolute hard cap on any single upload (25 MiB). Individual callers may pass
#: a smaller ``max_bytes``; they can never exceed this ceiling.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

#: Sensible per-category default caps.
CATEGORY_MAX_BYTES: dict[str, int] = {
    "image": 8 * 1024 * 1024,
    "document": 25 * 1024 * 1024,
    "spreadsheet": 25 * 1024 * 1024,
    "any": MAX_UPLOAD_BYTES,
}


# ── MIME allowlists per logical category ──────────────────────────────────────

_IMAGE_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "image/bmp",
}
_DOCUMENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "text/plain",
    "text/csv",
}
_SPREADSHEET_TYPES = {
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

ALLOWED_TYPES_BY_CATEGORY: dict[str, set[str]] = {
    "image": _IMAGE_TYPES,
    "document": _DOCUMENT_TYPES,
    "spreadsheet": _SPREADSHEET_TYPES,
    "any": _IMAGE_TYPES | _DOCUMENT_TYPES | _SPREADSHEET_TYPES,
}

#: Extensions that must never be accepted regardless of declared type.
_BLOCKED_EXTENSIONS = {
    ".exe", ".dll", ".bat", ".cmd", ".com", ".sh", ".bash", ".ps1", ".psm1",
    ".js", ".mjs", ".jar", ".msi", ".scr", ".vbs", ".vbe", ".wsf", ".hta",
    ".php", ".phtml", ".phar", ".asp", ".aspx", ".jsp", ".cgi", ".pl", ".py",
    ".rb", ".so", ".dylib", ".app", ".deb", ".rpm", ".apk", ".svg",  # SVG = XSS vector
}


# ── Magic-byte signatures ──────────────────────────────────────────────────────
# (signature_prefix, offset, mime). The first matching row wins. Offsets handle
# formats whose signature is not at byte 0 (e.g. WEBP/RIFF, ISO-BMFF).

_MAGIC_SIGNATURES: list[tuple[bytes, int, str]] = [
    (b"\x89PNG\r\n\x1a\n", 0, "image/png"),
    (b"\xff\xd8\xff", 0, "image/jpeg"),
    (b"GIF87a", 0, "image/gif"),
    (b"GIF89a", 0, "image/gif"),
    (b"BM", 0, "image/bmp"),
    (b"%PDF-", 0, "application/pdf"),
    (b"PK\x03\x04", 0, "application/zip"),  # also docx/xlsx (OOXML) containers
    (b"PK\x05\x06", 0, "application/zip"),
    (b"PK\x07\x08", 0, "application/zip"),
    (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", 0, "application/vnd.ms-excel"),  # OLE2 (legacy xls)
    (b"RIFF", 0, "image/webp"),  # confirm "WEBP" at offset 8 below
]

#: MIME families that we accept the declared type for even though their bytes
#: alias to a more generic signature (OOXML zips, plain text, CSV — text has no
#: reliable magic number).
_TEXT_LIKE = {"text/plain", "text/csv"}
_OOXML_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _normalize_mime(mime: Optional[str]) -> str:
    if not mime:
        return ""
    mime = mime.split(";", 1)[0].strip().lower()
    # Normalise the common jpg/jpeg duplication so allowlists need one entry.
    if mime == "image/jpg":
        return "image/jpeg"
    return mime


def _sniff_mime(data: bytes) -> Optional[str]:
    """Return the MIME inferred from *data*'s leading bytes, or ``None``.

    Returns ``None`` for content with no recognised binary signature (e.g.
    plain text / CSV), which the caller treats as "trust the declared type if
    it is itself a text-like type".
    """
    if not data:
        return None
    for sig, offset, mime in _MAGIC_SIGNATURES:
        if data[offset : offset + len(sig)] == sig:
            if mime == "image/webp":
                # RIFF container: confirm the WEBP fourcc at byte 8.
                if data[8:12] != b"WEBP":
                    continue
            return mime
    return None


def _signature_compatible(declared: str, sniffed: Optional[str]) -> bool:
    """True when the sniffed signature is consistent with the declared MIME."""
    declared = _normalize_mime(declared)
    if sniffed is None:
        # No binary signature recognised → only accept text-like declared types.
        return declared in _TEXT_LIKE
    sniffed = _normalize_mime(sniffed)
    if declared == sniffed:
        return True
    # OOXML (xlsx/docx) and legacy office files are ZIP/OLE2 containers.
    if sniffed == "application/zip" and declared in _OOXML_TYPES:
        return True
    return False


# ── Filename hardening ─────────────────────────────────────────────────────────

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]")
_MULTI_DOT_RE = re.compile(r"\.{2,}")


def sanitize_filename(filename: str) -> str:
    """Return a storage-safe basename derived from *filename*.

    Strips directory components, null bytes, and any character outside
    ``[A-Za-z0-9._-]``; collapses repeated dots; and caps the length. Raises
    :class:`UploadValidationError` if nothing safe remains.
    """
    if not filename or not isinstance(filename, str):
        raise UploadValidationError("filename is required", status_code=400)

    # Drop any path component (handles both / and \ separators and null bytes).
    name = filename.replace("\x00", "")
    name = name.replace("\\", "/").split("/")[-1]
    name = os.path.basename(name)

    # Collapse ".." sequences and strip leading dots so we never get a dotfile
    # or a traversal token surviving sanitisation.
    name = _MULTI_DOT_RE.sub(".", name).lstrip(".")
    name = _SAFE_NAME_RE.sub("_", name)

    if len(name) > 180:
        root, ext = os.path.splitext(name)
        name = root[: 180 - len(ext)] + ext

    if not name or name in {".", "_"}:
        raise UploadValidationError("filename is invalid after sanitisation", status_code=400)
    return name


def _extension(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()


# ── Result + error types ────────────────────────────────────────────────────────


class UploadValidationError(Exception):
    """Raised when an upload fails validation.

    Carries an HTTP-friendly ``status_code`` and ``detail`` so API handlers can
    map it straight onto an ``HTTPException``.
    """

    def __init__(self, detail: str, *, status_code: int = 422):
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


@dataclass
class UploadValidationResult:
    """Outcome of a successful :func:`validate_upload`."""

    safe_filename: str
    content_type: str
    size_bytes: int
    sniffed_type: Optional[str] = None
    scanned: bool = False
    warnings: list[str] = field(default_factory=list)


# ── ClamAV (optional, lazy) ────────────────────────────────────────────────────


def _clamav_enabled() -> bool:
    try:
        from app.config import get_settings

        return bool(getattr(get_settings(), "UPLOAD_CLAMAV_ENABLED", False))
    except Exception:  # noqa: BLE001
        return False


def _scan_with_clamav(data: bytes) -> None:
    """Stream *data* to a ClamAV daemon. Raises on a virus hit or scan error.

    Connection target is read from env:
      ``CLAMAV_HOST`` (default ``127.0.0.1``) + ``CLAMAV_PORT`` (default 3310),
      or ``CLAMAV_SOCKET`` for a unix socket.

    A scan that cannot reach the daemon **fails closed** (rejects the upload)
    in production and **fails open** (logs a warning, allows) outside it, so a
    missing daemon never blocks local development.
    """
    host = os.environ.get("CLAMAV_HOST", "127.0.0.1")
    port = int(os.environ.get("CLAMAV_PORT", "3310"))
    socket_path = os.environ.get("CLAMAV_SOCKET", "")
    is_prod = os.environ.get("ENVIRONMENT", "development").lower() == "production"
    try:
        import clamd  # type: ignore

        client = (
            clamd.ClamdUnixSocket(path=socket_path)
            if socket_path
            else clamd.ClamdNetworkSocket(host=host, port=port)
        )
        import io

        result = client.instream(io.BytesIO(data))
        status = (result or {}).get("stream", ("OK", None))
        if isinstance(status, (list, tuple)) and status and status[0] == "FOUND":
            signature = status[1] if len(status) > 1 else "unknown"
            raise UploadValidationError(
                f"Upload rejected: malware detected ({signature})", status_code=422
            )
    except UploadValidationError:
        raise
    except Exception as exc:  # noqa: BLE001
        msg = f"ClamAV scan could not complete: {exc}"
        if is_prod:
            logger.error("clamav.scan_failed_closed", extra={"error": str(exc)})
            raise UploadValidationError(
                "Upload rejected: virus scan unavailable", status_code=503
            ) from exc
        logger.warning("clamav.scan_failed_open_dev: %s", msg)


# ── Public entry point ─────────────────────────────────────────────────────────


def validate_upload(
    *,
    file_bytes: bytes,
    filename: str,
    declared_content_type: Optional[str],
    category: str = "any",
    max_bytes: Optional[int] = None,
    scan: Optional[bool] = None,
) -> UploadValidationResult:
    """Validate an uploaded file end-to-end.

    Args:
        file_bytes: The raw uploaded bytes.
        filename: The client-supplied filename (untrusted).
        declared_content_type: The client-supplied ``Content-Type`` (untrusted).
        category: One of ``image`` / ``document`` / ``spreadsheet`` / ``any``;
            selects the MIME allowlist and default size cap.
        max_bytes: Optional override of the size cap. Clamped to
            :data:`MAX_UPLOAD_BYTES`.
        scan: Force malware scanning on/off. ``None`` → use the
            ``UPLOAD_CLAMAV_ENABLED`` flag.

    Returns:
        :class:`UploadValidationResult` with a safe storage filename and the
        *verified* content type.

    Raises:
        :class:`UploadValidationError` on any failure (size, type, signature,
        filename, or malware).
    """
    if category not in ALLOWED_TYPES_BY_CATEGORY:
        category = "any"

    # 1) Size ----------------------------------------------------------------
    if file_bytes is None:
        raise UploadValidationError("empty upload", status_code=400)
    size = len(file_bytes)
    if size == 0:
        raise UploadValidationError("empty upload", status_code=400)

    cap = min(max_bytes or CATEGORY_MAX_BYTES[category], MAX_UPLOAD_BYTES)
    if size > cap:
        raise UploadValidationError(
            f"file too large: {size} bytes exceeds the {cap}-byte limit",
            status_code=413,
        )

    # 2) Filename hardening + blocked extensions -----------------------------
    safe_name = sanitize_filename(filename)
    ext = _extension(safe_name)
    if ext in _BLOCKED_EXTENSIONS:
        raise UploadValidationError(
            f"file extension '{ext}' is not allowed", status_code=422
        )
    # Reject double-extension tricks where ANY interior extension is dangerous,
    # e.g. "report.pdf.exe" or "logo.svg.png".
    for token in safe_name.lower().split(".")[1:]:
        if f".{token}" in _BLOCKED_EXTENSIONS:
            raise UploadValidationError(
                f"file name contains a disallowed extension '.{token}'",
                status_code=422,
            )

    # 3) Declared type must be in the category allowlist ---------------------
    declared = _normalize_mime(declared_content_type)
    allowed = ALLOWED_TYPES_BY_CATEGORY[category]
    if declared not in allowed:
        raise UploadValidationError(
            f"content-type '{declared or 'unknown'}' is not allowed for this upload",
            status_code=415,
        )

    # 4) Magic-byte signature must match the declared type -------------------
    sniffed = _sniff_mime(file_bytes)
    if not _signature_compatible(declared, sniffed):
        raise UploadValidationError(
            "file content does not match its declared type "
            f"(declared={declared!r}, detected={sniffed!r})",
            status_code=422,
        )

    # 5) Optional malware scan ----------------------------------------------
    do_scan = _clamav_enabled() if scan is None else bool(scan)
    scanned = False
    if do_scan:
        _scan_with_clamav(file_bytes)
        scanned = True

    return UploadValidationResult(
        safe_filename=safe_name,
        content_type=declared,
        size_bytes=size,
        sniffed_type=sniffed,
        scanned=scanned,
    )


__all__ = [
    "validate_upload",
    "sanitize_filename",
    "UploadValidationError",
    "UploadValidationResult",
    "MAX_UPLOAD_BYTES",
    "CATEGORY_MAX_BYTES",
    "ALLOWED_TYPES_BY_CATEGORY",
]
