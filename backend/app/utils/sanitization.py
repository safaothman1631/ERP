"""Input sanitization utilities for XSS and SQL Injection protection.

Provides helpers to sanitize user-supplied strings before they are stored
or returned in API responses.

Requirements: 6.1 (OWASP Top 10), 6.7 (input sanitization)
"""
from __future__ import annotations

import html
import re
import unicodedata
from typing import Any

# ─────────────────────────────────────────────────────────────────────────────
# XSS sanitization
# ─────────────────────────────────────────────────────────────────────────────

# Tag names that are never allowed even in rich-text contexts.  Stripped by
# both the paired-tag regex (which removes ``<tag>...</tag>`` plus everything
# in between) and the orphan-tag regex (which removes self-closing or
# unmatched dangerous tags).
_DANGEROUS_TAG_NAMES = (
    "script", "iframe", "object", "embed", "applet", "form", "input",
    "button", "link", "meta", "base", "style", "svg", "math", "template",
    "slot", "portal", "frame", "frameset", "noframes", "noscript",
    "xss", "vbscript",
)
_DANGEROUS_TAG_ALT = "|".join(_DANGEROUS_TAG_NAMES)

# Paired dangerous tags: ``<tag ...>...</tag>`` — the entire block including
# inner content is removed (this is what stops ``<script>alert()</script>``
# from leaking the inner ``alert()`` payload).  Lazy ``.*?`` so adjacent
# blocks are not merged.
_DANGEROUS_PAIRED_TAGS = re.compile(
    rf"<\s*({_DANGEROUS_TAG_ALT})\b[^>]*>.*?<\s*/\s*\1\s*>",
    re.IGNORECASE | re.DOTALL,
)

# Orphan dangerous tags: opening tags without a matching close, void/self-
# closing tags (``<embed ...>``, ``<input ...>``), and lone closing tags.
_DANGEROUS_TAGS = re.compile(
    rf"<\s*/?\s*({_DANGEROUS_TAG_ALT})\b[^>]*/?>",
    re.IGNORECASE,
)

# Event handler attributes (onclick, onload, onerror, …)
_EVENT_ATTRS = re.compile(r"\bon\w+\s*=", re.IGNORECASE)

# javascript: / vbscript: / data: URI schemes in attribute values
_DANGEROUS_SCHEMES = re.compile(
    r"""(href|src|action|formaction|xlink:href)\s*=\s*['"]?\s*(javascript|vbscript|data)\s*:""",
    re.IGNORECASE,
)

# HTML comment injection (<!-- ... -->)
_HTML_COMMENTS = re.compile(r"<!--.*?-->", re.DOTALL)


def sanitize_html(value: str) -> str:
    """Strip dangerous HTML constructs from a string.

    This is a *defence-in-depth* measure.  The primary XSS protection is the
    CSP header set in ``main.py``.  This function provides a second layer for
    data stored in Firestore and later rendered in the UI.

    The function:
    1. Removes HTML comments (which can hide payloads from naive scanners).
    2. Removes paired dangerous tags AND their inner content
       (``<script>alert()</script>`` → ``""``).
    3. Removes orphan/void dangerous tags (``<embed src=...>`` → ``""``).
    4. Removes event-handler attributes (onclick, onload, …).
    5. Removes javascript:/vbscript:/data: URI schemes.

    For plain-text fields (names, descriptions, etc.) use ``sanitize_text``
    which HTML-escapes everything.

    Args:
        value: Raw user-supplied string.

    Returns:
        Sanitized string safe for storage and display.
    """
    if not isinstance(value, str):
        return value

    # Step 1: remove HTML comments first so payloads hidden inside them are
    # never seen by the tag regexes.
    value = _HTML_COMMENTS.sub("", value)
    # Step 2: remove paired dangerous tags with their inner content
    # (e.g. <script>alert("xss")</script>).  Run repeatedly to handle nested
    # or sibling blocks revealed after the first sweep.
    while True:
        new_value = _DANGEROUS_PAIRED_TAGS.sub("", value)
        if new_value == value:
            break
        value = new_value
    # Step 3: remove any remaining orphan/void dangerous tags
    value = _DANGEROUS_TAGS.sub("", value)
    # Step 4: remove event handler attributes
    value = _EVENT_ATTRS.sub("", value)
    # Step 5: remove dangerous URI schemes
    value = _DANGEROUS_SCHEMES.sub("", value)
    return value


