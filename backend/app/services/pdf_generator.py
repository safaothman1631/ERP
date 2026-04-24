"""PDF Generator Service for invoices, quotes, purchase orders, and reports."""
import io
import os
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    RTL_SUPPORT = True
except ImportError:
    RTL_SUPPORT = False

from app.firestore.invoices import InvoiceRepository, QuoteRepository
from app.firestore.bills import PurchaseOrderRepository
from app.firestore.organizations import OrganizationRepository
from app.firestore.contacts import ContactRepository
from app.firestore.einvoice import EInvoiceSubmissionRepository
from app.firestore.system import SettingsRepository
from app.services.einvoice_service import generate_fiscal_id, generate_qr_payload, generate_qr_png_bytes, merge_einvoice_config


HEADER_COLOR = colors.HexColor("#1890ff")
TEXT_COLOR = colors.HexColor("#333333")
LIGHT_BG = colors.HexColor("#f0f5ff")
BORDER_COLOR = colors.HexColor("#d9d9d9")

# Register Kurdish/Arabic fonts
FONTS_DIR = Path(__file__).parent.parent.parent / "fonts"
_fonts_registered = False

def _register_fonts():
    """Register NotoSansArabic fonts for RTL support"""
    global _fonts_registered
    if _fonts_registered:
        return
    
    try:
        regular_path = FONTS_DIR / "NotoSansArabic-Regular.ttf"
        bold_path = FONTS_DIR / "NotoSansArabic-Bold.ttf"
        
        if regular_path.exists():
            pdfmetrics.registerFont(TTFont("NotoArabic", str(regular_path)))
        if bold_path.exists():
            pdfmetrics.registerFont(TTFont("NotoArabic-Bold", str(bold_path)))
        
        _fonts_registered = True
    except Exception as e:
        print(f"Warning: Could not register Kurdish fonts: {e}")


def _reshape_text(text: str, lang: str = "en") -> str:
    """Reshape Arabic/Kurdish text for RTL display"""
    if lang != "ku" or not RTL_SUPPORT or not text:
        return text
    
    try:
        reshaped = arabic_reshaper.reshape(text)
        return get_display(reshaped)
    except:
        return text


def _format_iqd(amount: float, lang: str = "en") -> str:
    """Format amount as IQD currency: ١,٢٥٠,٠٠٠ د.ع (ku) or 1,250,000 IQD (en)"""
    formatted = f"{amount:,.0f}"
    if lang == "ku":
        return _reshape_text(f"{formatted} د.ع", lang)
    return f"{formatted} IQD"


def _get_styles(lang: str = "en"):
    """Get PDF styles with appropriate fonts for language"""
    _register_fonts()
    
    # Choose font based on language
    if lang == "ku" and _fonts_registered:
        base_font = "NotoArabic"
        bold_font = "NotoArabic-Bold"
    else:
        base_font = "Helvetica"
        bold_font = "Helvetica-Bold"
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="TitleCustom",
        fontName=bold_font,
        fontSize=18,
        textColor=HEADER_COLOR,
        spaceAfter=6 * mm,
        alignment=TA_RIGHT if lang == "ku" else TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        name="SubTitle",
        fontName=base_font,
        fontSize=10,
        textColor=TEXT_COLOR,
        spaceAfter=2 * mm,
        alignment=TA_RIGHT if lang == "ku" else TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        name="SmallText",
        fontName=base_font,
        fontSize=8,
        textColor=TEXT_COLOR,
        alignment=TA_RIGHT if lang == "ku" else TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        name="RightAligned",
        fontName=base_font,
        fontSize=10,
        textColor=TEXT_COLOR,
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        name="CenterText",
        fontName=base_font,
        fontSize=9,
        textColor=TEXT_COLOR,
        alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        name="DocBody",
        fontName=base_font,
        fontSize=10,
        textColor=TEXT_COLOR,
        alignment=TA_RIGHT if lang == "ku" else TA_LEFT,
    ))
    return styles


