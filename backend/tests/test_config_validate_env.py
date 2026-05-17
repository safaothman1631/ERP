"""
Unit tests for validate_env() in backend/app/config.py.

Covers:
  - Environment variable validation logic          (Requirement 2.1, 2.2)
  - Startup validation for development vs production (Requirement 2.3)
  - Error handling for missing required variables   (Requirement 2.3)

The module-level call to validate_env() in config.py runs at import time.
We import only the symbols we need and call validate_env() directly with a
controlled os.environ so the module-level call does not interfere.
"""

from __future__ import annotations

import logging
import sys
from unittest.mock import patch

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Minimal set of env vars that satisfies production requirements
_PROD_VALID_ENV: dict[str, str] = {
    "ENVIRONMENT": "production",
    "SECRET_KEY": "a-very-long-and-secure-secret-key-for-testing-purposes",
    "DATABASE_URL": "postgresql://user:pass@localhost/db",
    "CORS_ORIGINS": "https://example.com",
    "FIREBASE_CREDENTIALS_PATH": "serviceAccountKey.json",
    "DEBUG": "false",
}

# Minimal set for development (insecure defaults are allowed)
_DEV_VALID_ENV: dict[str, str] = {
    "ENVIRONMENT": "development",
}


def _run_validate_env(env: dict[str, str]):
    """Run validate_env() with a fully-isolated os.environ."""
    # Import here so the module-level validate_env() has already run once.
    from app.config import validate_env  # noqa: PLC0415

    with patch.dict("os.environ", env, clear=True):
        validate_env()


# ===========================================================================
# 1. Environment variable validation logic
# ===========================================================================


