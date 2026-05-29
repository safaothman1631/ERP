"""Iraqi number / date / currency / phone formatters for PDFs (R4.9 / R4.11).

All functions are **pure** and import nothing from ReportLab — they are used
both by the PDF templates and by API endpoints that produce JSON.

IQD formatting rules (R4.9)
---------------------------
  * No decimals
  * Thousands separator: ``U+066C`` (ARABIC THOUSANDS SEPARATOR ``٬``) in
    Arabic / Kurdish; standard comma in Latin.
  * Suffix ``د.ع`` (Arabic) or ``IQD`` (English)
  * RTL positioning handled by the typesetter — the formatter just returns
    the string; layout is the template's job.

Arabic-Indic digits (R4.8)
--------------------------
Optional per tenant. The transformer :py:func:`to_arabic_indic` rewrites
0-9 → ٠-٩ inside any string. The reverse :py:func:`to_latin_digits` exists
for input normalisation.

Phone (Iraq E.164)
------------------
``+964 7XX XXX XXXX``. ``format_iraqi_phone`` accepts loose input and
returns either the canonical formatted string or the original on failure
(no exceptions — phone formatting must never break a PDF render).
"""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional, Union


# ─────────────────────────────────────────────────────────────────────────
# Digits
# ─────────────────────────────────────────────────────────────────────────

_LATIN_TO_INDIC = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")
_INDIC_TO_LATIN = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def to_arabic_indic(text: str) -> str:
    """Rewrite any 0-9 in ``text`` as Arabic-Indic ٠-٩."""
    if text is None:
        return ""
    return str(text).translate(_LATIN_TO_INDIC)


def to_latin_digits(text: str) -> str:
    if text is None:
        return ""
    return str(text).translate(_INDIC_TO_LATIN)


# ─────────────────────────────────────────────────────────────────────────
# Currency
# ─────────────────────────────────────────────────────────────────────────

ARABIC_THOUSANDS_SEP = "٬"   # ٬
ARABIC_DECIMAL_SEP = "٫"     # ٫


def format_iqd(
    amount: Union[int, float],
    *,
    locale: str = "ku",
    use_arabic_indic: bool = False,
    with_suffix: bool = True,
) -> str:
    """Format IQD per R4.9 — no decimals, locale-aware thousands separator.

    ``locale`` is the BCP-47 language prefix (``ku`` / ``ar`` / ``en``).
    """
    try:
        value = int(round(float(amount or 0)))
    except (TypeError, ValueError):
        value = 0

    sep = ARABIC_THOUSANDS_SEP if locale.startswith(("ku", "ar", "fa")) else ","
    base = f"{value:,}".replace(",", sep)
    if use_arabic_indic:
        base = to_arabic_indic(base)
    if not with_suffix:
        return base
    suffix = " د.ع" if locale.startswith(("ku", "ar", "fa")) else " IQD"
    return f"{base}{suffix}"


def format_amount(
    amount: Union[int, float],
    currency: str = "IQD",
    *,
    locale: str = "ku",
    use_arabic_indic: bool = False,
) -> str:
    """Format any currency for PDF use. IQD goes through ``format_iqd``;
    everything else uses 2 decimals.
    """
    if currency.upper() == "IQD":
        return format_iqd(amount, locale=locale, use_arabic_indic=use_arabic_indic)
    try:
        value = float(amount or 0)
    except (TypeError, ValueError):
        value = 0.0
    sep = ARABIC_THOUSANDS_SEP if locale.startswith(("ku", "ar", "fa")) else ","
    dec_sep = ARABIC_DECIMAL_SEP if locale.startswith(("ku", "ar", "fa")) else "."
    integer_part, _, frac_part = f"{value:,.2f}".partition(".")
    integer_part = integer_part.replace(",", sep)
    rendered = f"{integer_part}{dec_sep}{frac_part}"
    if use_arabic_indic:
        rendered = to_arabic_indic(rendered)
    return f"{rendered} {currency.upper()}"


