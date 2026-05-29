"""Tests for the file-upload validation helper (SF4 / T-SF.4.7).

Covers:
  - Size cap enforcement (per-category + absolute ceiling).
  - MIME allowlist (deny-by-default).
  - Magic-byte sniff vs declared content-type (spoof detection).
  - Filename hardening (path traversal, null bytes, blocked + double extensions).
  - Optional ClamAV scan path (mocked) including fail-open/closed behaviour.

Requirements: T-SF.4.7, OWASP A05/A08.
"""
from __future__ import annotations

import io

import pytest

from app.services.upload_validation import (
    ALLOWED_TYPES_BY_CATEGORY,
    CATEGORY_MAX_BYTES,
    MAX_UPLOAD_BYTES,
    UploadValidationError,
    sanitize_filename,
    validate_upload,
)

# ── Sample byte payloads with valid magic numbers ─────────────────────────────

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
GIF = b"GIF89a" + b"\x00" * 64
PDF = b"%PDF-1.7\n" + b"%\xe2\xe3\xcf\xd3\n" + b"0 obj" + b"\x00" * 32
WEBP = b"RIFF" + b"\x24\x00\x00\x00" + b"WEBP" + b"\x00" * 32
ZIP_OOXML = b"PK\x03\x04" + b"\x14\x00" + b"\x00" * 64
CSV = b"name,amount\nAcme,100\n"
HTML_DISGUISED = b"<html><script>alert(1)</script></html>"


# ── 1. Size enforcement ───────────────────────────────────────────────────────


class TestSizeCap:
    def test_empty_upload_rejected(self):
        with pytest.raises(UploadValidationError) as ei:
            validate_upload(file_bytes=b"", filename="a.png", declared_content_type="image/png")
        assert ei.value.status_code == 400

    def test_over_category_cap_rejected(self):
        big = b"\x89PNG\r\n\x1a\n" + b"\x00" * (CATEGORY_MAX_BYTES["image"] + 1)
        with pytest.raises(UploadValidationError) as ei:
            validate_upload(
                file_bytes=big, filename="big.png", declared_content_type="image/png",
                category="image",
            )
        assert ei.value.status_code == 413

    def test_custom_max_bytes_is_clamped_to_ceiling(self):
        # Asking for more than the absolute ceiling must not raise the cap.
        assert MAX_UPLOAD_BYTES < 1024 * 1024 * 1024
        # A within-ceiling-but-over-custom file is rejected.
        data = PNG + b"\x00" * 1024
        with pytest.raises(UploadValidationError) as ei:
            validate_upload(
                file_bytes=data, filename="x.png", declared_content_type="image/png",
                category="image", max_bytes=128,
            )
        assert ei.value.status_code == 413

    def test_within_cap_accepted(self):
        res = validate_upload(
            file_bytes=PNG, filename="ok.png", declared_content_type="image/png",
            category="image",
        )
        assert res.size_bytes == len(PNG)


# ── 2. MIME allowlist ──────────────────────────────────────────────────────────


class TestMimeAllowlist:
    def test_disallowed_type_for_category_rejected(self):
        # PDF is not in the image allowlist.
        with pytest.raises(UploadValidationError) as ei:
            validate_upload(
                file_bytes=PDF, filename="doc.pdf", declared_content_type="application/pdf",
                category="image",
            )
        assert ei.value.status_code == 415

    def test_unknown_type_rejected(self):
        with pytest.raises(UploadValidationError) as ei:
            validate_upload(
                file_bytes=PNG, filename="x.bin",
                declared_content_type="application/octet-stream", category="any",
            )
        assert ei.value.status_code == 415

    def test_jpg_normalized_to_jpeg(self):
        res = validate_upload(
            file_bytes=JPEG, filename="p.jpg", declared_content_type="image/jpg",
            category="image",
        )
        assert res.content_type == "image/jpeg"

    def test_pdf_allowed_in_document_category(self):
        res = validate_upload(
            file_bytes=PDF, filename="invoice.pdf", declared_content_type="application/pdf",
            category="document",
        )
        assert res.content_type == "application/pdf"