class TestEnvVarValidationLogic:
    """Tests that validate_env() correctly inspects individual env vars."""

    # ── SECRET_KEY ──────────────────────────────────────────────────────────

    def test_short_secret_key_warns_in_development(self, caplog):
        """A SECRET_KEY shorter than 32 chars should emit a warning in dev."""
        env = {**_DEV_VALID_ENV, "SECRET_KEY": "short"}
        with caplog.at_level(logging.WARNING, logger="app.config"):
            _run_validate_env(env)
        assert any("SECRET_KEY is too short" in m for m in caplog.messages)

    def test_short_secret_key_fails_in_production(self):
        """A SECRET_KEY shorter than 32 chars must block production startup."""
        env = {
            **_PROD_VALID_ENV,
            "SECRET_KEY": "short",
        }
        with pytest.raises(SystemExit) as exc_info:
            _run_validate_env(env)
        assert exc_info.value.code == 1

    def test_insecure_default_secret_key_warns_in_development(self, caplog):
        """The insecure dev default SECRET_KEY should produce a warning in dev."""
        env = {
            **_DEV_VALID_ENV,
            "SECRET_KEY": "dev-only-insecure-key-change-me-in-production",
        }
        with caplog.at_level(logging.WARNING, logger="app.config"):
            _run_validate_env(env)
        assert any("insecure" in m.lower() for m in caplog.messages)

    def test_insecure_default_secret_key_fails_in_production(self):
        """The insecure dev default SECRET_KEY must block production startup."""
        env = {
            **_PROD_VALID_ENV,
            "SECRET_KEY": "dev-only-insecure-key-change-me-in-production",
        }
        with pytest.raises(SystemExit) as exc_info:
            _run_validate_env(env)
        assert exc_info.value.code == 1

    def test_secret_key_value_not_in_log_messages(self, caplog):
        """SECRET_KEY value must never appear in log output."""
        secret = "my-super-secret-key-that-must-not-leak-into-logs"
        env = {**_DEV_VALID_ENV, "SECRET_KEY": secret}
        with caplog.at_level(logging.DEBUG, logger="app.config"):
            _run_validate_env(env)
        for message in caplog.messages:
            assert secret not in message, (
                f"SECRET_KEY value leaked into log message: {message!r}"
            )

    # ── DATABASE_URL ─────────────────────────────────────────────────────────

    def test_sqlite_database_url_is_valid(self, caplog):
        """sqlite:// DATABASE_URL should not produce a scheme warning."""
        env = {**_DEV_VALID_ENV, "DATABASE_URL": "sqlite:///./test.db"}
        with caplog.at_level(logging.WARNING, logger="app.config"):
            _run_validate_env(env)
        assert not any("unrecognised scheme" in m for m in caplog.messages)

    def test_postgresql_database_url_is_valid(self, caplog):
        """postgresql:// DATABASE_URL should not produce a scheme warning."""
        env = {**_DEV_VALID_ENV, "DATABASE_URL": "postgresql://user:pass@localhost/db"}
        with caplog.at_level(logging.WARNING, logger="app.config"):
            _run_validate_env(env)
        assert not any("unrecognised scheme" in m for m in caplog.messages)

    def test_invalid_database_url_scheme_warns_in_development(self, caplog):
        """An unrecognised DATABASE_URL scheme should warn in development."""
        env = {**_DEV_VALID_ENV, "DATABASE_URL": "ftp://some-weird-url"}
        with caplog.at_level(logging.WARNING, logger="app.config"):
            _run_validate_env(env)
        assert any("unrecognised scheme" in m for m in caplog.messages)

    def test_invalid_database_url_scheme_fails_in_production(self):
        """An unrecognised DATABASE_URL scheme must block production startup."""
        env = {**_PROD_VALID_ENV, "DATABASE_URL": "ftp://some-weird-url"}
        with pytest.raises(SystemExit) as exc_info:
            _run_validate_env(env)
        assert exc_info.value.code == 1

    # ── CORS_ORIGINS ─────────────────────────────────────────────────────────

    def test_wildcard_cors_warns_in_development(self, caplog):
        """CORS_ORIGINS='*' should not block development but may warn."""
        env = {**_DEV_VALID_ENV, "CORS_ORIGINS": "*"}
        # Should not raise
        with caplog.at_level(logging.WARNING, logger="app.config"):
            _run_validate_env(env)

    def test_wildcard_cors_fails_in_production(self):
        """CORS_ORIGINS='*' must block production startup."""
        env = {**_PROD_VALID_ENV, "CORS_ORIGINS": "*"}
        with pytest.raises(SystemExit) as exc_info:
            _run_validate_env(env)
        assert exc_info.value.code == 1

    def test_explicit_cors_origins_pass_in_production(self):
        """Explicit CORS origins should allow production startup."""
        env = {**_PROD_VALID_ENV, "CORS_ORIGINS": "https://app.example.com,https://admin.example.com"}
        # Should not raise
        _run_validate_env(env)

    # ── DEBUG ────────────────────────────────────────────────────────────────

    def test_debug_true_warns_in_development(self, caplog):
        """DEBUG=true in development should emit a warning."""
        env = {**_DEV_VALID_ENV, "DEBUG": "true"}
        with caplog.at_level(logging.WARNING, logger="app.config"):
            _run_validate_env(env)
        assert any("DEBUG is enabled" in m for m in caplog.messages)

    def test_debug_true_fails_in_production(self):
        """DEBUG=true must block production startup."""
        env = {**_PROD_VALID_ENV, "DEBUG": "true"}
        with pytest.raises(SystemExit) as exc_info:
            _run_validate_env(env)
        assert exc_info.value.code == 1

    def test_debug_false_passes_in_production(self):
        """DEBUG=false should not block production startup."""
        env = {**_PROD_VALID_ENV, "DEBUG": "false"}
        _run_validate_env(env)  # must not raise


# ===========================================================================
# 2. Startup validation for different environments
# ===========================================================================


