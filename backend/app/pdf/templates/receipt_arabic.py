"""Arabic 80mm thermal-receipt PDF template (R4.12).

For thermal printers (Bixolon SRP-330II, Xprinter XP-T80A) we render at the
80mm width × variable height format used by ``ReceiptTemplate80mm.tsx`` on
the frontend. The PDF surface is for email/archive of receipts; the actual
printer uses ESC/POS directly from the React app.
"""
from __future__ import annotations

from io import BytesIO
from typing import Optional

from app.pdf.arabic_typesetter import register_arabic_font, shape_rtl
from app.pdf.iraqi_formatter import (
    format_amount,
    format_date_iraqi,
    format_iraqi_phone,
    to_arabic_indic,
)


def _safe(v) -> str:
    return "" if v is None else str(v)


# 80mm width, ~297mm tall page (we clip with showPage when content done).
RECEIPT_WIDTH_MM = 80
RECEIPT_HEIGHT_MM = 297


def render_arabic_receipt(receipt: dict, output_path: Optional[str] = None) -> bytes:
    """Render a thermal-receipt-sized PDF in Arabic / Kurdish.

    ``receipt`` shape:
        {
            "receipt_no": "POS-000123",
            "issue_date": "2026-05-29T13:45:00",
            "company": {"name": ..., "phone": ..., "address": ...},
            "lines": [{"description": ..., "qty": 1, "unit_price": 5000, "total": 5000}, ...],
            "subtotal": 5000,
            "tax_total": 0,
            "grand_total": 5000,
            "payment_method": "cash",
            "locale": "ar",
            "use_arabic_indic": True,
        }
    """
    from reportlab.lib.pagesizes import mm
    from reportlab.pdfgen import canvas as rl_canvas

    font_name = register_arabic_font()
    locale = receipt.get("locale", "ar")
    use_ai = bool(receipt.get("use_arabic_indic", True))
    currency = receipt.get("currency", "IQD")

    width = RECEIPT_WIDTH_MM * mm
    height = RECEIPT_HEIGHT_MM * mm

    buf = BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(width, height))
    y = height - 10 * mm
    margin_x = 3 * mm

    def _line(text: str, *, font_size: int = 9, bold: bool = False, center: bool = False) -> None:
        nonlocal y
        c.setFont(font_name, font_size)
        rendered = shape_rtl(text)
        if center:
            c.drawCentredString(width / 2, y, rendered)
        else:
            # RTL → right-align
            c.drawRightString(width - margin_x, y, rendered)
        y -= (font_size + 3)

    company = receipt.get("company", {})
    _line(_safe(company.get("name")), font_size=12, center=True)
    if company.get("phone"):
        _line(format_iraqi_phone(company.get("phone"), use_arabic_indic=use_ai), font_size=9, center=True)
    if company.get("address"):
        _line(_safe(company.get("address")), font_size=8, center=True)

    y -= 2 * mm
    # divider
    c.setStrokeColorRGB(0, 0, 0)
    c.line(margin_x, y, width - margin_x, y)
    y -= 4 * mm

    receipt_no = _safe(receipt.get("receipt_no"))
    if use_ai:
        receipt_no = to_arabic_indic(receipt_no)
    _line(f"رقم الوصل: {receipt_no}" if locale.startswith("ar") else f"ژمارەی وەسڵ: {receipt_no}")
    _line(
        ("التاريخ: " if locale.startswith("ar") else "بەروار: ")
        + format_date_iraqi(receipt.get("issue_date"), locale=locale, use_arabic_indic=use_ai)
    )

    y -= 2 * mm
    c.line(margin_x, y, width - margin_x, y)
    y -= 4 * mm

    # Items
    for line in receipt.get("lines", []) or []:
        qty = line.get("qty", 0)
        unit = line.get("unit_price", 0)
        total = line.get("total", float(qty) * float(unit))
        desc = _safe(line.get("description"))
        qty_str = to_arabic_indic(str(qty)) if use_ai else str(qty)
        _line(desc, font_size=9)
        total_str = format_amount(total, currency, locale=locale, use_arabic_indic=use_ai)
        unit_str = format_amount(unit, currency, locale=locale, use_arabic_indic=use_ai)
        _line(f"{qty_str} × {unit_str} = {total_str}", font_size=9)

    y -= 2 * mm
    c.line(margin_x, y, width - margin_x, y)
    y -= 4 * mm

    subtotal = receipt.get("subtotal", 0)
    tax_total = receipt.get("tax_total", 0)
    grand = receipt.get("grand_total", subtotal + tax_total)
    _line(
        ("المجموع الفرعي: " if locale.startswith("ar") else "کۆی بنەڕەت: ")
        + format_amount(subtotal, currency, locale=locale, use_arabic_indic=use_ai)
    )
    if tax_total:
        _line(
            ("الضريبة: " if locale.startswith("ar") else "باج: ")
            + format_amount(tax_total, currency, locale=locale, use_arabic_indic=use_ai)
        )
    _line(
        ("المجموع: " if locale.startswith("ar") else "کۆی گشتی: ")
        + format_amount(grand, currency, locale=locale, use_arabic_indic=use_ai),
        font_size=11,
    )

    pm = receipt.get("payment_method")
    if pm:
        _line(("الدفع: " if locale.startswith("ar") else "پارەدان: ") + str(pm), font_size=9)

    y -= 4 * mm
    _line(
        "شكراً لتعاملكم معنا" if locale.startswith("ar") else "سوپاس بۆ کڕینەکەت",
        font_size=10, center=True,
    )

    c.showPage()
    c.save()

    pdf_bytes = buf.getvalue()
    if output_path:
        with open(output_path, "wb") as fh:
            fh.write(pdf_bytes)
    return pdf_bytes
