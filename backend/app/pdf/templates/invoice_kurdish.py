"""Kurdish (Sorani) invoice PDF template (R4.12).

Kurdish Sorani uses the same Arabic script with two extra letters (ڕ, ڵ, ێ,
ۆ, ڤ, etc.) — Noto Naskh Arabic covers them in modern builds. We reuse the
Arabic typesetter for shaping and BIDI; only the headings change.
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
    format_iraqi_phone,
    format_page_number,
    to_arabic_indic,
)


def _safe(v) -> str:
    return "" if v is None else str(v)


def render_kurdish_invoice(invoice: dict, output_path: Optional[str] = None) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    font_name = register_arabic_font()
    locale = "ku"
    use_ai = bool(invoice.get("use_arabic_indic", False))
    show_hijri = bool(invoice.get("show_hijri", False))
    currency = invoice.get("currency", "IQD")

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=15 * mm, leftMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=20 * mm,
    )

    header_style = rtl_paragraph_style(font_name=font_name)
    header_style.fontSize = 18
    header_style.leading = 22

    story: list = []

    company = invoice.get("company", {})
    customer = invoice.get("customer", {})

    story.append(Paragraph(shape_rtl(f"فاتورە — {_safe(company.get('name'))}"), header_style))
    story.append(Spacer(1, 6 * mm))

    inv_no = _safe(invoice.get("invoice_no"))
    if use_ai:
        inv_no = to_arabic_indic(inv_no)
    issue = format_date_iraqi(invoice.get("issue_date"), locale=locale, use_arabic_indic=use_ai, with_hijri=show_hijri)
    due = format_date_iraqi(invoice.get("due_date"), locale=locale, use_arabic_indic=use_ai)

    meta_rows = [
        [shape_rtl(f"ژمارەی فاتورە: {inv_no}")],
        [shape_rtl(f"بەروار: {issue}")],
        [shape_rtl(f"بەرواری وادە: {due}")],
    ]
    meta = Table(meta_rows, colWidths=[180 * mm])
    meta.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
    ]))
    story.append(meta)
    story.append(Spacer(1, 6 * mm))

    party_rows = [
        [shape_rtl("فرۆشیار"), shape_rtl("کڕیار")],
        [shape_rtl(_safe(company.get("name"))), shape_rtl(_safe(customer.get("name")))],
        [shape_rtl(f"ژمارەی باج: {_safe(company.get('tax_id'))}"),
         shape_rtl(f"ژمارەی باج: {_safe(customer.get('tax_id'))}")],
        [shape_rtl(f"تۆماری بازرگانی: {_safe(company.get('commercial_registration_no'))}"),
         shape_rtl("")],
        [shape_rtl(format_iraqi_phone(company.get("phone"), use_arabic_indic=use_ai)),
         shape_rtl(format_iraqi_phone(customer.get("phone"), use_arabic_indic=use_ai))],
    ]
    pt = Table(party_rows, colWidths=[90 * mm, 90 * mm])
    pt.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
    ]))
    story.append(pt)
    story.append(Spacer(1, 6 * mm))

    line_header = [
        shape_rtl("کۆ"),
        shape_rtl("نرخی یەکە"),
        shape_rtl("بڕ"),
        shape_rtl("ناونیشان"),
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
    lt = Table(line_data, colWidths=[35 * mm, 35 * mm, 20 * mm, 90 * mm])
    lt.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
    ]))
    story.append(lt)
    story.append(Spacer(1, 6 * mm))

    subtotal = invoice.get("subtotal", 0)
    tax_total = invoice.get("tax_total", 0)
    wht = invoice.get("wht_withheld", 0)
    grand = invoice.get("grand_total", subtotal + tax_total)
    net_pay = invoice.get("net_payable", grand - wht)

    totals_rows = [
        [shape_rtl(format_amount(subtotal, currency, locale=locale, use_arabic_indic=use_ai)),
         shape_rtl("کۆی بنەڕەت:")],
        [shape_rtl(format_amount(tax_total, currency, locale=locale, use_arabic_indic=use_ai)),
         shape_rtl("باج:")],
        [shape_rtl(format_amount(wht, currency, locale=locale, use_arabic_indic=use_ai)),
         shape_rtl("باجی داشکاندن:")],
        [shape_rtl(format_amount(grand, currency, locale=locale, use_arabic_indic=use_ai)),
         shape_rtl("کۆی گشتی:")],
        [shape_rtl(format_amount(net_pay, currency, locale=locale, use_arabic_indic=use_ai)),
         shape_rtl("ڕەسەنی واجبی دانان:")],
    ]
    tt = Table(totals_rows, colWidths=[60 * mm, 50 * mm])
    tt.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.black),
        ("FONTSIZE", (0, -1), (-1, -1), 12),
    ]))
    wrap = Table([[tt]], colWidths=[180 * mm])
    wrap.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "RIGHT")]))
    story.append(wrap)

    def _on_page(canvas, doc_):
        canvas.saveState()
        canvas.setFont(font_name, 9)
        canvas.drawRightString(
            A4[0] - 15 * mm, 10 * mm,
            shape_rtl(format_page_number(doc_.page, doc_.page, locale=locale, use_arabic_indic=use_ai)),
        )
        canvas.restoreState()

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
    pdf_bytes = buf.getvalue()
    if output_path:
        with open(output_path, "wb") as fh:
            fh.write(pdf_bytes)
    return pdf_bytes