class TestStartupValidationByEnvironment:
    """Tests that validate_env() behaves differently in dev vs production."""

    def test_development_allows_missing_required_vars(self, caplog):
        """Development mode should log warnings but not exit when vars are missing."""
        env = {"ENVIRONMENT": "development"}  # no SECRET_KEY, DATABASE_URL, etc.
        with caplog.at_level(logging.WARNING, logger="app.config"):
            _run_validate_env(env)  # must not raise
        # Warnings should be present for missing vars
        assert any("Missing required" in m for m in caplog.messages)

    def test_development_allows_insecure_defaults(self, caplog):
        """Development mode should continue even with insecure default values."""
        env = {
            "ENVIRONMENT": "development",
            "SECRET_KEY": "dev-only-insecure-key-change-me-in-production",
            "DATABASE_URL": "sqlite:///./zoho_books.db",
        }
        with caplog.at_level(logging.WARNING, logger="app.config"):
            _run_validate_env(env)  # must not raise
        assert any("insecure" in m.lower() for m in caplog.messages)

    def test_production_with_all_valid_vars_passes(self):
        """Production mode should start cleanly when all required vars are set correctly."""
        _run_validate_env(_PROD_VALID_ENV)  # must not raise

    def test_production_blocks_on_any_error(self):
        """Production mode must call sys.exit(1) when any required var is missing."""
        env = {
            "ENVIRONMENT": "production",
            # SECRET_KEY, DATABASE_URL, CORS_ORIGINS intentionally omitted
        }
        with pytest.raises(SystemExit) as exc_info:
            _run_validate_env(env)
        assert exc_info.value.code == 1

    def test_production_firebase_credentials_required(self):
        """Production must fail if no Firebase credentials are configured."""
        env = {
            **_PROD_VALID_ENV,
            # Remove FIREBASE_CREDENTIALS_PATH and ensure no Cloud Run markers
        }
        env.pop("FIREBASE_CREDENTIALS_PATH", None)
        # Also ensure no Cloud Run identity markers are present
        for marker in ("K_SERVICE", "K_REVISION", "K_CONFIGURATION"):
            env.pop(marker, None)
        with pytest.raises(SystemExit) as exc_info:
            _run_validate_env(env)
        assert exc_info.value.code == 1

    def test_production_firebase_cloud_run_adc_accepted(self):
        """Production should accept Cloud Run workload identity as Firebase credentials."""
        env = {
            **_PROD_VALID_ENV,
            "K_SERVICE": "my-cloud-run-service",
        }
        env.pop("FIREBASE_CREDENTIALS_PATH", None)
        _run_validate_env(env)  # must not raise

    def test_development_firebase_missing_path_warns(self, caplog):
        """Development should warn if FIREBASE_CREDENTIALS_PATH points to a non-existent file."""
        env = {
            **_DEV_VALID_ENV,
            "FIREBASE_CREDENTIALS_PATH": "/nonexistent/path/credentials.json",
        }
        with caplog.at_level(logging.WARNING, logger="app.config"):
            _run_validate_env(env)
        assert any("does not exist" in m for m in caplog.messages)

    def test_environment_case_insensitive_production(self):
        """ENVIRONMENT=PRODUCTION (uppercase) should be treated as production."""
        env = {**_PROD_VALID_ENV, "ENVIRONMENT": "PRODUCTION"}
        # Should not raise — all required vars are present
        _run_validate_env(env)

    def test_unknown_environment_treated_as_development(self, caplog):
        """An unknown ENVIRONMENT value should default to development behaviour."""
        env = {"ENVIRONMENT": "staging"}  # not 'production'
        with caplog.at_level(logging.WARNING, logger="app.config"):
            _run_validate_env(env)  # must not raise


# ===========================================================================
# 3. Error handling for missing required variables
# ===========================================================================


