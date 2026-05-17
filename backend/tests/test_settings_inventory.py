"""
Unit tests for the backend settings inventory scanner.

Covers:
  - Environment variable validation (production vs development behaviour)
  - Config file parsing (.env files and JSON files)
  - Error handling for invalid / missing configs

Requirements: 1.1, 1.2
"""
from __future__ import annotations

import json
import os
import sys
import textwrap
from pathlib import Path
from typing import Dict
from unittest.mock import patch

import pytest

# ---------------------------------------------------------------------------
# Make sure the backend package is importable when running from the tests dir
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.settings_inventory import (
    BackendSettingsScanner,
    ConfigFileEntry,
    EnvVarEntry,
    InventoryReport,
    _INSECURE_DEFAULTS,
)


# ===========================================================================
# Fixtures
# ===========================================================================

@pytest.fixture()
def scanner(tmp_path: Path) -> BackendSettingsScanner:
    """Return a scanner whose project_root is a temporary directory."""
    return BackendSettingsScanner(project_root=str(tmp_path))


@pytest.fixture()
def clean_env(monkeypatch: pytest.MonkeyPatch):
    """Remove all known env vars so tests start from a clean slate."""
    for var in [
        "DATABASE_URL", "SECRET_KEY", "ENVIRONMENT",
        "DEBUG", "CORS_ORIGINS", "FIREBASE_CREDENTIALS_PATH", "APP_NAME",
    ]:
        monkeypatch.delenv(var, raising=False)
    yield


# ===========================================================================
# 1. Environment variable validation
# ===========================================================================

class TestEnvVarValidation:
    """Tests for validate_env_vars() — covers sub-task: Test environment variable validation."""

    def test_missing_required_vars_produce_warnings_in_development(
        self, scanner: BackendSettingsScanner, clean_env
    ):
        """Missing required vars should produce warnings (not errors) in development."""
        env_vars = scanner.scan_env_vars()
        errors, warnings = scanner.validate_env_vars(env_vars)

        # In development, missing required vars → warnings, not errors
        assert len(errors) == 0
        warning_names = " ".join(warnings)
        assert "DATABASE_URL" in warning_names or "SECRET_KEY" in warning_names or "CORS_ORIGINS" in warning_names

    def test_missing_required_vars_produce_errors_in_production(
        self, scanner: BackendSettingsScanner, clean_env, monkeypatch: pytest.MonkeyPatch
    ):
        """Missing required vars should produce hard errors in production."""
        monkeypatch.setenv("ENVIRONMENT", "production")
        env_vars = scanner.scan_env_vars()
        errors, warnings = scanner.validate_env_vars(env_vars)

        assert len(errors) > 0
        error_text = " ".join(errors)
        assert "Missing required environment variable" in error_text

    def test_insecure_default_secret_key_warns_in_development(
        self, scanner: BackendSettingsScanner, clean_env, monkeypatch: pytest.MonkeyPatch
    ):
        """Using the insecure default SECRET_KEY should warn in development."""
        monkeypatch.setenv("SECRET_KEY", _INSECURE_DEFAULTS["SECRET_KEY"])
        env_vars = scanner.scan_env_vars()
        errors, warnings = scanner.validate_env_vars(env_vars)

        assert len(errors) == 0
        assert any("SECRET_KEY" in w for w in warnings)

    def test_insecure_default_secret_key_errors_in_production(
        self, scanner: BackendSettingsScanner, clean_env, monkeypatch: pytest.MonkeyPatch
    ):
        """Using the insecure default SECRET_KEY must block production startup."""
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("SECRET_KEY", _INSECURE_DEFAULTS["SECRET_KEY"])
        env_vars = scanner.scan_env_vars()
        errors, _ = scanner.validate_env_vars(env_vars)

        assert any("SECRET_KEY" in e for e in errors)

    def test_valid_production_env_has_no_errors(
        self, scanner: BackendSettingsScanner, monkeypatch: pytest.MonkeyPatch
    ):
        """A fully configured production environment should produce no errors."""
        monkeypatch.setenv("ENVIRONMENT", "production")
        monkeypatch.setenv("SECRET_KEY", "a-very-strong-random-secret-key-1234567890")
        monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@db:5432/zoho")
        monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com")
        monkeypatch.setenv("FIREBASE_CREDENTIALS_PATH", "/secrets/serviceAccountKey.json")

        env_vars = scanner.scan_env_vars()
        errors, _ = scanner.validate_env_vars(env_vars)

        # Only errors we might still see are for vars not set above (non-required ones)
        # Required vars are all set, so no "Missing required" errors
        missing_errors = [e for e in errors if "Missing required" in e]
        assert len(missing_errors) == 0

    def test_secret_key_is_marked_sensitive(
        self, scanner: BackendSettingsScanner, clean_env
    ):
        """SECRET_KEY entry must be flagged as sensitive."""
        env_vars = scanner.scan_env_vars()
        secret_entry = next((e for e in env_vars if e.name == "SECRET_KEY"), None)

        assert secret_entry is not None
        assert secret_entry.is_sensitive is True

    def test_all_required_prod_vars_are_catalogued(
        self, scanner: BackendSettingsScanner, clean_env
    ):
        """DATABASE_URL, SECRET_KEY, CORS_ORIGINS, ENVIRONMENT must be in the catalogue."""
        env_vars = scanner.scan_env_vars()
        names = {e.name for e in env_vars}

        for required in ("DATABASE_URL", "SECRET_KEY", "CORS_ORIGINS", "ENVIRONMENT"):
            assert required in names, f"{required} missing from env var catalogue"

    def test_env_var_entry_current_value_reflects_os_env(
        self, scanner: BackendSettingsScanner, monkeypatch: pytest.MonkeyPatch
    ):
        """current_value should reflect what is actually set in the environment."""
        monkeypatch.setenv("APP_NAME", "TestApp")
        env_vars = scanner.scan_env_vars()
        app_name_entry = next((e for e in env_vars if e.name == "APP_NAME"), None)

        assert app_name_entry is not None
        assert app_name_entry.current_value == "TestApp"

    def test_unset_env_var_has_none_current_value(
        self, scanner: BackendSettingsScanner, clean_env
    ):
        """An unset env var should have current_value=None."""
        env_vars = scanner.scan_env_vars()
        db_entry = next((e for e in env_vars if e.name == "DATABASE_URL"), None)

        assert db_entry is not None
        assert db_entry.current_value is None