def _build_org_header(org: dict, styles, lang: str = "en") -> list:
    """Build organization header section"""
    elements = []

    # Organization name
    org_name = _reshape_text(org.get("name", ""), lang)
    elements.append(Paragraph(org_name, styles["TitleCustom"]))

    # Contact info
    info_parts = []
    if org.get("address_line1"):
        info_parts.append(_reshape_text(org["address_line1"], lang))
    if org.get("city"):
        info_parts.append(_reshape_text(org["city"], lang))
    if org.get("country"):
        info_parts.append(_reshape_text(org["country"], lang))
    if info_parts:
        separator = " - " if lang == "en" else " - "
        elements.append(Paragraph(separator.join(info_parts), styles["SubTitle"]))

    contact_parts = []
    if org.get("phone"):
        contact_parts.append(f"Tel: {org['phone']}")
    if org.get("email"):
        contact_parts.append(f"Email: {org['email']}")
    if org.get("tax_number"):
        contact_parts.append(f"Tax#: {org['tax_number']}")
    if contact_parts:
        elements.append(Paragraph(" | ".join(contact_parts), styles["SmallText"]))

    elements.append(Spacer(1, 6 * mm))
    return elements


def _build_document_info(title: str, number: str, date_str: str, due_date_str: str, styles, lang: str = "en") -> list:
    """Build document info table (number, date, due date)"""
    title_text = _reshape_text(title, lang)
    
    if lang == "ku":
        data = [
            [title_text, ""],
            [_reshape_text("ژمارە / Number:", lang), number],
            [_reshape_text("بەروار / Date:", lang), date_str],
        ]
        if due_date_str:
            data.append([_reshape_text("بەرواری دوایی / Due:", lang), due_date_str])
    else:
        data = [
            [title, ""],
            ["Number:", number],
            ["Date:", date_str],
        ]
        if due_date_str:
            data.append(["Due Date:", due_date_str])

    table = Table(data, colWidths=[60 * mm, 80 * mm])
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), styles["TitleCustom"].fontName),
        ("FONTSIZE", (0, 0), (-1, 0), 14),
        ("TEXTCOLOR", (0, 0), (-1, 0), HEADER_COLOR),
        ("FONTNAME", (0, 1), (0, -1), styles["SubTitle"].fontName),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("TEXTCOLOR", (0, 1), (-1, -1), TEXT_COLOR),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("ALIGN", (0, 0), (-1, -1), "RIGHT" if lang == "ku" else "LEFT"),
    ]))
    return [table, Spacer(1, 4 * mm)]


def _build_contact_info(contact: dict, styles, lang: str = "en") -> list:
    """Build contact/customer info"""
    elements = []
    
    label = _reshape_text("بۆ / Bill To:", lang) if lang == "ku" else "Bill To:"
    elements.append(Paragraph(label, styles["SubTitle"]))
    
    display_name = _reshape_text(contact.get("display_name", ""), lang)
    elements.append(Paragraph(display_name, styles["DocBody"]))
    
    if contact.get("company_name"):
        company = _reshape_text(contact["company_name"], lang)
        elements.append(Paragraph(company, styles["SmallText"]))
    if contact.get("email"):
        elements.append(Paragraph(contact["email"], styles["SmallText"]))
    if contact.get("phone"):
        elements.append(Paragraph(contact["phone"], styles["SmallText"]))
    elements.append(Spacer(1, 6 * mm))
    return elements