# ── 3. Magic-byte sniff vs declared type ───────────────────────────────────────


class TestMagicByteSniff:
    def test_html_disguised_as_png_rejected(self):
        with pytest.raises(UploadValidationError) as ei:
            validate_upload(
                file_bytes=HTML_DISGUISED, filename="evil.png",
                declared_content_type="image/png", category="image",
            )
        assert ei.value.status_code == 422

    def test_pdf_bytes_declared_png_rejected(self):
        with pytest.raises(UploadValidationError):
            validate_upload(
                file_bytes=PDF, filename="fake.png",
                declared_content_type="image/png", category="image",
            )

    def test_webp_requires_webp_fourcc(self):
        # RIFF header but not WEBP → not a valid webp, declared image/webp fails.
        riff_wav = b"RIFF" + b"\x24\x00\x00\x00" + b"WAVE" + b"\x00" * 32
        with pytest.raises(UploadValidationError):
            validate_upload(
                file_bytes=riff_wav, filename="a.webp",
                declared_content_type="image/webp", category="image",
            )

    def test_valid_webp_accepted(self):
        res = validate_upload(
            file_bytes=WEBP, filename="a.webp", declared_content_type="image/webp",
            category="image",
        )
        assert res.sniffed_type == "image/webp"

    def test_gif_accepted(self):
        res = validate_upload(
            file_bytes=GIF, filename="a.gif", declared_content_type="image/gif",
            category="image",
        )
        assert res.sniffed_type == "image/gif"

    def test_csv_text_accepted_without_binary_signature(self):
        res = validate_upload(
            file_bytes=CSV, filename="data.csv", declared_content_type="text/csv",
            category="spreadsheet",
        )
        assert res.content_type == "text/csv"
        assert res.sniffed_type is None

    def test_xlsx_zip_container_accepted(self):
        res = validate_upload(
            file_bytes=ZIP_OOXML, filename="book.xlsx",
            declared_content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            category="spreadsheet",
        )
        assert res.sniffed_type == "application/zip"

    def test_text_declared_but_binary_bytes_rejected(self):
        # PNG bytes declared as text/plain → signature mismatch.
        with pytest.raises(UploadValidationError):
            validate_upload(
                file_bytes=PNG, filename="note.txt", declared_content_type="text/plain",
                category="document",
            )


# ── 4. Filename hardening ──────────────────────────────────────────────────────


class TestFilenameHardening:
    def test_path_traversal_stripped(self):
        assert sanitize_filename("../../etc/passwd") == "passwd"

    def test_windows_path_stripped(self):
        assert sanitize_filename(r"C:\\Windows\\system32\\evil.png") == "evil.png"

    def test_null_byte_stripped(self):
        out = sanitize_filename("evil\x00.png")
        assert "\x00" not in out

    def test_leading_dots_stripped(self):
        # ".htaccess" must not survive as a dotfile.
        out = sanitize_filename("...htaccess")
        assert not out.startswith(".")

    def test_unsafe_chars_replaced(self):
        out = sanitize_filename("my file (1)*.png")
        assert all(c.isalnum() or c in "._-" for c in out)

    def test_blank_after_sanitize_raises(self):
        with pytest.raises(UploadValidationError):
            sanitize_filename("///")

    def test_blocked_extension_exe_rejected(self):
        with pytest.raises(UploadValidationError) as ei:
            validate_upload(
                file_bytes=PDF, filename="malware.exe",
                declared_content_type="application/pdf", category="document",
            )
        assert ei.value.status_code == 422

    def test_double_extension_pdf_exe_rejected(self):
        with pytest.raises(UploadValidationError):
            validate_upload(
                file_bytes=PDF, filename="invoice.pdf.exe",
                declared_content_type="application/pdf", category="document",
            )

    def test_svg_blocked_as_xss_vector(self):
        # SVG is explicitly blocked even though it is image-ish.
        svg = b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"
        with pytest.raises(UploadValidationError):
            validate_upload(
                file_bytes=svg, filename="logo.svg", declared_content_type="image/svg+xml",
                category="image",
            )

    def test_safe_filename_returned(self):
        res = validate_upload(
            file_bytes=PNG, filename="My Logo.png", declared_content_type="image/png",
            category="image",
        )
        assert res.safe_filename == "My_Logo.png"


