"""Arabic invoice PDF template (R4.12).

Generates an A4 invoice in Arabic with RTL layout, Naskh font, optional
Arabic-Indic digits, and an optional Hijri date below the Gregorian one.

Public API
----------
:py:func:`render_arabic_invoice(invoice, output_path=None) -> bytes`

If ``output_path`` is None the bytes are returned; otherwise the file is
written and the bytes are also returned.

``invoice`` is the canonical dict shape used by the rest of the app:

    {
        "invoice_no": "INV-000123",
        "issue_date": "2026-05-29",
        "due_date": "2026-06-29",
        "currency": "IQD",
        "company": {"name": "...", "tax_id": "...", "commercial_registration_no": "...", "phone": "...", "address": "..."},
        "customer": {"name": "...", "tax_id": "...", "phone": "...", "address": "..."},
        "lines": [{"description": "...", "qty": 1, "unit_price": 100000, "total": 100000}, ...],
        "subtotal": 100000,
        "tax_total": 0,
        "wht_withheld": 3000,
        "grand_total": 100000,
        "net_payable": 97000,
        "locale": "ar",
        "use_arabic_indic": True,
        "show_hijri": True,
    }
"""
from __future__ import annotations

from io import BytesIO
from typing import Optional

from app.pdf.arabic_typesetter import (
    register_arabic_font,
    rtl_paragraph_style,
    shape_rtl,
)
from app.pdf.iraqi_formatter import (
    format_amount,
    format_date_iraqi,
    format_iqd,
    format_iraqi_phone,
    format_page_number,
    to_arabic_indic,
)


def _safe(v) -> str:
    return "" if v is None else str(v)