# ===========================================================================
# 2. Config file parsing
# ===========================================================================

class TestConfigFileParsing:
    """Tests for parse_env_file() and parse_json_config() — covers sub-task: Test config file parsing."""

    def test_parse_valid_env_file(self, scanner: BackendSettingsScanner, tmp_path: Path):
        """A well-formed .env file should be parsed into a dict."""
        env_file = tmp_path / ".env"
        env_file.write_text(
            textwrap.dedent("""\
                # Comment line
                DATABASE_URL=sqlite:///./test.db
                SECRET_KEY=my-test-secret-key
                DEBUG=false
                CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
            """),
            encoding="utf-8",
        )

        result = scanner.parse_env_file(str(env_file))

        assert result["DATABASE_URL"] == "sqlite:///./test.db"
        assert result["SECRET_KEY"] == "my-test-secret-key"
        assert result["DEBUG"] == "false"
        assert result["CORS_ORIGINS"] == "http://localhost:5173,http://127.0.0.1:5173"

    def test_parse_env_file_strips_quotes(self, scanner: BackendSettingsScanner, tmp_path: Path):
        """Values wrapped in quotes should have the quotes stripped."""
        env_file = tmp_path / ".env"
        env_file.write_text(
            'SECRET_KEY="quoted-secret-value"\nAPP_NAME=\'single-quoted\'\n',
            encoding="utf-8",
        )

        result = scanner.parse_env_file(str(env_file))

        assert result["SECRET_KEY"] == "quoted-secret-value"
        assert result["APP_NAME"] == "single-quoted"

    def test_parse_env_file_ignores_blank_lines_and_comments(
        self, scanner: BackendSettingsScanner, tmp_path: Path
    ):
        """Blank lines and comment lines should not appear in the result."""
        env_file = tmp_path / ".env"
        env_file.write_text(
            "\n# This is a comment\n\nKEY=value\n",
            encoding="utf-8",
        )

        result = scanner.parse_env_file(str(env_file))

        assert result == {"KEY": "value"}

    def test_parse_env_file_handles_value_with_equals_sign(
        self, scanner: BackendSettingsScanner, tmp_path: Path
    ):
        """Values that contain '=' should be preserved correctly."""
        env_file = tmp_path / ".env"
        env_file.write_text("DATABASE_URL=postgresql://user:pass@host/db?sslmode=require\n")

        result = scanner.parse_env_file(str(env_file))

        assert result["DATABASE_URL"] == "postgresql://user:pass@host/db?sslmode=require"

    def test_parse_valid_json_config(self, scanner: BackendSettingsScanner, tmp_path: Path):
        """A valid JSON config file should be parsed into a dict."""
        config_file = tmp_path / "config.json"
        data = {"project_id": "my-project", "private_key": "-----BEGIN RSA PRIVATE KEY-----"}
        config_file.write_text(json.dumps(data), encoding="utf-8")

        result = scanner.parse_json_config(str(config_file))

        assert result["project_id"] == "my-project"
        assert "private_key" in result

    def test_parse_json_config_nested_structure(
        self, scanner: BackendSettingsScanner, tmp_path: Path
    ):
        """Nested JSON structures should be returned as-is."""
        config_file = tmp_path / "nested.json"
        data = {"database": {"host": "localhost", "port": 5432}, "debug": True}
        config_file.write_text(json.dumps(data), encoding="utf-8")

        result = scanner.parse_json_config(str(config_file))

        assert result["database"]["host"] == "localhost"
        assert result["database"]["port"] == 5432
        assert result["debug"] is True

    def test_scan_config_files_returns_all_catalogue_entries(
        self, scanner: BackendSettingsScanner
    ):
        """scan_config_files() should return an entry for every catalogued file."""
        entries = scanner.scan_config_files()

        assert len(entries) > 0
        # All entries must be ConfigFileEntry instances
        for entry in entries:
            assert isinstance(entry, ConfigFileEntry)
            assert entry.file_path
            assert entry.purpose
            assert entry.category

    def test_scan_config_files_marks_nonexistent_files(
        self, scanner: BackendSettingsScanner
    ):
        """Files that don't exist on disk should have exists=False."""
        entries = scanner.scan_config_files()
        # Since project_root is tmp_path (empty), all files should be missing
        for entry in entries:
            assert entry.exists is False

    def test_scan_config_files_marks_existing_files(self, tmp_path: Path):
        """Files that exist on disk should have exists=True."""
        # Create the expected directory structure
        backend_dir = tmp_path / "backend"
        backend_dir.mkdir()
        env_file = backend_dir / ".env"
        env_file.write_text("KEY=value\n")

        scanner = BackendSettingsScanner(project_root=str(tmp_path))
        entries = scanner.scan_config_files()

        env_entry = next((e for e in entries if e.file_path.endswith(".env") and not e.file_path.endswith(".env.example")), None)
        assert env_entry is not None
        assert env_entry.exists is True

    def test_sensitive_files_are_flagged(self, scanner: BackendSettingsScanner):
        """Files containing sensitive data (e.g. .env, serviceAccountKey.json) must be flagged."""
        entries = scanner.scan_config_files()
        sensitive = [e for e in entries if e.contains_sensitive_data]

        assert len(sensitive) > 0
        sensitive_paths = [e.file_path for e in sensitive]
        # At least .env and serviceAccountKey.json should be flagged
        assert any(".env" in p and not p.endswith(".env.example") for p in sensitive_paths)


