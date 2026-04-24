"""OCR receipt extraction.

Strategy:
- If `pytesseract` + Tesseract binary are available, run OCR on uploaded image.
- Otherwise, return a structured stub (status='unconfigured') so the UI can still
  let users edit and create the bill manually.
- Heuristic parser extracts: vendor, date, total, tax, line items.
"""
from __future__ import annotations

import base64
import io
import re
from datetime import datetime
from typing import Any, Optional

try:
    from PIL import Image  # type: ignore
    _PIL_OK = True
except Exception:  # pragma: no cover
    _PIL_OK = False

try:
    import pytesseract  # type: ignore
    _TESS_OK = True
except Exception:  # pragma: no cover
    _TESS_OK = False


_AMOUNT_RX = re.compile(r"(?:total|amount|grand|sum|\u06a9\u06c6|\u06af\u0634\u062a\u06cc)\D*([\d,]+\.\d{1,2}|[\d,]+)", re.I)
_DATE_RX = re.compile(r"\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})\b")
_TAX_RX = re.compile(r"(?:tax|vat|\u0628\u0627\u062c)\D*([\d,]+\.\d{1,2}|[\d,]+)", re.I)
_LINE_RX = re.compile(r"^(.{2,40}?)\s+([\d,]+\.\d{2})\s*$", re.M)


def _to_float(s: str) -> float:
    try:
        return float(s.replace(",", ""))
    except Exception:
        return 0.0


def _normalize_date(raw: str) -> str:
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return raw


def parse_text(text: str) -> dict[str, Any]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    vendor = lines[0] if lines else ""

    date = ""
    m = _DATE_RX.search(text)
    if m:
        date = _normalize_date(m.group(1))

    total = 0.0
    m = _AMOUNT_RX.search(text)
    if m:
        total = _to_float(m.group(1))

    tax = 0.0
    m = _TAX_RX.search(text)
    if m:
        tax = _to_float(m.group(1))

    items: list[dict[str, Any]] = []
    for match in _LINE_RX.finditer(text):
        desc = match.group(1).strip()
        amount = _to_float(match.group(2))
        if amount > 0 and len(desc) >= 2 and not _AMOUNT_RX.search(match.group(0)):
            items.append({"description": desc, "amount": amount})
    return {
        "vendor": vendor,
        "date": date or datetime.utcnow().strftime("%Y-%m-%d"),
        "total": total,
        "tax": tax,
        "subtotal": round(total - tax, 2) if total else 0,
        "currency": "IQD",
        "items": items[:25],
    }


def extract_from_image(content: bytes, *, languages: str = "eng+ara") -> dict[str, Any]:
    if not (_PIL_OK and _TESS_OK):
        return {
            "status": "unconfigured",
            "message": "Tesseract / Pillow not installed. Returning empty template.",
            "raw_text": "",
            "parsed": parse_text(""),
            "image_base64": base64.b64encode(content).decode("ascii"),
        }
    try:
        image = Image.open(io.BytesIO(content))
        text = pytesseract.image_to_string(image, lang=languages)
        return {
            "status": "ok",
            "raw_text": text,
            "parsed": parse_text(text),
            "image_base64": base64.b64encode(content).decode("ascii"),
        }
    except Exception as exc:  # pragma: no cover
        return {
            "status": "error",
            "message": str(exc),
            "raw_text": "",
            "parsed": parse_text(""),
            "image_base64": base64.b64encode(content).decode("ascii"),
        }


def parse_text_payload(text: str) -> dict[str, Any]:
    """Path used when caller already has OCR text from a 3rd-party service."""
    return {
        "status": "ok",
        "raw_text": text,
        "parsed": parse_text(text),
    }