def _build_lines_table(lines: list, currency_code: str = "IQD", lang: str = "en") -> Table:
    """Build items/lines table"""
    
    if lang == "ku":
        # RTL layout: reversed columns
        header = [
            _reshape_text("کۆ / Total", lang),
            _reshape_text("باج / Tax", lang),
            _reshape_text("نرخی یەکە / Price", lang),
            _reshape_text("بڕ / Qty", lang),
            _reshape_text("وەسف / Description", lang),
            "#"
        ]
        
        data = [header]
        for i, line in enumerate(lines, 1):
            desc = _reshape_text(line.get("description", ""), lang)
            data.append([
                _format_iqd(float(line.get("line_total", 0)), lang),  # Total
                _format_iqd(float(line.get("tax_amount", 0)), lang),   # Tax
                _format_iqd(float(line.get("unit_price", 0)), lang),   # Price
                f"{float(line.get('quantity', 0)):,.2f}",              # Qty
                desc,                                                   # Description
                str(i),                                                 # #
            ])
        
        col_widths = [30 * mm, 25 * mm, 30 * mm, 20 * mm, 70 * mm, 10 * mm]
        align_header = "CENTER"
        align_numbers = "LEFT"  # Numbers left-aligned in RTL
        align_text = "RIGHT"    # Text right-aligned in RTL
        
    else:
        # LTR layout: normal order
        header = ["#", "Description", "Qty", "Price", "Tax", "Total"]
        data = [header]
        
        for i, line in enumerate(lines, 1):
            desc = line.get("description", "")
            data.append([
                str(i),
                desc,
                f"{float(line.get('quantity', 0)):,.2f}",
                _format_iqd(float(line.get("unit_price", 0)), lang),
                _format_iqd(float(line.get("tax_amount", 0)), lang),
                _format_iqd(float(line.get("line_total", 0)), lang),
            ])
        
        col_widths = [10 * mm, 70 * mm, 20 * mm, 30 * mm, 25 * mm, 30 * mm]
        align_header = "CENTER"
        align_numbers = "RIGHT"
        align_text = "LEFT"

    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "NotoArabic-Bold" if lang == "ku" and _fonts_registered else "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (0, 0), (-1, 0), align_header),
        # Body
        ("FONTNAME", (0, 1), (-1, -1), "NotoArabic" if lang == "ku" and _fonts_registered else "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("TEXTCOLOR", (0, 1), (-1, -1), TEXT_COLOR),
        # Alignment
        ("ALIGN", (0, 1), (2, -1), align_numbers) if lang == "ku" else ("ALIGN", (2, 1), (-1, -1), align_numbers),
        ("ALIGN", (-1, 1), (-1, -1), "CENTER"),  # Row number always centered
        # Grid
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        # Padding
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def _build_totals(subtotal: float, tax: float, discount: float, shipping: float, adjustment: float, total: float, balance_due: float | None = None, lang: str = "en") -> Table:
    """Build totals summary table"""
    
    if lang == "ku":
        data = [
            [_format_iqd(subtotal, lang), _reshape_text("کۆی ناخاو / Subtotal:", lang)],
        ]
        if discount:
            data.append([f"-{_format_iqd(discount, lang)}", _reshape_text("داشکان / Discount:", lang)])
        if tax:
            data.append([_format_iqd(tax, lang), _reshape_text("باج / Tax:", lang)])
        if shipping:
            data.append([_format_iqd(shipping, lang), _reshape_text("بارکردن / Shipping:", lang)])
        if adjustment:
            data.append([_format_iqd(adjustment, lang), _reshape_text("ڕێکخستن / Adjustment:", lang)])
        data.append([_format_iqd(total, lang), _reshape_text("کۆی گشتی / Total:", lang)])
        if balance_due is not None:
            data.append([_format_iqd(balance_due, lang), _reshape_text("باڵانس / Balance Due:", lang)])
        
        align_label = "RIGHT"
        align_value = "LEFT"
    else:
        data = [
            ["Subtotal:", _format_iqd(subtotal, lang)],
        ]
        if discount:
            data.append(["Discount:", f"-{_format_iqd(discount, lang)}"])
        if tax:
            data.append(["Tax:", _format_iqd(tax, lang)])
        if shipping:
            data.append(["Shipping:", _format_iqd(shipping, lang)])
        if adjustment:
            data.append(["Adjustment:", _format_iqd(adjustment, lang)])
        data.append(["Total:", _format_iqd(total, lang)])
        if balance_due is not None:
            data.append(["Balance Due:", _format_iqd(balance_due, lang)])
        
        align_label = "LEFT"
        align_value = "RIGHT"

    table = Table(data, colWidths=[50 * mm, 40 * mm] if lang == "en" else [40 * mm, 50 * mm])
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "NotoArabic" if lang == "ku" and _fonts_registered else "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, -1), TEXT_COLOR),
        ("ALIGN", (0, 0), (0, -1), align_value if lang == "ku" else align_label),
        ("ALIGN", (1, 0), (1, -1), align_label if lang == "ku" else align_value),
        ("FONTNAME", (0, -1), (-1, -1), "NotoArabic-Bold" if lang == "ku" and _fonts_registered else "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 1, HEADER_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return table


def _build_einvoice_panel(org_id: str, invoice: dict, styles, lang: str = "en") -> list:
    try:
        config = merge_einvoice_config(
            SettingsRepository(org_id).get_by_key("einvoice_config", "integrations") or {}
        )
        submission = EInvoiceSubmissionRepository(org_id).get_by_invoice_id(invoice["id"])
        if not submission and not config.get("enabled"):
            return []

        seller_tax_id = (submission or {}).get("seller_tax_id") or config.get("seller_tax_id") or ""
        fiscal_id = (submission or {}).get("fiscal_id") or generate_fiscal_id(invoice)
        qr_payload = (submission or {}).get("qr_payload") or generate_qr_payload(invoice, seller_tax_id, fiscal_id)
        qr_png = generate_qr_png_bytes(qr_payload)
        qr_image = Image(io.BytesIO(qr_png), width=28 * mm, height=28 * mm)

        status = (submission or {}).get("status") or ("generated" if config.get("enabled") else "not_configured")
        title = _reshape_text("زانیاری e-Invoice", lang) if lang == "ku" else "E-Invoice"
        status_label = _reshape_text(f"دۆخ: {status}", lang) if lang == "ku" else f"Status: {status}"
        fiscal_label = _reshape_text(f"Fiscal ID: {fiscal_id}", lang) if lang == "ku" else f"Fiscal ID: {fiscal_id}"
        seller_label = _reshape_text(f"Tax ID: {seller_tax_id or '-'}", lang) if lang == "ku" else f"Tax ID: {seller_tax_id or '-'}"

        text_rows = [
            Paragraph(f"<b>{title}</b>", styles["SubTitle"]),
            Paragraph(status_label, styles["SmallText"]),
            Paragraph(fiscal_label, styles["SmallText"]),
            Paragraph(seller_label, styles["SmallText"]),
        ]
        text_table = Table([[row] for row in text_rows], colWidths=[75 * mm])
        text_table.setStyle(TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]))

        panel = Table([[text_table, qr_image]], colWidths=[95 * mm, 30 * mm])
        panel.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        return [panel, Spacer(1, 4 * mm)]
    except Exception:
        return []


