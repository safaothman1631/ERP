"""
Unit tests for input sanitization utilities.

Covers:
  - XSS protection: dangerous HTML tags and event handlers are stripped
  - SQL injection detection heuristic
  - Identifier sanitization
  - Deep dict/list sanitization
  - Null-byte removal
  - Full sanitize_string pipeline

Requirements: 6.1 (OWASP Top 10), 6.7 (input sanitization)
"""
from __future__ import annotations

import pytest
from app.utils.sanitization import (
    sanitize_html,
    sanitize_text,
    sanitize_string,
    sanitize_dict,
    sanitize_identifier,
    contains_sql_injection,
    strip_null_bytes,
)


# ---------------------------------------------------------------------------
# 1. XSS — sanitize_html
# ---------------------------------------------------------------------------

class TestSanitizeHtml:
    """sanitize_html must strip dangerous HTML constructs."""

    def test_removes_script_tag(self):
        raw = '<script>alert("xss")</script>Hello'
        result = sanitize_html(raw)
        assert "<script>" not in result
        assert "alert" not in result

    def test_removes_script_tag_with_attributes(self):
        raw = '<script type="text/javascript">evil()</script>'
        result = sanitize_html(raw)
        assert "<script" not in result.lower()

    def test_removes_iframe_tag(self):
        raw = '<iframe src="https://evil.com"></iframe>'
        result = sanitize_html(raw)
        assert "<iframe" not in result.lower()

    def test_removes_onclick_event_handler(self):
        raw = '<div onclick="steal()">Click me</div>'
        result = sanitize_html(raw)
        assert "onclick" not in result.lower()

    def test_removes_onload_event_handler(self):
        raw = '<img src="x" onload="evil()">'
        result = sanitize_html(raw)
        assert "onload" not in result.lower()

    def test_removes_onerror_event_handler(self):
        raw = '<img src="x" onerror="evil()">'
        result = sanitize_html(raw)
        assert "onerror" not in result.lower()

    def test_removes_javascript_href(self):
        raw = '<a href="javascript:alert(1)">Click</a>'
        result = sanitize_html(raw)
        assert "javascript:" not in result.lower()

    def test_removes_vbscript_href(self):
        raw = '<a href="vbscript:msgbox(1)">Click</a>'
        result = sanitize_html(raw)
        assert "vbscript:" not in result.lower()

    def test_removes_html_comments(self):
        raw = "<!-- <script>evil()</script> -->Hello"
        result = sanitize_html(raw)
        assert "<!--" not in result
        assert "<script>" not in result

    def test_removes_object_tag(self):
        raw = '<object data="evil.swf"></object>'
        result = sanitize_html(raw)
        assert "<object" not in result.lower()

    def test_removes_embed_tag(self):
        raw = '<embed src="evil.swf">'
        result = sanitize_html(raw)
        assert "<embed" not in result.lower()

    def test_preserves_safe_text(self):
        raw = "Hello, World! This is safe text."
        result = sanitize_html(raw)
        assert result == raw

    def test_non_string_returned_unchanged(self):
        assert sanitize_html(42) == 42
        assert sanitize_html(None) is None
        assert sanitize_html(3.14) == 3.14

    def test_empty_string_returned_unchanged(self):
        assert sanitize_html("") == ""

    def test_removes_form_tag(self):
        raw = '<form action="/steal" method="POST"><input name="cc"></form>'
        result = sanitize_html(raw)
        assert "<form" not in result.lower()

    def test_removes_style_tag(self):
        raw = '<style>body { background: url("javascript:evil()") }</style>'
        result = sanitize_html(raw)
        assert "<style" not in result.lower()


# ---------------------------------------------------------------------------
# 2. Plain-text sanitization — sanitize_text
# ---------------------------------------------------------------------------

class TestSanitizeText:
    """sanitize_text must HTML-escape all special characters."""

    def test_escapes_less_than(self):
        assert "&lt;" in sanitize_text("<script>")

    def test_escapes_greater_than(self):
        assert "&gt;" in sanitize_text("</script>")

    def test_escapes_ampersand(self):
        assert "&amp;" in sanitize_text("AT&T")

    def test_escapes_double_quote(self):
        assert "&quot;" in sanitize_text('"quoted"')

    def test_escapes_single_quote(self):
        result = sanitize_text("it's")
        assert "'" not in result or "&#x27;" in result or "&apos;" in result

    def test_preserves_safe_text(self):
        raw = "Hello World 123"
        assert sanitize_text(raw) == raw

    def test_non_string_returned_unchanged(self):
        assert sanitize_text(42) == 42
        assert sanitize_text(None) is None

    def test_empty_string_returned_unchanged(self):
        assert sanitize_text("") == ""

    def test_full_xss_payload_escaped(self):
        raw = '<script>alert("xss")</script>'
        result = sanitize_text(raw)
        assert "<script>" not in result
        assert "&lt;script&gt;" in result


# ---------------------------------------------------------------------------
# 3. SQL injection detection — contains_sql_injection
# ---------------------------------------------------------------------------

class TestContainsSqlInjection:
    """contains_sql_injection must detect common SQL injection patterns."""

    def test_detects_select_statement(self):
        assert contains_sql_injection("' OR SELECT * FROM users --") is True

    def test_detects_drop_table(self):
        assert contains_sql_injection("'; DROP TABLE users; --") is True

    def test_detects_union_select(self):
        assert contains_sql_injection("' UNION SELECT password FROM users --") is True

    def test_detects_comment_injection(self):
        assert contains_sql_injection("admin'--") is True

    def test_detects_insert_statement(self):
        assert contains_sql_injection("'; INSERT INTO users VALUES ('evil')") is True

    def test_detects_delete_statement(self):
        assert contains_sql_injection("'; DELETE FROM users WHERE 1=1") is True

    def test_safe_text_not_flagged(self):
        assert contains_sql_injection("John Smith") is False

    def test_safe_email_not_flagged(self):
        assert contains_sql_injection("user@example.com") is False

    def test_safe_number_not_flagged(self):
        assert contains_sql_injection("12345") is False

    def test_non_string_returns_false(self):
        assert contains_sql_injection(42) is False
        assert contains_sql_injection(None) is False

    def test_empty_string_returns_false(self):
        assert contains_sql_injection("") is False