class TestMissingRequiredVariables:
    """Tests that missing required variables are handled correctly."""

    @pytest.mark.parametrize("missing_var", [
        "SECRET_KEY",
        "DATABASE_URL",
        "CORS_ORIGINS",
    ])
    def test_missing_required_var_fails_production(self, missing_var: str):
        """Each required variable, when absent in production, must block startup."""
        env = {k: v for k, v in _PROD_VALID_ENV.items() if k != missing_var}
        with pytest.raises(SystemExit) as exc_info:
            _run_validate_env(env)
        assert exc_info.value.code == 1

    def test_missing_environment_var_defaults_to_development(self, caplog):
        """When ENVIRONMENT is absent, the system defaults to development mode (no exit)."""
        # ENVIRONMENT is in _REQUIRED_PROD_VARS, but without it the system
        # defaults to 'development' via os.environ.get("ENVIRONMENT", "development"),
        # so it warns rather than exits.
        env = {k: v for k, v in _PROD_VALID_ENV.items() if k != "ENVIRONMENT"}
        with caplog.at_level(logging.WARNING, logger="app.config"):
            _run_validate_env(env)  # must not raise — treated as development
        assert any("ENVIRONMENT" in m for m in caplog.messages)

    @pytest.mark.parametrize("missing_var", [
        "SECRET_KEY",
        "DATABASE_URL",
        "CORS_ORIGINS",
    ])
    def test_missing_required_var_warns_in_development(
        self, missing_var: str, caplog
    ):
        """Each required variable, when absent in development, should produce a warning."""
        env = {
            "ENVIRONMENT": "development",
            **{k: v for k, v in _PROD_VALID_ENV.items() if k not in (missing_var, "ENVIRONMENT")},
        }
        with caplog.at_level(logging.WARNING, logger="app.config"):
            _run_validate_env(env)
        assert any("Missing required" in m and missing_var in m for m in caplog.messages)

    def test_all_required_vars_missing_in_production_exits_once(self):
        """Even with multiple missing vars, sys.exit should be called exactly once."""
        env = {"ENVIRONMENT": "production"}
        exit_calls: list[int] = []

        original_exit = sys.exit

        def mock_exit(code: int = 0) -> None:
            exit_calls.append(code)
            raise SystemExit(code)

        with patch("sys.exit", side_effect=mock_exit):
            with pytest.raises(SystemExit):
                from app.config import validate_env  # noqa: PLC0415
                with patch.dict("os.environ", env, clear=True):
                    validate_env()

        assert len(exit_calls) == 1, (
            f"sys.exit was called {len(exit_calls)} times; expected exactly 1"
        )
        assert exit_calls[0] == 1

    def test_empty_string_vars_treated_as_missing_in_production(self):
        """Empty string values for required vars should be treated as missing in production."""
        env = {**_PROD_VALID_ENV, "SECRET_KEY": ""}
        with pytest.raises(SystemExit) as exc_info:
            _run_validate_env(env)
        assert exc_info.value.code == 1

    def test_empty_cors_origins_after_parsing_warns_in_development(self, caplog):
        """CORS_ORIGINS set to whitespace-only should warn about no valid origins."""
        env = {**_DEV_VALID_ENV, "CORS_ORIGINS": "   ,  ,  "}
        with caplog.at_level(logging.WARNING, logger="app.config"):
            _run_validate_env(env)
        assert any("no valid origins" in m for m in caplog.messages)

    def test_empty_cors_origins_after_parsing_fails_in_production(self):
        """CORS_ORIGINS set to whitespace-only should block production startup."""
        env = {**_PROD_VALID_ENV, "CORS_ORIGINS": "   ,  ,  "}
        with pytest.raises(SystemExit) as exc_info:
            _run_validate_env(env)
        assert exc_info.value.code == 1

    def test_secret_key_not_mentioned_in_error_messages(self, caplog):
        """Error messages for SECRET_KEY issues must not reveal the key value."""
        secret = "some-secret-that-is-too-short"
        env = {**_PROD_VALID_ENV, "SECRET_KEY": secret}
        with caplog.at_level(logging.CRITICAL, logger="app.config"):
            with pytest.raises(SystemExit):
                _run_validate_env(env)
        for message in caplog.messages:
            assert secret not in message, (
                f"SECRET_KEY value leaked into critical log: {message!r}"
            )
