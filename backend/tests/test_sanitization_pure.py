"""Pure-logic unit tests for input sanitization helpers.

Targets ``app.utils.sanitization`` — XSS/SQLi defence-in-depth helpers built on
``html``/``re``/``unicodedata`` only (no Firestore/network). Covers
``sanitize_html`` (dangerous tag + attr + scheme stripping), ``sanitize_text``
(HTML escaping), ``contains_sql_injection`` (heuristic detection), and
``sanitize_identifier`` (NFKC normalize + whitelist).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.utils.sanitization import (
    contains_sql_injection,
    sanitize_html,
    sanitize_identifier,
    sanitize_text,
)


# ─────────────────────────────────────────────────────────────────────────
# sanitize_html
# ─────────────────────────────────────────────────────────────────────────


def test_sanitize_html_removes_script_and_inner_payload():
    out = sanitize_html('<script>alert("xss")</script>')
    assert "alert" not in out
    assert "<script" not in out


def test_sanitize_html_strips_sibling_script_blocks():
    out = sanitize_html("<script>a()</script>hello<script>b()</script>")
    assert "hello" in out
    assert "a()" not in out and "b()" not in out


def test_sanitize_html_removes_orphan_iframe():
    out = sanitize_html('<iframe src="evil"></iframe>safe')
    assert "iframe" not in out.lower()
    assert "safe" in out


def test_sanitize_html_removes_void_embed():
    out = sanitize_html('<embed src="x.swf">text')
    assert "embed" not in out.lower()
    assert "text" in out


def test_sanitize_html_strips_event_handler_attr():
    out = sanitize_html('<div onclick="steal()">x</div>')
    assert "onclick" not in out.lower()


def test_sanitize_html_strips_javascript_scheme():
    out = sanitize_html('<a href="javascript:alert(1)">link</a>')
    assert "javascript:" not in out.lower()


def test_sanitize_html_removes_comments():
    out = sanitize_html("before<!-- <script>hidden()</script> -->after")
    assert "hidden()" not in out
    assert "before" in out and "after" in out


def test_sanitize_html_keeps_plain_text():
    assert sanitize_html("just a normal sentence.") == "just a normal sentence."


def test_sanitize_html_non_string_passthrough():
    assert sanitize_html(123) == 123  # type: ignore[arg-type]
    assert sanitize_html(None) is None  # type: ignore[arg-type]


# ─────────────────────────────────────────────────────────────────────────
# sanitize_text — HTML escape everything
# ─────────────────────────────────────────────────────────────────────────


def test_sanitize_text_escapes_angle_brackets():
    assert sanitize_text("<b>hi</b>") == "&lt;b&gt;hi&lt;/b&gt;"


def test_sanitize_text_escapes_quotes_and_amp():
    out = sanitize_text("Tom & \"Jerry's\"")
    assert "&amp;" in out
    assert "&quot;" in out
    assert "&#x27;" in out


def test_sanitize_text_plain_passthrough():
    assert sanitize_text("plain name") == "plain name"


def test_sanitize_text_non_string_passthrough():
    assert sanitize_text(42) == 42  # type: ignore[arg-type]


# ─────────────────────────────────────────────────────────────────────────
# contains_sql_injection — heuristic
# ─────────────────────────────────────────────────────────────────────────


def test_sql_injection_detects_union_select():
    assert contains_sql_injection("1 UNION SELECT password FROM users") is True


def test_sql_injection_detects_comment_and_semicolon():
    assert contains_sql_injection("admin'; --") is True


def test_sql_injection_detects_drop_table():
    assert contains_sql_injection("'); DROP TABLE users; --") is True


def test_sql_injection_detects_hex_literal():
    assert contains_sql_injection("0xDEADBEEF") is True


def test_sql_injection_clean_string_false():
    assert contains_sql_injection("Acme Trading Company") is False


def test_sql_injection_non_string_false():
    assert contains_sql_injection(None) is False  # type: ignore[arg-type]
    assert contains_sql_injection(123) is False  # type: ignore[arg-type]


# ─────────────────────────────────────────────────────────────────────────
# sanitize_identifier — NFKC + whitelist [\w\-\.]
# ─────────────────────────────────────────────────────────────────────────


def test_sanitize_identifier_keeps_safe_chars():
    assert sanitize_identifier("my_field-name.v2") == "my_field-name.v2"


def test_sanitize_identifier_strips_unsafe_chars():
    assert sanitize_identifier("drop;table users") == "droptableusers"


def test_sanitize_identifier_strips_spaces_and_punctuation():
    assert sanitize_identifier("a b/c\\d*e") == "abcde"


def test_sanitize_identifier_nfkc_normalizes_fullwidth():
    # Fullwidth 'Ａ' (U+FF21) → ASCII 'A' after NFKC.
    assert sanitize_identifier("ＡＢＣ") == "ABC"


def test_sanitize_identifier_non_string_empty():
    assert sanitize_identifier(None) == ""  # type: ignore[arg-type]
    assert sanitize_identifier(123) == ""  # type: ignore[arg-type]