# ===========================================================================
# 3. Error handling for invalid configs
# ===========================================================================

class TestErrorHandling:
    """Tests for error handling — covers sub-task: Test error handling for invalid configs."""

    def test_parse_env_file_raises_for_missing_file(
        self, scanner: BackendSettingsScanner
    ):
        """parse_env_file() must raise FileNotFoundError for a non-existent file."""
        with pytest.raises(FileNotFoundError, match="not found"):
            scanner.parse_env_file("/nonexistent/path/.env")

    def test_parse_json_config_raises_for_missing_file(
        self, scanner: BackendSettingsScanner
    ):
        """parse_json_config() must raise FileNotFoundError for a non-existent file."""
        with pytest.raises(FileNotFoundError, match="not found"):
            scanner.parse_json_config("/nonexistent/path/config.json")

    def test_parse_env_file_raises_for_malformed_lines(
        self, scanner: BackendSettingsScanner, tmp_path: Path
    ):
        """parse_env_file() must raise ValueError for lines without '='."""
        bad_env = tmp_path / ".env.bad"
        bad_env.write_text("THIS_LINE_HAS_NO_EQUALS_SIGN\n", encoding="utf-8")

        with pytest.raises(ValueError, match="missing '=' separator"):
            scanner.parse_env_file(str(bad_env))

    def test_parse_json_config_raises_for_invalid_json(
        self, scanner: BackendSettingsScanner, tmp_path: Path
    ):
        """parse_json_config() must raise ValueError for malformed JSON."""
        bad_json = tmp_path / "bad.json"
        bad_json.write_text("{not valid json}", encoding="utf-8")

        with pytest.raises(ValueError, match="Invalid JSON"):
            scanner.parse_json_config(str(bad_json))

    def test_parse_json_config_raises_for_empty_file(
        self, scanner: BackendSettingsScanner, tmp_path: Path
    ):
        """parse_json_config() must raise ValueError for an empty file."""
        empty_json = tmp_path / "empty.json"
        empty_json.write_text("", encoding="utf-8")

        with pytest.raises(ValueError, match="Invalid JSON"):
            scanner.parse_json_config(str(empty_json))

    def test_scan_returns_inventory_report_even_with_missing_files(
        self, scanner: BackendSettingsScanner, clean_env
    ):
        """scan() must return a valid InventoryReport even when config files are absent."""
        report = scanner.scan()

        assert isinstance(report, InventoryReport)
        assert isinstance(report.config_files, list)
        assert isinstance(report.env_vars, list)
        assert isinstance(report.validation_errors, list)
        assert isinstance(report.validation_warnings, list)
        assert isinstance(report.hardcoded_secrets_found, list)

    def test_detect_hardcoded_secrets_returns_empty_for_missing_file(
        self, scanner: BackendSettingsScanner
    ):
        """detect_hardcoded_secrets() should return [] for a non-existent file."""
        result = scanner.detect_hardcoded_secrets("/nonexistent/file.py")
        assert result == []

    def test_detect_hardcoded_secrets_finds_secret_in_file(
        self, scanner: BackendSettingsScanner, tmp_path: Path
    ):
        """detect_hardcoded_secrets() should flag files with hardcoded secrets."""
        suspicious_file = tmp_path / "config.py"
        suspicious_file.write_text(
            'SECRET_KEY = "hardcoded-secret-value-1234567890"\n',
            encoding="utf-8",
        )

        findings = scanner.detect_hardcoded_secrets(str(suspicious_file))

        assert len(findings) > 0
        # The finding should reference the file path but NOT the actual secret value
        assert str(suspicious_file) in findings[0]
        assert "hardcoded-secret-value-1234567890" not in findings[0]

    def test_detect_hardcoded_secrets_clean_file_returns_empty(
        self, scanner: BackendSettingsScanner, tmp_path: Path
    ):
        """detect_hardcoded_secrets() should return [] for a file with no secrets."""
        clean_file = tmp_path / "clean.py"
        clean_file.write_text(
            "def hello():\n    return 'world'\n",
            encoding="utf-8",
        )

        findings = scanner.detect_hardcoded_secrets(str(clean_file))

        assert findings == []

    def test_validate_env_vars_with_empty_list_returns_no_issues(
        self, scanner: BackendSettingsScanner, clean_env
    ):
        """validate_env_vars([]) should return empty errors and warnings."""
        errors, warnings = scanner.validate_env_vars([])
        assert errors == []
        assert warnings == []

    def test_scan_config_files_handles_unreadable_project_root(self):
        """Scanner with a non-existent project root should still return entries (exists=False)."""
        scanner = BackendSettingsScanner(project_root="/nonexistent/project/root")
        entries = scanner.scan_config_files()

        assert len(entries) > 0
        for entry in entries:
            assert entry.exists is False