def _build_notes_terms(notes: str | None, terms: str | None, styles, lang: str = "en") -> list:
    """Build notes and terms section"""
    elements = []
    
    if notes:
        elements.append(Spacer(1, 4 * mm))
        label = _reshape_text("تێبینی / Notes:", lang) if lang == "ku" else "Notes:"
        elements.append(Paragraph(label, styles["SubTitle"]))
        note_text = _reshape_text(notes, lang)
        elements.append(Paragraph(note_text, styles["SmallText"]))
    
    if terms:
        elements.append(Spacer(1, 3 * mm))
        label = _reshape_text("مەرجەکان / Terms:", lang) if lang == "ku" else "Terms & Conditions:"
        elements.append(Paragraph(label, styles["SubTitle"]))
        terms_text = _reshape_text(terms, lang)
        elements.append(Paragraph(terms_text, styles["SmallText"]))
    
    return elements


def generate_invoice_pdf(org_id: str, invoice_id: str, org_data: dict, lang: str = "en") -> io.BytesIO:
    """Generate PDF for an invoice
    
    Args:
        org_id: Organization ID
        invoice_id: Invoice ID
        org_data: Organization data dictionary
        lang: Language code ('en' or 'ku'). Default 'en'
    """
    invoice_repo = InvoiceRepository(org_id)
    invoice = invoice_repo.get(invoice_id)
    if not invoice:
        raise ValueError("پسووڵە نەدۆزرایەوە")

    # Get lines
    lines = invoice_repo.get_lines(invoice_id)
    
    # Get contact
    contact = None
    if invoice.get("contact_id"):
        contact_repo = ContactRepository(org_id)
        contact = contact_repo.get(invoice["contact_id"])

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm)
    styles = _get_styles(lang)
    elements = []

    # Header
    elements.extend(_build_org_header(org_data, styles, lang))

    # Document info
    date_str = str(invoice.get("date", ""))[:10]
    due_str = str(invoice.get("due_date", ""))[:10]
    title = _reshape_text("پسووڵە / Invoice", lang) if lang == "ku" else "Invoice"
    elements.extend(_build_document_info(title, invoice.get("invoice_number", ""), date_str, due_str, styles, lang))

    # Status
    status_map = {
        "draft": "ڕەشنووس", "sent": "نێردراو", "partially_paid": "بەشێک پارەدراو",
        "paid": "پارەدراو", "overdue": "دواکەوتوو", "void": "هەڵوەشێنراوە"
    }
    status_key = invoice.get("status", "")
    if lang == "ku":
        status_text = _reshape_text(f"بار / Status: {status_map.get(status_key, status_key)}", lang)
    else:
        status_text = f"Status: {status_key.replace('_', ' ').title()}"
    elements.append(Paragraph(status_text, styles["SubTitle"]))
    elements.append(Spacer(1, 3 * mm))
    elements.extend(_build_einvoice_panel(org_id, invoice, styles, lang))

    # Contact
    if contact:
        elements.extend(_build_contact_info(contact, styles, lang))

    # Lines table
    if lines:
        elements.append(_build_lines_table(lines, invoice.get("currency_code", "IQD"), lang))
        elements.append(Spacer(1, 4 * mm))

    # Totals - right aligned
    totals = _build_totals(
        float(invoice.get("subtotal", 0)), float(invoice.get("tax_amount", 0)),
        float(invoice.get("discount_amount", 0)), float(invoice.get("shipping_charge", 0)),
        float(invoice.get("adjustment", 0)), float(invoice.get("total", 0)),
        float(invoice.get("balance_due", 0)), lang
    )
    # Wrap totals in a table to right-align
    if lang == "ku":
        wrapper = Table([[totals, None]], colWidths=[90 * mm, 95 * mm])
    else:
        wrapper = Table([[None, totals]], colWidths=[95 * mm, 90 * mm])
    wrapper.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(wrapper)

    # Notes & Terms
    elements.extend(_build_notes_terms(invoice.get("notes"), invoice.get("terms"), styles, lang))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_quote_pdf(org_id: str, quote_id: str, org_data: dict, lang: str = "en") -> io.BytesIO:
    """Generate PDF for a quote
    
    Args:
        org_id: Organization ID
        quote_id: Quote ID
        org_data: Organization data dictionary
        lang: Language code ('en' or 'ku'). Default 'en'
    """
    quote_repo = QuoteRepository(org_id)
    quote = quote_repo.get(quote_id)
    if not quote:
        raise ValueError("پێشنیار نەدۆزرایەوە")

    # Get lines
    lines = quote_repo.get_lines(quote_id)

    # Get contact
    contact = None
    if quote.get("contact_id"):
        contact_repo = ContactRepository(org_id)
        contact = contact_repo.get(quote["contact_id"])

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm)
    styles = _get_styles(lang)
    elements = []

    # Header
    elements.extend(_build_org_header(org_data, styles, lang))

    # Document info
    date_str = str(quote.get("date", ""))[:10]
    expiry_str = str(quote.get("expiry_date", ""))[:10]
    title = _reshape_text("پێشنیار / Quote", lang) if lang == "ku" else "Quote"
    elements.extend(_build_document_info(title, quote.get("quote_number", ""), date_str, expiry_str, styles, lang))

    # Contact
    if contact:
        elements.extend(_build_contact_info(contact, styles, lang))

    # Lines table
    if lines:
        elements.append(_build_lines_table(lines, quote.get("currency_code", "IQD"), lang))
        elements.append(Spacer(1, 4 * mm))

    # Totals
    totals = _build_totals(
        float(quote.get("subtotal", 0)), float(quote.get("tax_amount", 0)),
        float(quote.get("discount_amount", 0)), 0, 0, float(quote.get("total", 0)),
        None, lang
    )
    if lang == "ku":
        wrapper = Table([[totals, None]], colWidths=[90 * mm, 95 * mm])
    else:
        wrapper = Table([[None, totals]], colWidths=[95 * mm, 90 * mm])
    wrapper.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(wrapper)

    # Notes & Terms
    elements.extend(_build_notes_terms(quote.get("notes"), quote.get("terms"), styles, lang))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_purchase_order_pdf(org_id: str, po_id: str, org_data: dict, lang: str = "en") -> io.BytesIO:
    """Generate PDF for a purchase order
    
    Args:
        org_id: Organization ID
        po_id: Purchase Order ID
        org_data: Organization data dictionary
        lang: Language code ('en' or 'ku'). Default 'en'
    """
    po_repo = PurchaseOrderRepository(org_id)
    po = po_repo.get(po_id)
    if not po:
        raise ValueError("داواکاری کڕین نەدۆزرایەوە")

    # Get lines
    lines = po_repo.get_lines(po_id)

    # Get contact
    contact = None
    if po.get("contact_id"):
        contact_repo = ContactRepository(org_id)
        contact = contact_repo.get(po["contact_id"])

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm)
    styles = _get_styles(lang)
    elements = []

    # Header
    elements.extend(_build_org_header(org_data, styles, lang))

    # Document info
    date_str = str(po.get("date", ""))[:10]
    delivery_str = str(po.get("delivery_date", ""))[:10]
    title = _reshape_text("داواکاری کڕین / Purchase Order", lang) if lang == "ku" else "Purchase Order"
    elements.extend(_build_document_info(title, po.get("order_number", ""), date_str, delivery_str, styles, lang))

    # Contact (Vendor)
    if contact:
        vendor_label = _reshape_text("دابینکەر / Vendor:", lang) if lang == "ku" else "Vendor:"
        elements.append(Paragraph(vendor_label, styles["SubTitle"]))
        display_name = _reshape_text(contact.get("display_name", ""), lang)
        elements.append(Paragraph(display_name, styles["DocBody"]))
        if contact.get("email"):
            elements.append(Paragraph(contact["email"], styles["SmallText"]))
        elements.append(Spacer(1, 6 * mm))

    # Lines table
    if lines:
        elements.append(_build_lines_table(lines, po.get("currency_code", "IQD"), lang))
        elements.append(Spacer(1, 4 * mm))

    # Totals
    totals = _build_totals(
        float(po.get("subtotal", 0)), float(po.get("tax_amount", 0)),
        float(po.get("discount_amount", 0)), 0, 0, float(po.get("total", 0)),
        None, lang
    )
    if lang == "ku":
        wrapper = Table([[totals, None]], colWidths=[90 * mm, 95 * mm])
    else:
        wrapper = Table([[None, totals]], colWidths=[95 * mm, 90 * mm])
    wrapper.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(wrapper)

    # Notes & Terms
    elements.extend(_build_notes_terms(po.get("notes"), po.get("terms"), styles, lang))

    doc.build(elements)
    buffer.seek(0)
    return buffer