def render_arabic_invoice(invoice: dict, output_path: Optional[str] = None) -> bytes:
    """Render a single-page Arabic invoice."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate,
        Paragraph,
        Spacer,
        Table,
        TableStyle,
    )

    font_name = register_arabic_font()
    locale = invoice.get("locale", "ar")
    use_ai = bool(invoice.get("use_arabic_indic", True))
    show_hijri = bool(invoice.get("show_hijri", False))
    currency = invoice.get("currency", "IQD")

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=15 * mm, leftMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=20 * mm,
        title=f"Invoice {invoice.get('invoice_no', '')}",
        author=invoice.get("company", {}).get("name", "Kurdish ERP"),
    )

    style = rtl_paragraph_style(font_name=font_name)
    header_style = rtl_paragraph_style(font_name=font_name)
    header_style.fontSize = 18
    header_style.leading = 22

    story: list = []

    # Header
    company = invoice.get("company", {})
    customer = invoice.get("customer", {})

    story.append(Paragraph(shape_rtl(f"فاتورة — {_safe(company.get('name'))}"), header_style))
    story.append(Spacer(1, 6 * mm))

    inv_no = _safe(invoice.get("invoice_no"))
    if use_ai:
        inv_no = to_arabic_indic(inv_no)
    issue = format_date_iraqi(invoice.get("issue_date"), locale=locale, use_arabic_indic=use_ai, with_hijri=show_hijri)
    due = format_date_iraqi(invoice.get("due_date"), locale=locale, use_arabic_indic=use_ai, with_hijri=False)

    meta_rows = [
        [shape_rtl(f"رقم الفاتورة: {inv_no}")],
        [shape_rtl(f"التاريخ: {issue}")],
        [shape_rtl(f"تاريخ الاستحقاق: {due}")],
    ]
    meta_table = Table(meta_rows, colWidths=[180 * mm])
    meta_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 6 * mm))

    # Parties
    party_rows = [
        [shape_rtl("البائع"), shape_rtl("المشتري")],
        [shape_rtl(_safe(company.get("name"))), shape_rtl(_safe(customer.get("name")))],
        [shape_rtl(f"الرقم الضريبي: {_safe(company.get('tax_id'))}"),
         shape_rtl(f"الرقم الضريبي: {_safe(customer.get('tax_id'))}")],
        [shape_rtl(f"التسجيل التجاري: {_safe(company.get('commercial_registration_no'))}"),
         shape_rtl("")],
        [shape_rtl(format_iraqi_phone(company.get("phone"), use_arabic_indic=use_ai)),
         shape_rtl(format_iraqi_phone(customer.get("phone"), use_arabic_indic=use_ai))],
    ]
    party_table = Table(party_rows, colWidths=[90 * mm, 90 * mm])
    party_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("FONTSIZE", (0, 0), (-1, 0), 11),
    ]))
    story.append(party_table)
    story.append(Spacer(1, 6 * mm))

    # Lines table — columns RTL: total | qty×price | description (rightmost reads first in RTL)
    line_header = [
        shape_rtl("المجموع"),
        shape_rtl("سعر الوحدة"),
        shape_rtl("الكمية"),
        shape_rtl("الوصف"),
    ]
    line_data = [line_header]
    for line in invoice.get("lines", []) or []:
        qty = line.get("qty", 0)
        unit = line.get("unit_price", 0)
        total = line.get("total", float(qty) * float(unit))
        qty_str = to_arabic_indic(str(qty)) if use_ai else str(qty)
        line_data.append([
            shape_rtl(format_amount(total, currency, locale=locale, use_arabic_indic=use_ai)),
            shape_rtl(format_amount(unit, currency, locale=locale, use_arabic_indic=use_ai)),
            qty_str,
            shape_rtl(_safe(line.get("description"))),
        ])

    lines_table = Table(line_data, colWidths=[35 * mm, 35 * mm, 20 * mm, 90 * mm])
    lines_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(lines_table)
    story.append(Spacer(1, 6 * mm))

    # Totals — placed right-aligned so RTL reading order works
    subtotal = invoice.get("subtotal", 0)
    tax_total = invoice.get("tax_total", 0)
    wht = invoice.get("wht_withheld", 0)
    grand = invoice.get("grand_total", subtotal + tax_total)
    net_pay = invoice.get("net_payable", grand - wht)

    totals_rows = [
        [shape_rtl(format_amount(subtotal, currency, locale=locale, use_arabic_indic=use_ai)),
         shape_rtl("المجموع الفرعي:")],
        [shape_rtl(format_amount(tax_total, currency, locale=locale, use_arabic_indic=use_ai)),
         shape_rtl("الضريبة:")],
        [shape_rtl(format_amount(wht, currency, locale=locale, use_arabic_indic=use_ai)),
         shape_rtl("ضريبة الاستقطاع:")],
        [shape_rtl(format_amount(grand, currency, locale=locale, use_arabic_indic=use_ai)),
         shape_rtl("المجموع الإجمالي:")],
        [shape_rtl(format_amount(net_pay, currency, locale=locale, use_arabic_indic=use_ai)),
         shape_rtl("الصافي المستحق الدفع:")],
    ]
    totals_table = Table(totals_rows, colWidths=[60 * mm, 50 * mm])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("LINEABOVE", (0, -2), (-1, -2), 0.5, colors.grey),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.black),
        ("FONTSIZE", (0, -1), (-1, -1), 12),
    ]))
    # Push to the right side of the page
    wrap = Table([[totals_table]], colWidths=[180 * mm])
    wrap.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "RIGHT")]))
    story.append(wrap)

    # Footer with page number drawn in onPage callback
    def _on_page(canvas, doc_):
        canvas.saveState()
        canvas.setFont(font_name, 9)
        text = format_page_number(doc_.page, doc_.page, locale=locale, use_arabic_indic=use_ai)
        canvas.drawRightString(A4[0] - 15 * mm, 10 * mm, shape_rtl(text))
        canvas.restoreState()

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
    pdf_bytes = buf.getvalue()
    if output_path:
        with open(output_path, "wb") as fh:
            fh.write(pdf_bytes)
    return pdf_bytes