# ── 5. ClamAV scanning (mocked) ────────────────────────────────────────────────


class _FakeClamdClean:
    def instream(self, _stream):
        return {"stream": ("OK", None)}


class _FakeClamdInfected:
    def instream(self, _stream):
        return {"stream": ("FOUND", "Eicar-Test-Signature")}


class TestClamAvScan:
    def test_clean_scan_passes(self, monkeypatch):
        monkeypatch.setattr(
            "app.services.upload_validation._scan_with_clamav",
            lambda data: None,
        )
        res = validate_upload(
            file_bytes=PNG, filename="a.png", declared_content_type="image/png",
            category="image", scan=True,
        )
        assert res.scanned is True

    def test_infected_scan_rejected(self, monkeypatch):
        def _boom(_data):
            raise UploadValidationError("malware detected (Eicar)", status_code=422)

        monkeypatch.setattr(
            "app.services.upload_validation._scan_with_clamav", _boom
        )
        with pytest.raises(UploadValidationError) as ei:
            validate_upload(
                file_bytes=PNG, filename="a.png", declared_content_type="image/png",
                category="image", scan=True,
            )
        assert ei.value.status_code == 422

    def test_scan_skipped_when_flag_off(self, monkeypatch):
        called = {"n": 0}

        def _spy(_data):
            called["n"] += 1

        monkeypatch.setattr("app.services.upload_validation._scan_with_clamav", _spy)
        res = validate_upload(
            file_bytes=PNG, filename="a.png", declared_content_type="image/png",
            category="image", scan=False,
        )
        assert res.scanned is False
        assert called["n"] == 0

    def test_eicar_via_fake_clamd_network(self, monkeypatch):
        """End-to-end through _scan_with_clamav with a fake clamd module."""
        import sys
        import types

        fake_clamd = types.ModuleType("clamd")
        fake_clamd.ClamdNetworkSocket = lambda **kw: _FakeClamdInfected()
        fake_clamd.ClamdUnixSocket = lambda **kw: _FakeClamdInfected()
        monkeypatch.setitem(sys.modules, "clamd", fake_clamd)

        with pytest.raises(UploadValidationError) as ei:
            validate_upload(
                file_bytes=PNG, filename="a.png", declared_content_type="image/png",
                category="image", scan=True,
            )
        assert "malware" in ei.value.detail.lower()

    def test_clean_via_fake_clamd_network(self, monkeypatch):
        import sys
        import types

        fake_clamd = types.ModuleType("clamd")
        fake_clamd.ClamdNetworkSocket = lambda **kw: _FakeClamdClean()
        fake_clamd.ClamdUnixSocket = lambda **kw: _FakeClamdClean()
        monkeypatch.setitem(sys.modules, "clamd", fake_clamd)

        res = validate_upload(
            file_bytes=PNG, filename="a.png", declared_content_type="image/png",
            category="image", scan=True,
        )
        assert res.scanned is True


# ── 6. Category fallback + allowlist integrity ─────────────────────────────────


class TestCategoryHandling:
    def test_unknown_category_falls_back_to_any(self):
        res = validate_upload(
            file_bytes=PNG, filename="a.png", declared_content_type="image/png",
            category="does-not-exist",
        )
        assert res.content_type == "image/png"

    def test_allowlists_are_nonempty(self):
        for cat, types in ALLOWED_TYPES_BY_CATEGORY.items():
            assert types, f"allowlist for {cat} must not be empty"