def generate_report_pdf(title: str, columns: list[str], rows: list[list], org_data: dict, lang: str = "en") -> io.BytesIO:
    """Generate PDF for a generic report
    
    Args:
        title: Report title
        columns: List of column headers
        rows: List of rows (each row is a list of values)
        org_data: Organization data dictionary
        lang: Language code ('en' or 'ku'). Default 'en'
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm)
    styles = _get_styles(lang)
    elements = []

    # Header
    elements.extend(_build_org_header(org_data, styles, lang))

    # Report title
    title_text = _reshape_text(title, lang)
    elements.append(Paragraph(title_text, styles["TitleCustom"]))
    elements.append(Spacer(1, 6 * mm))

    # Reshape columns and rows for RTL
    if lang == "ku":
        columns = [_reshape_text(col, lang) for col in columns]
        rows = [[_reshape_text(str(cell), lang) for cell in row] for row in rows]

    # Table
    data = [columns] + rows

    # Calculate column widths
    page_width = A4[0] - 30 * mm
    col_count = len(columns)
    col_width = page_width / col_count if col_count > 0 else page_width

    table = Table(data, colWidths=[col_width] * col_count, repeatRows=1)
    table.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "NotoArabic-Bold" if lang == "ku" and _fonts_registered else "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        # Body
        ("FONTNAME", (0, 1), (-1, -1), "NotoArabic" if lang == "ku" and _fonts_registered else "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("TEXTCOLOR", (0, 1), (-1, -1), TEXT_COLOR),
        ("ALIGN", (0, 1), (-1, -1), "RIGHT" if lang == "ku" else "LEFT"),
        # Grid
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        # Padding
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(table)

    doc.build(elements)
    buffer.seek(0)
    return buffer
