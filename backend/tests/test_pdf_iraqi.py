"""Smoke + structural tests for the Iraqi PDF templates (R4.12).

These tests do **not** assert visual fidelity (that needs a designer eye and a
reference PNG). They confirm:

  * The templates run end-to-end and produce non-empty PDF bytes.
  * The PDF starts with the magic ``%PDF-`` header.
  * The formatter helpers behave correctly for IQD, dates, phones,
    digits, and page numbering.
  * The font registration step returns a non-empty font name.

PDF visual regression is a separate workstream (R4.12 acceptance) that
needs Noto Naskh present at the documented path.
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from app.pdf import iraqi_formatter as fmt
from app.pdf.arabic_typesetter import register_arabic_font, shape_rtl


# ─────────────────────────────────────────────────────────────────────────
# Formatter helpers
# ─────────────────────────────────────────────────────────────────────────


def test_format_iqd_no_decimals_arabic_separator():
    assert fmt.format_iqd(1_500_000, locale="ar") == f"1{fmt.ARABIC_THOUSANDS_SEP}500{fmt.ARABIC_THOUSANDS_SEP}000 د.ع"


def test_format_iqd_english_uses_comma_and_iqd_suffix():
    assert fmt.format_iqd(1_500_000, locale="en") == "1,500,000 IQD"


def test_format_iqd_arabic_indic_digits():
    out = fmt.format_iqd(1234, locale="ar", use_arabic_indic=True)
    assert "١٬٢٣٤" in out


def test_format_iqd_zero_and_negative_handled():
    assert "0 IQD" in fmt.format_iqd(0, locale="en")
    # Negative collapses to integer-only; we don't insist on a sign convention here
    assert fmt.format_iqd(-1, locale="en").endswith("IQD")


def test_to_arabic_indic_and_back():
    assert fmt.to_arabic_indic("2026-05-29") == "٢٠٢٦-٠٥-٢٩"
    assert fmt.to_latin_digits("٢٠٢٦") == "2026"


def test_format_date_dmy():
    assert fmt.format_date_dmy(date(2026, 5, 29), locale="en") == "29/05/2026"


def test_format_date_dmy_arabic_indic():
    out = fmt.format_date_dmy(date(2026, 5, 29), locale="ar", use_arabic_indic=True)
    assert out == "٢٩/٠٥/٢٠٢٦"


def test_format_iraqi_phone_canonical():
    assert fmt.format_iraqi_phone("07701234567") == "+964 770 123 4567"
    assert fmt.format_iraqi_phone("+9647701234567") == "+964 770 123 4567"
    assert fmt.format_iraqi_phone("009647701234567") == "+964 770 123 4567"


def test_format_iraqi_phone_returns_input_on_invalid():
    # Not an Iraqi 7XXX number — return original
    assert fmt.format_iraqi_phone("12345") == "12345"
    assert fmt.format_iraqi_phone(None) == ""


def test_format_page_number_arabic_indic():
    assert fmt.format_page_number(1, 2, locale="ar", use_arabic_indic=True).startswith("الصفحة")
    assert "١" in fmt.format_page_number(1, 2, locale="ar", use_arabic_indic=True)


# ─────────────────────────────────────────────────────────────────────────
# Typesetter
# ─────────────────────────────────────────────────────────────────────────


def test_font_registration_returns_name():
    name = register_arabic_font()
    assert isinstance(name, str) and name
    # When the font file is missing, fallback is Helvetica — both acceptable.
    assert name in {"NotoNaskhArabic", "Amiri", "Helvetica"}


def test_shape_rtl_returns_string_for_arabic_text():
    out = shape_rtl("الفاتورة")
    assert isinstance(out, str) and out


# ─────────────────────────────────────────────────────────────────────────
# Template smoke tests
# ─────────────────────────────────────────────────────────────────────────


def _sample_invoice() -> dict:
    return {
        "invoice_no": "INV-000123",
        "issue_date": "2026-05-29",
        "due_date": "2026-06-29",
        "currency": "IQD",
        "company": {
            "name": "شرکة الاختبار",
            "tax_id": "TIN-1234",
            "commercial_registration_no": "BG-123456",
            "phone": "07701234567",
        },
        "customer": {
            "name": "زبون",
            "tax_id": "TIN-9999",
            "phone": "07709998877",
        },
        "lines": [
            {"description": "خدمة استشارية", "qty": 1, "unit_price": 1_000_000, "total": 1_000_000},
            {"description": "مواد مكتبية", "qty": 3, "unit_price": 25_000, "total": 75_000},
        ],
        "subtotal": 1_075_000,
        "tax_total": 0,
        "wht_withheld": 30_000,
        "grand_total": 1_075_000,
        "net_payable": 1_045_000,
        "locale": "ar",
        "use_arabic_indic": True,
        "show_hijri": False,
    }


def test_arabic_invoice_renders_pdf_bytes():
    from app.pdf.templates.invoice_arabic import render_arabic_invoice
    pdf = render_arabic_invoice(_sample_invoice())
    assert isinstance(pdf, bytes) and len(pdf) > 1024
    assert pdf.startswith(b"%PDF-")


def test_kurdish_invoice_renders_pdf_bytes():
    from app.pdf.templates.invoice_kurdish import render_kurdish_invoice
    pdf = render_kurdish_invoice({**_sample_invoice(), "locale": "ku"})
    assert pdf.startswith(b"%PDF-")
    assert len(pdf) > 1024


def test_arabic_receipt_renders_pdf_bytes():
    from app.pdf.templates.receipt_arabic import render_arabic_receipt
    receipt = {
        "receipt_no": "POS-000001",
        "issue_date": "2026-05-29",
        "company": {"name": "محل الاختبار", "phone": "07701234567"},
        "lines": [
            {"description": "شاي", "qty": 2, "unit_price": 1000, "total": 2000},
        ],
        "subtotal": 2000,
        "tax_total": 0,
        "grand_total": 2000,
        "payment_method": "نقدي",
        "locale": "ar",
        "use_arabic_indic": True,
    }
    from app.pdf.templates.receipt_arabic import render_arabic_receipt as render
    pdf = render(receipt)
    assert pdf.startswith(b"%PDF-")
    assert len(pdf) > 512
