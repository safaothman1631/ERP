"""
Unit tests for the environment documentation generator.

Tests cover:
  - Registry completeness (all 7 required env vars are documented)
  - Required/optional status for each variable
  - Sensitive variable handling (SECRET_KEY never exposed)
  - Markdown documentation generation
  - .env.example generation
  - Lookup helpers

Requirements: 2.1, 2.2, 2.5
"""

from __future__ import annotations

import pytest

from app.utils.env_docs import (
    ENV_VAR_REGISTRY,
    EnvVarDoc,
    generate_env_example,
    generate_markdown_docs,
    get_env_var_doc,
    list_optional_vars,
    list_required_vars,
    list_sensitive_vars,
    write_env_example,
)


# ─────────────────────────────────────────────────────────────────────────────
# Registry completeness
# ─────────────────────────────────────────────────────────────────────────────

# Requirement 2.2 — all 7 variables must be documented
REQUIRED_VAR_NAMES = {
    "DATABASE_URL",
    "SECRET_KEY",
    "ENVIRONMENT",
    "DEBUG",
    "CORS_ORIGINS",
    "FIREBASE_CREDENTIALS_PATH",
    "APP_NAME",
}


def test_registry_contains_all_required_variables():
    """All 7 environment variables from Requirement 2.2 must be in the registry."""
    registered_names = {v.name for v in ENV_VAR_REGISTRY}
    missing = REQUIRED_VAR_NAMES - registered_names
    assert not missing, f"Missing variables in registry: {missing}"


def test_registry_entries_are_env_var_doc_instances():
    """Every entry in the registry must be an EnvVarDoc instance."""
    for entry in ENV_VAR_REGISTRY:
        assert isinstance(entry, EnvVarDoc), f"{entry!r} is not an EnvVarDoc"


def test_registry_names_are_unique():
    """No duplicate variable names in the registry."""
    names = [v.name for v in ENV_VAR_REGISTRY]
    assert len(names) == len(set(names)), "Duplicate variable names found in registry"


# ─────────────────────────────────────────────────────────────────────────────
# Required / optional status
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("var_name", ["DATABASE_URL", "SECRET_KEY", "ENVIRONMENT", "CORS_ORIGINS"])
def test_production_required_variables(var_name: str):
    """Core variables must be marked as required in production."""
    doc = get_env_var_doc(var_name)
    assert doc is not None, f"{var_name} not found in registry"
    assert doc.required is True, f"{var_name} should be required but is marked optional"


@pytest.mark.parametrize("var_name", ["APP_NAME", "DEBUG", "FIREBASE_CREDENTIALS_PATH"])
def test_optional_variables(var_name: str):
    """Variables with safe defaults must be marked as optional."""
    doc = get_env_var_doc(var_name)
    assert doc is not None, f"{var_name} not found in registry"
    assert doc.required is False, f"{var_name} should be optional but is marked required"


def test_list_required_vars_returns_only_required():
    required = list_required_vars()
    assert all(v.required for v in required)
    assert len(required) > 0


def test_list_optional_vars_returns_only_optional():
    optional = list_optional_vars()
    assert all(not v.required for v in optional)
    assert len(optional) > 0


def test_required_and_optional_cover_full_registry():
    """Required + optional must equal the full registry."""
    required = list_required_vars()
    optional = list_optional_vars()
    assert len(required) + len(optional) == len(ENV_VAR_REGISTRY)


# ─────────────────────────────────────────────────────────────────────────────
# Sensitive variable handling — Requirement 2.5
# ─────────────────────────────────────────────────────────────────────────────

def test_secret_key_is_marked_sensitive():
    """SECRET_KEY must be flagged as sensitive (Requirement 2.5)."""
    doc = get_env_var_doc("SECRET_KEY")
    assert doc is not None
    assert doc.sensitive is True, "SECRET_KEY must be marked sensitive"


def test_sensitive_vars_list_includes_secret_key():
    sensitive = list_sensitive_vars()
    names = {v.name for v in sensitive}
    assert "SECRET_KEY" in names


def test_markdown_docs_do_not_expose_secret_key_example():
    """Markdown output must not contain the SECRET_KEY example value."""
    doc = get_env_var_doc("SECRET_KEY")
    assert doc is not None
    markdown = generate_markdown_docs()
    # The example value must not appear verbatim in the docs
    assert doc.example not in markdown, (
        "SECRET_KEY example value must not appear in generated Markdown docs"
    )


