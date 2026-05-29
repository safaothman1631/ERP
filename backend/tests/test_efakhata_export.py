"""Auditor-export ZIP structure tests (growth-to-100 § R4 / G4a).

Verifies:
  * ZIP layout — invoices/, manifest.csv, README.md
  * manifest rows match per-invoice fields
  * pdf_renderer failures don't abort the bundle
  * signature_chain.pem inclusion
  * filename sanitization
"""
from __future__ import annotations

import csv
import io
import zipfile
from datetime import date

import pytest

from app.efakhata.auditor_export import build_zip


def _submission(invoice_id, status="acknowledged", ack="ACK-1"):
    return {
        "id": f"sub-{invoice_id}",
        "invoice_id": invoice_id,
        "xml_signed": f"<Invoice id='{invoice_id}'/>",
        "status": status,
        "mof_ack_number": ack,
    }


def _invoice(invoice_id, number=None, customer="Test Co.", total="1000"):
    return {
        "id": invoice_id,
        "invoice_number": number or invoice_id,
        "date": "2026-05-29",
        "contact_name": customer,
        "total": total,
        "currency_code": "IQD",
    }


def _lookup_for(*invoices):
    by_id = {inv["id"]: inv for inv in invoices}
    return lambda i: by_id.get(i)


# ─────────────────────────────────────────────────────────────────────────────
# ZIP structure
# ─────────────────────────────────────────────────────────────────────────────


def test_zip_contains_xml_per_invoice():
    subs = [_submission("INV-1"), _submission("INV-2")]
    invs = [_invoice("INV-1"), _invoice("INV-2")]
    blob = build_zip(
        tenant_id="org-1",
        start_date=date(2026, 5, 1),
        end_date=date(2026, 5, 31),
        submissions=subs,
        invoice_lookup=_lookup_for(*invs),
    )
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        names = zf.namelist()
    assert "invoices/INV-1.xml" in names
    assert "invoices/INV-2.xml" in names


def test_zip_contains_manifest_with_one_row_per_submission():
    subs = [_submission("INV-1"), _submission("INV-2")]
    invs = [_invoice("INV-1", customer="Alpha"), _invoice("INV-2", customer="Beta")]
    blob = build_zip(
        tenant_id="org-1",
        start_date=date(2026, 5, 1),
        end_date=date(2026, 5, 31),
        submissions=subs,
        invoice_lookup=_lookup_for(*invs),
    )
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        manifest = zf.read("manifest.csv").decode("utf-8")
    rows = list(csv.DictReader(io.StringIO(manifest)))
    assert len(rows) == 2
    assert {r["customer_name"] for r in rows} == {"Alpha", "Beta"}


def test_zip_contains_readme_with_arabic_and_english_sections():
    blob = build_zip(
        tenant_id="org-1",
        start_date=date(2026, 5, 1),
        end_date=date(2026, 5, 31),
        submissions=[_submission("INV-1")],
        invoice_lookup=_lookup_for(_invoice("INV-1")),
    )
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        readme = zf.read("README.md").decode("utf-8")
    assert "Auditor Export" in readme
    # Kurdish/Arabic section present.
    assert "کوردی" in readme or "ناوەڕۆکی" in readme


def test_zip_includes_signature_chain_when_provided():
    chain = b"-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----\n"
    blob = build_zip(
        tenant_id="org-1",
        start_date=date(2026, 5, 1),
        end_date=date(2026, 5, 31),
        submissions=[_submission("INV-1")],
        invoice_lookup=_lookup_for(_invoice("INV-1")),
        signature_chain_pem=chain,
    )
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        assert zf.read("signature_chain.pem") == chain


def test_pdf_renderer_failures_dont_break_bundle():
    def _bad_pdf(invoice):
        raise RuntimeError("PDF renderer exploded")
    blob = build_zip(
        tenant_id="org-1",
        start_date=date(2026, 5, 1),
        end_date=date(2026, 5, 31),
        submissions=[_submission("INV-1")],
        invoice_lookup=_lookup_for(_invoice("INV-1")),
        pdf_renderer=_bad_pdf,
    )
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        names = zf.namelist()
    # XML must still be present; PDF must NOT be.
    assert "invoices/INV-1.xml" in names
    assert "invoices/INV-1.pdf" not in names


def test_pdf_renderer_success_writes_pdf():
    def _renderer(invoice):
        return b"%PDF-1.4 stub"
    blob = build_zip(
        tenant_id="org-1",
        start_date=date(2026, 5, 1),
        end_date=date(2026, 5, 31),
        submissions=[_submission("INV-1")],
        invoice_lookup=_lookup_for(_invoice("INV-1")),
        pdf_renderer=_renderer,
    )
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        assert zf.read("invoices/INV-1.pdf") == b"%PDF-1.4 stub"


def test_filename_sanitization_rejects_path_traversal():
    """If an invoice number has slashes, it must be flattened — not allowed
    to break out into a parent directory."""
    subs = [_submission("../etc/passwd")]
    invs = [_invoice("../etc/passwd", number="../etc/passwd", customer="X")]
    blob = build_zip(
        tenant_id="org-1",
        start_date=date(2026, 5, 1),
        end_date=date(2026, 5, 31),
        submissions=subs,
        invoice_lookup=_lookup_for(*invs),
    )
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        names = zf.namelist()
    # No name escapes the invoices/ prefix.
    assert all(n.startswith("invoices/") or n in {"manifest.csv", "README.md"}
               for n in names)
    assert all(".." not in n for n in names)


def test_empty_range_still_produces_manifest_and_readme():
    blob = build_zip(
        tenant_id="org-1",
        start_date=date(2026, 5, 1),
        end_date=date(2026, 5, 31),
        submissions=[],
        invoice_lookup=lambda i: None,
    )
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        names = zf.namelist()
    assert "manifest.csv" in names
    assert "README.md" in names
    # No invoice files.
    assert not any(n.startswith("invoices/") for n in names)


def test_manifest_carries_mof_ack_number():
    subs = [_submission("INV-1", status="acknowledged", ack="MOF-XYZ-99")]
    blob = build_zip(
        tenant_id="org-1",
        start_date=date(2026, 5, 1),
        end_date=date(2026, 5, 31),
        submissions=subs,
        invoice_lookup=_lookup_for(_invoice("INV-1")),
    )
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        manifest = zf.read("manifest.csv").decode("utf-8")
    rows = list(csv.DictReader(io.StringIO(manifest)))
    assert rows[0]["mof_ack_number"] == "MOF-XYZ-99"
    assert rows[0]["status"] == "acknowledged"