def sanitize_text(value: str) -> str:
    """HTML-escape a plain-text string.

    Use this for fields that should never contain HTML markup (names, notes,
    addresses, etc.).  All ``<``, ``>``, ``&``, ``"``, and ``'`` characters
    are replaced with their HTML entity equivalents.

    Args:
        value: Raw user-supplied string.

    Returns:
        HTML-escaped string.
    """
    if not isinstance(value, str):
        return value
    return html.escape(value, quote=True)


# ─────────────────────────────────────────────────────────────────────────────
# SQL Injection protection
# ─────────────────────────────────────────────────────────────────────────────

# Common SQL injection patterns
_SQL_INJECTION_PATTERNS = re.compile(
    r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|"
    r"TRUNCATE|GRANT|REVOKE|MERGE|CALL|DECLARE|CAST|CONVERT|CHAR|NCHAR|"
    r"VARCHAR|NVARCHAR|WAITFOR|DELAY|SLEEP|BENCHMARK|LOAD_FILE|OUTFILE|"
    r"DUMPFILE|INTO|FROM|WHERE|HAVING|GROUP\s+BY|ORDER\s+BY)\b"
    r"|--|;|/\*|\*/|xp_|sp_|0x[0-9a-fA-F]+)",
    re.IGNORECASE,
)

# Characters that are almost never legitimate in plain identifiers
_SUSPICIOUS_CHARS = re.compile(r"[;'\"\-\-/\*\\]")


def contains_sql_injection(value: str) -> bool:
    """Return True if the string looks like a SQL injection attempt.

    This is a heuristic check.  The primary SQL injection protection is the
    use of Firestore (a NoSQL database) and Pydantic validation — raw SQL is
    never constructed from user input.  This function provides an additional
    signal for logging/alerting.

    Args:
        value: User-supplied string to inspect.

    Returns:
        True if suspicious SQL patterns are detected.
    """
    if not isinstance(value, str):
        return False
    return bool(_SQL_INJECTION_PATTERNS.search(value))


def sanitize_identifier(value: str) -> str:
    """Sanitize a string intended to be used as a field name or identifier.

    Strips everything except alphanumeric characters, underscores, hyphens,
    and dots.  Useful for dynamic field names, collection names, etc.

    Args:
        value: Raw identifier string.

    Returns:
        Sanitized identifier string.
    """
    if not isinstance(value, str):
        return ""
    # Normalize unicode (e.g. fullwidth characters → ASCII)
    value = unicodedata.normalize("NFKC", value)
    # Keep only safe identifier characters
    return re.sub(r"[^\w\-\.]", "", value)


# ─────────────────────────────────────────────────────────────────────────────
# Generic deep sanitization for request payloads
# ─────────────────────────────────────────────────────────────────────────────

def sanitize_dict(data: Any, *, html_escape: bool = False) -> Any:
    """Recursively sanitize all string values in a dict/list structure.

    Walks the entire payload and applies ``sanitize_html`` (or
    ``sanitize_text`` when ``html_escape=True``) to every string value.
    Non-string values are left untouched.

    Args:
        data: A dict, list, or scalar value from a request payload.
        html_escape: When True, use ``sanitize_text`` (full HTML escape)
            instead of ``sanitize_html`` (tag stripping only).

    Returns:
        The sanitized data structure with the same shape as the input.
    """
    sanitize_fn = sanitize_text if html_escape else sanitize_html

    if isinstance(data, dict):
        return {k: sanitize_dict(v, html_escape=html_escape) for k, v in data.items()}
    if isinstance(data, list):
        return [sanitize_dict(item, html_escape=html_escape) for item in data]
    if isinstance(data, str):
        return sanitize_fn(data)
    return data


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI dependency for automatic request body sanitization
# ─────────────────────────────────────────────────────────────────────────────

def strip_null_bytes(value: str) -> str:
    """Remove null bytes from a string (prevents null-byte injection).

    Args:
        value: Raw string.

    Returns:
        String with null bytes removed.
    """
    if not isinstance(value, str):
        return value
    return value.replace("\x00", "")


def sanitize_string(value: str, *, max_length: int | None = None) -> str:
    """Full sanitization pipeline for a single string field.

    Applies in order:
    1. Null-byte removal
    2. HTML tag / event-handler stripping
    3. Optional length truncation

    Args:
        value: Raw user-supplied string.
        max_length: If provided, truncate the result to this many characters.

    Returns:
        Sanitized string.
    """
    if not isinstance(value, str):
        return value
    value = strip_null_bytes(value)
    value = sanitize_html(value)
    if max_length is not None:
        value = value[:max_length]
    return value