# ─────────────────────────────────────────────────────────────────────────
# Date
# ─────────────────────────────────────────────────────────────────────────


def format_date_dmy(
    value: Union[date, datetime, str],
    *,
    locale: str = "ku",
    use_arabic_indic: bool = False,
) -> str:
    """Render ``dd/mm/yyyy`` — the standard Iraqi document format."""
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "")).date()
        except Exception:
            return value
    if isinstance(value, datetime):
        value = value.date()
    if not isinstance(value, date):
        return ""
    s = f"{value.day:02d}/{value.month:02d}/{value.year:04d}"
    if use_arabic_indic and locale.startswith(("ku", "ar", "fa")):
        s = to_arabic_indic(s)
    return s


def format_date_iraqi(
    value: Union[date, datetime, str],
    *,
    locale: str = "ku",
    use_arabic_indic: bool = False,
    with_hijri: bool = False,
) -> str:
    """Convenience wrapper. ``with_hijri=True`` appends Hijri after Gregorian.

    Hijri conversion lives in :py:mod:`app.pdf.arabic_typesetter` to keep this
    file free of the optional ``hijri-converter`` dependency.
    """
    gregorian = format_date_dmy(value, locale=locale, use_arabic_indic=use_arabic_indic)
    if not with_hijri:
        return gregorian
    try:
        from app.pdf.arabic_typesetter import gregorian_to_hijri_str
        hijri = gregorian_to_hijri_str(value, use_arabic_indic=use_arabic_indic)
    except Exception:
        hijri = ""
    if hijri:
        return f"{gregorian} ({hijri})"
    return gregorian


# ─────────────────────────────────────────────────────────────────────────
# Phone
# ─────────────────────────────────────────────────────────────────────────

_IRAQ_PHONE_RE = re.compile(r"^\+?(?:964)?(7\d{9})$")


def format_iraqi_phone(raw: Optional[str], *, use_arabic_indic: bool = False) -> str:
    """Render an Iraqi mobile in canonical ``+964 7XX XXX XXXX`` form.

    Accepts: ``07701234567``, ``+9647701234567``, ``00964 770 123 4567``, …
    Returns the original input on any failure — phone formatting must never
    abort PDF generation.
    """
    if not raw:
        return ""
    text = str(raw).strip()
    # Strip 00 international prefix
    if text.startswith("00"):
        text = "+" + text[2:]
    # Strip non-digits except leading +
    leading_plus = text.startswith("+")
    digits = re.sub(r"\D", "", text)
    if leading_plus:
        digits = "+" + digits  # type: ignore[assignment]
    # Local form 07XXXXXXXXX → +964 7XX…
    if digits.startswith("0") and len(digits) == 11 and digits[1] == "7":
        digits = "+964" + digits[1:]
    elif digits.startswith("964") and not digits.startswith("+"):
        digits = "+" + digits
    m = _IRAQ_PHONE_RE.match(digits)
    if not m:
        return raw
    body = m.group(1)
    formatted = f"+964 {body[:3]} {body[3:6]} {body[6:]}"
    if use_arabic_indic:
        formatted = to_arabic_indic(formatted)
    return formatted


# ─────────────────────────────────────────────────────────────────────────
# Page numbering (Arabic-Indic when requested)
# ─────────────────────────────────────────────────────────────────────────


def format_page_number(
    page: int,
    total: int,
    *,
    locale: str = "ku",
    use_arabic_indic: bool = False,
) -> str:
    if locale.startswith(("ku", "ar", "fa")):
        template = "الصفحة {p} من {t}" if locale.startswith("ar") else "پەڕە {p} لە {t}"
    else:
        template = "Page {p} of {t}"
    s = template.format(p=page, t=total)
    if use_arabic_indic:
        s = to_arabic_indic(s)
    return s