def test_env_example_uses_placeholder_for_secret_key():
    """The .env.example content must use the placeholder, not a real secret."""
    doc = get_env_var_doc("SECRET_KEY")
    assert doc is not None
    env_example = generate_env_example()
    # The line should contain the placeholder example, not a real key
    assert "SECRET_KEY=" in env_example
    # The example value is the safe placeholder defined in the registry
    assert doc.example in env_example


# ─────────────────────────────────────────────────────────────────────────────
# Markdown documentation generation
# ─────────────────────────────────────────────────────────────────────────────

def test_markdown_docs_contains_all_variable_names():
    """Every registered variable name must appear in the Markdown output."""
    markdown = generate_markdown_docs()
    for var in ENV_VAR_REGISTRY:
        assert var.name in markdown, f"{var.name} missing from Markdown docs"


def test_markdown_docs_contains_required_status():
    """Required variables must be labelled as required in the Markdown output."""
    markdown = generate_markdown_docs()
    for var in list_required_vars():
        assert "Required" in markdown


def test_markdown_docs_contains_category_headers():
    """Each category must appear as a Markdown section header."""
    markdown = generate_markdown_docs()
    categories = {v.category for v in ENV_VAR_REGISTRY}
    for category in categories:
        assert f"## {category}" in markdown, f"Category '{category}' missing from Markdown"


def test_markdown_docs_returns_string():
    result = generate_markdown_docs()
    assert isinstance(result, str)
    assert len(result) > 0


def test_markdown_docs_security_note_present():
    """The Markdown output must include a note about SECRET_KEY never being logged."""
    markdown = generate_markdown_docs()
    assert "SECRET_KEY" in markdown
    # Should mention it's never logged/returned
    assert "never" in markdown.lower() or "redacted" in markdown.lower()


# ─────────────────────────────────────────────────────────────────────────────
# .env.example generation
# ─────────────────────────────────────────────────────────────────────────────

def test_env_example_contains_all_variable_names():
    """Every registered variable must appear in the .env.example output."""
    env_example = generate_env_example()
    for var in ENV_VAR_REGISTRY:
        assert f"{var.name}=" in env_example, f"{var.name} missing from .env.example"


def test_env_example_contains_comments_by_default():
    """Default output includes comment lines."""
    env_example = generate_env_example()
    assert "#" in env_example


def test_env_example_without_comments():
    """When include_comments=False, no comment lines should appear."""
    env_example = generate_env_example(include_comments=False)
    lines = [l for l in env_example.splitlines() if l.strip()]
    comment_lines = [l for l in lines if l.startswith("#")]
    assert not comment_lines, "Expected no comment lines when include_comments=False"


def test_env_example_marks_required_vars():
    """Required variables must be annotated in the .env.example comments."""
    env_example = generate_env_example(include_comments=True)
    assert "REQUIRED" in env_example


def test_env_example_returns_string():
    result = generate_env_example()
    assert isinstance(result, str)
    assert len(result) > 0


# ─────────────────────────────────────────────────────────────────────────────
# Lookup helpers
# ─────────────────────────────────────────────────────────────────────────────

def test_get_env_var_doc_returns_correct_entry():
    doc = get_env_var_doc("DATABASE_URL")
    assert doc is not None
    assert doc.name == "DATABASE_URL"
    assert doc.category == "Database"


def test_get_env_var_doc_returns_none_for_unknown():
    doc = get_env_var_doc("NONEXISTENT_VAR")
    assert doc is None


def test_each_var_has_non_empty_description():
    """Every registered variable must have a non-empty description."""
    for var in ENV_VAR_REGISTRY:
        assert var.description.strip(), f"{var.name} has an empty description"


def test_each_var_has_non_empty_example():
    """Every registered variable must have a non-empty example value."""
    for var in ENV_VAR_REGISTRY:
        assert var.example.strip(), f"{var.name} has an empty example"


def test_each_var_has_a_category():
    """Every registered variable must have a non-empty category."""
    for var in ENV_VAR_REGISTRY:
        assert var.category.strip(), f"{var.name} has an empty category"


# ─────────────────────────────────────────────────────────────────────────────
# write_env_example (file I/O)
# ─────────────────────────────────────────────────────────────────────────────

def test_write_env_example_creates_file(tmp_path):
    """write_env_example must create the file at the given path."""
    output = tmp_path / ".env.example"
    result = write_env_example(output_path=output)
    assert result == output.resolve()
    assert output.exists()


def test_write_env_example_file_content_matches_generate(tmp_path):
    """The written file content must match generate_env_example() output."""
    output = tmp_path / ".env.example"
    write_env_example(output_path=output)
    written = output.read_text(encoding="utf-8")
    expected = generate_env_example(include_comments=True)
    assert written == expected
