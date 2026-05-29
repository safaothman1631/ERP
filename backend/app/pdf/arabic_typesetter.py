"""Arabic typesetting helpers for ReportLab PDFs (R4.12).

Wraps :py:mod:`arabic_reshaper` + :py:mod:`bidi.algorithm` so callers can
write ``shape_rtl("الفاتورة")`` and get back a glyph-correct, BIDI-resolved
string that renders correctly when drawn by ReportLab.

Font registration
-----------------
We try to register **Noto Naskh Arabic** (preferred) from a documented
location at ``app/static/fonts/NotoNaskhArabic-Regular.ttf``; if that file is
missing we fall back to **Amiri** at the same directory; if both are missing
we fall back to ReportLab's built-in ``Helvetica`` and log a warning. The
templates should still render — only the glyphs will look generic Latin.

Hijri date
----------
:py:func:`gregorian_to_hijri_str` uses the ``hijri-converter`` library when
available (declared in ``_deltas/G4b-deps.md``). If the library is not
installed, the function returns an empty string so callers can skip the
Hijri line silently. No template should break for a missing optional dep.
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime
from typing import Union

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────
# Fonts
# ─────────────────────────────────────────────────────────────────────────

ARABIC_FONT_NAME = "NotoNaskhArabic"
ARABIC_FONT_FALLBACK_NAME = "Amiri"

# Documented font path. Ops/Dev provisioning must drop the .ttf files here.
# See ``_deltas/G4b-l10n-summary.md`` § PDF font verification.
_FONT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "fonts")
NOTO_NASKH_PATH = os.path.join(_FONT_DIR, "NotoNaskhArabic-Regular.ttf")
AMIRI_PATH = os.path.join(_FONT_DIR, "Amiri-Regular.ttf")

_FONT_REGISTERED: str | None = None


def register_arabic_font() -> str:
    """Register the Arabic font with ReportLab once. Returns the font name in use.

    Safe to call repeatedly — registration is cached. Always returns a string
    (falls back to ``"Helvetica"`` when no Arabic font is available).
    """
    global _FONT_REGISTERED
    if _FONT_REGISTERED:
        return _FONT_REGISTERED
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except Exception:  # pragma: no cover - reportlab always present in this repo
        _FONT_REGISTERED = "Helvetica"
        return _FONT_REGISTERED

    candidates = [
        (ARABIC_FONT_NAME, NOTO_NASKH_PATH),
        (ARABIC_FONT_FALLBACK_NAME, AMIRI_PATH),
    ]
    for name, path in candidates:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(name, path))
                _FONT_REGISTERED = name
                return name
            except Exception as exc:  # pragma: no cover - reported via log
                logger.warning("Arabic font %s failed to register: %s", name, exc)

    logger.warning(
        "No Arabic font file found at %s. Falling back to Helvetica — "
        "Arabic glyphs will render as boxes. See _deltas/G4b-l10n-summary.md.",
        _FONT_DIR,
    )
    _FONT_REGISTERED = "Helvetica"
    return _FONT_REGISTERED


# ─────────────────────────────────────────────────────────────────────────
# Shaping
# ─────────────────────────────────────────────────────────────────────────


def shape_rtl(text: str) -> str:
    """Apply Arabic glyph shaping + BIDI ordering for ReportLab.

    Returns the string unchanged if the optional libraries are not available
    (they are declared in ``backend/requirements.txt`` — this guard exists for
    test environments without them installed).
    """
    if not text:
        return ""
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display
    except Exception:  # pragma: no cover - both libs required by requirements.txt
        return text
    try:
        reshaped = arabic_reshaper.reshape(str(text))
        return get_display(reshaped)
    except Exception:
        return text


# ─────────────────────────────────────────────────────────────────────────
# RTL paragraph wrapper
# ─────────────────────────────────────────────────────────────────────────


def rtl_paragraph_style(base_style=None, font_name: str | None = None):
    """Return a :class:`reportlab.lib.styles.ParagraphStyle` configured for RTL.

    Lazy-imports ReportLab so this module can be unit-tested without it.
    """
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT

    style = ParagraphStyle(
        "RTL",
        parent=base_style,
        alignment=TA_RIGHT,
        fontName=font_name or register_arabic_font(),
        fontSize=11,
        leading=16,
        wordWrap="RTL",
    )
    return style


# ─────────────────────────────────────────────────────────────────────────
# Hijri
# ─────────────────────────────────────────────────────────────────────────


def gregorian_to_hijri_str(
    value: Union[date, datetime, str],
    *,
    use_arabic_indic: bool = False,
) -> str:
    """Convert a Gregorian date to a localised Hijri string.

    Format ``DD MM-name YYYY هـ`` (Arabic). Returns ``""`` when the conversion
    library is unavailable or the input cannot be parsed.
    """
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "")).date()
        except Exception:
            return ""
    if isinstance(value, datetime):
        value = value.date()
    if not isinstance(value, date):
        return ""

    try:
        from hijri_converter import Gregorian  # type: ignore
        h = Gregorian(value.year, value.month, value.day).to_hijri()
        day, month_num, year = h.day, h.month, h.year
        month_name = h.month_name("ar") if hasattr(h, "month_name") else _HIJRI_MONTHS_AR[month_num - 1]
    except Exception:
        try:
            # Fallback: ``Intl`` does month-name via stdlib's ``locale`` poorly
            # under Windows. ``ummalqura`` packages (e.g. ``umalqurra``) work
            # if installed, but we don't require them.
            from umalqurra.hijri_date import HijriDate  # type: ignore
            h = HijriDate(value.year, value.month, value.day, gr=True)
            day, month_num, year = int(h.day), int(h.month), int(h.year)
            month_name = _HIJRI_MONTHS_AR[month_num - 1]
        except Exception:
            return ""

    digits_day = str(day)
    digits_year = str(year)
    if use_arabic_indic:
        from app.pdf.iraqi_formatter import to_arabic_indic
        digits_day = to_arabic_indic(digits_day)
        digits_year = to_arabic_indic(digits_year)
    return f"{digits_day} {month_name} {digits_year} هـ"


_HIJRI_MONTHS_AR = (
    "محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
    "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
)