# ---------------------------------------------------------------------------
# 4. Identifier sanitization — sanitize_identifier
# ---------------------------------------------------------------------------

class TestSanitizeIdentifier:
    """sanitize_identifier must strip non-identifier characters."""

    def test_allows_alphanumeric(self):
        assert sanitize_identifier("field123") == "field123"

    def test_allows_underscore(self):
        assert sanitize_identifier("my_field") == "my_field"

    def test_allows_hyphen(self):
        assert sanitize_identifier("my-field") == "my-field"

    def test_allows_dot(self):
        assert sanitize_identifier("my.field") == "my.field"

    def test_strips_semicolon(self):
        result = sanitize_identifier("field; DROP TABLE")
        assert ";" not in result
        assert "DROP" not in result or result == "fieldDROPTABLE"

    def test_strips_single_quote(self):
        result = sanitize_identifier("field'")
        assert "'" not in result

    def test_strips_angle_brackets(self):
        result = sanitize_identifier("<script>")
        assert "<" not in result
        assert ">" not in result

    def test_non_string_returns_empty(self):
        assert sanitize_identifier(42) == ""
        assert sanitize_identifier(None) == ""

    def test_empty_string_returns_empty(self):
        assert sanitize_identifier("") == ""


# ---------------------------------------------------------------------------
# 5. Null-byte removal — strip_null_bytes
# ---------------------------------------------------------------------------

class TestStripNullBytes:
    """strip_null_bytes must remove null bytes from strings."""

    def test_removes_null_byte(self):
        assert strip_null_bytes("hello\x00world") == "helloworld"

    def test_removes_multiple_null_bytes(self):
        assert strip_null_bytes("\x00\x00test\x00") == "test"

    def test_safe_string_unchanged(self):
        assert strip_null_bytes("hello world") == "hello world"

    def test_non_string_returned_unchanged(self):
        assert strip_null_bytes(42) == 42
        assert strip_null_bytes(None) is None

    def test_empty_string_returned_unchanged(self):
        assert strip_null_bytes("") == ""


# ---------------------------------------------------------------------------
# 6. Deep dict/list sanitization — sanitize_dict
# ---------------------------------------------------------------------------

class TestSanitizeDict:
    """sanitize_dict must recursively sanitize all string values."""

    def test_sanitizes_top_level_string_value(self):
        data = {"name": '<script>alert("xss")</script>'}
        result = sanitize_dict(data)
        assert "<script>" not in result["name"]

    def test_sanitizes_nested_dict(self):
        data = {"user": {"bio": '<img onerror="evil()">'}}
        result = sanitize_dict(data)
        assert "onerror" not in result["user"]["bio"].lower()

    def test_sanitizes_list_of_strings(self):
        data = ["<script>evil()</script>", "safe text"]
        result = sanitize_dict(data)
        assert "<script>" not in result[0]
        assert result[1] == "safe text"

    def test_sanitizes_list_inside_dict(self):
        data = {"tags": ["<script>", "safe"]}
        result = sanitize_dict(data)
        assert "<script>" not in result["tags"][0]
        assert result["tags"][1] == "safe"

    def test_preserves_non_string_values(self):
        data = {"count": 42, "active": True, "price": 3.14}
        result = sanitize_dict(data)
        assert result["count"] == 42
        assert result["active"] is True
        assert result["price"] == 3.14

    def test_html_escape_mode_escapes_all_html(self):
        data = {"name": "<b>Bold</b>"}
        result = sanitize_dict(data, html_escape=True)
        assert "&lt;" in result["name"]
        assert "<b>" not in result["name"]

    def test_empty_dict_returned_unchanged(self):
        assert sanitize_dict({}) == {}

    def test_empty_list_returned_unchanged(self):
        assert sanitize_dict([]) == []

    def test_scalar_string_sanitized(self):
        result = sanitize_dict('<script>evil()</script>')
        assert "<script>" not in result

    def test_scalar_non_string_returned_unchanged(self):
        assert sanitize_dict(42) == 42
        assert sanitize_dict(None) is None


# ---------------------------------------------------------------------------
# 7. Full pipeline — sanitize_string
# ---------------------------------------------------------------------------

class TestSanitizeString:
    """sanitize_string must apply the full sanitization pipeline."""

    def test_removes_null_bytes(self):
        result = sanitize_string("hello\x00world")
        assert "\x00" not in result

    def test_strips_dangerous_html(self):
        result = sanitize_string('<script>alert("xss")</script>')
        assert "<script>" not in result

    def test_truncates_to_max_length(self):
        result = sanitize_string("a" * 100, max_length=10)
        assert len(result) == 10

    def test_no_truncation_when_max_length_none(self):
        value = "a" * 50
        result = sanitize_string(value)
        assert len(result) == 50

    def test_safe_string_preserved(self):
        result = sanitize_string("Hello, World!")
        assert result == "Hello, World!"

    def test_non_string_returned_unchanged(self):
        assert sanitize_string(42) == 42
        assert sanitize_string(None) is None

    def test_combined_null_byte_and_xss(self):
        raw = '\x00<script>evil()</script>'
        result = sanitize_string(raw)
        assert "\x00" not in result
        assert "<script>" not in result
