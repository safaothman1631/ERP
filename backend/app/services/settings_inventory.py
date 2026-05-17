"""
Settings Inventory Scanner — backend component.

Scans and catalogs backend configuration files, validates environment
variables, and flags potential security issues.

Requirements covered: 1.1, 1.2, 1.3, 1.4, 1.5
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

# ─────────────────────────────────────────────────────────────────────────────
# Data models
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ConfigFileEntry:
    """Represents a catalogued configuration file."""
    file_path: str
    purpose: str
    key_parameters: List[str]
    contains_sensitive_data: bool
    category: str  # e.g. "environment", "framework", "auth", "database"
    exists: bool = True
    parse_errors: List[str] = field(default_factory=list)


@dataclass
class EnvVarEntry:
    """Represents a documented environment variable."""
    name: str
    description: str
    required_in_production: bool
    default_value: Optional[str]
    current_value: Optional[str]  # None means not set
    is_sensitive: bool
    is_insecure_default: bool = False


@dataclass
class InventoryReport:
    """Full inventory report produced by the scanner."""
    config_files: List[ConfigFileEntry] = field(default_factory=list)
    env_vars: List[EnvVarEntry] = field(default_factory=list)
    validation_errors: List[str] = field(default_factory=list)
    validation_warnings: List[str] = field(default_factory=list)
    hardcoded_secrets_found: List[str] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# Known environment variable catalogue
# ─────────────────────────────────────────────────────────────────────────────

_ENV_VAR_CATALOGUE: List[Dict[str, Any]] = [
    {
        "name": "DATABASE_URL",
        "description": "SQLite or PostgreSQL connection string",
        "required_in_production": True,
        "default_value": "sqlite:///./zoho_books.db",
        "is_sensitive": False,
    },
    {
        "name": "SECRET_KEY",
        "description": "JWT signing secret — must be a strong random value",
        "required_in_production": True,
        "default_value": "dev-only-insecure-key-change-me-in-production",
        "is_sensitive": True,
    },
    {
        "name": "ENVIRONMENT",
        "description": "Deployment context: development | production",
        "required_in_production": True,
        "default_value": "development",
        "is_sensitive": False,
    },
    {
        "name": "DEBUG",
        "description": "Enable debug mode (must be false in production)",
        "required_in_production": False,
        "default_value": "false",
        "is_sensitive": False,
    },
    {
        "name": "CORS_ORIGINS",
        "description": "Comma-separated list of allowed frontend origins",
        "required_in_production": True,
        "default_value": "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
        "is_sensitive": False,
    },
    {
        "name": "FIREBASE_CREDENTIALS_PATH",
        "description": "Path to Firebase service-account JSON file",
        "required_in_production": False,
        "default_value": "serviceAccountKey.json",
        "is_sensitive": False,
    },
    {
        "name": "APP_NAME",
        "description": "Application display name",
        "required_in_production": False,
        "default_value": "Zoho Books Local",
        "is_sensitive": False,
    },
]

# Insecure default values that should never reach production
_INSECURE_DEFAULTS: Dict[str, str] = {
    "SECRET_KEY": "dev-only-insecure-key-change-me-in-production",
    "DATABASE_URL": "sqlite:///./zoho_books.db",
}

# Patterns that suggest hardcoded secrets in config files
_SECRET_PATTERNS: List[re.Pattern] = [
    re.compile(r'(?i)(password|passwd|secret|api_key|apikey|token|private_key)\s*[=:]\s*["\']?[A-Za-z0-9+/]{8,}["\']?'),
    re.compile(r'(?i)secret_key\s*=\s*["\'][^"\']{8,}["\']'),
]

# ─────────────────────────────────────────────────────────────────────────────
# Config file catalogue (relative to project root)
# ─────────────────────────────────────────────────────────────────────────────

_CONFIG_FILE_CATALOGUE: List[Dict[str, Any]] = [
    {
        "relative_path": "backend/.env",
        "purpose": "Backend environment variables for local development",
        "key_parameters": ["DATABASE_URL", "SECRET_KEY", "ENVIRONMENT", "CORS_ORIGINS"],
        "contains_sensitive_data": True,
        "category": "environment",
    },
    {
        "relative_path": "backend/.env.example",
        "purpose": "Template for backend environment variables",
        "key_parameters": ["DATABASE_URL", "SECRET_KEY", "ENVIRONMENT", "CORS_ORIGINS"],
        "contains_sensitive_data": False,
        "category": "environment",
    },
    {
        "relative_path": "backend/requirements.txt",
        "purpose": "Python package dependencies",
        "key_parameters": ["fastapi", "pydantic-settings", "firebase-admin"],
        "contains_sensitive_data": False,
        "category": "framework",
    },
    {
        "relative_path": "backend/app/config.py",
        "purpose": "Pydantic-settings configuration model and startup validation",
        "key_parameters": ["Settings", "validate_env", "get_settings"],
        "contains_sensitive_data": False,
        "category": "framework",
    },
    {
        "relative_path": "backend/serviceAccountKey.json",
        "purpose": "Firebase service account credentials",
        "key_parameters": ["project_id", "private_key", "client_email"],
        "contains_sensitive_data": True,
        "category": "auth",
    },
    {
        "relative_path": "backend/app/main.py",
        "purpose": "FastAPI application entry point with CORS and security headers",
        "key_parameters": ["CORS_ORIGINS", "security_headers"],
        "contains_sensitive_data": False,
        "category": "api",
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Scanner
# ─────────────────────────────────────────────────────────────────────────────

class BackendSettingsScanner:
    """Scans backend configuration files and validates environment variables.

    Parameters
    ----------
    project_root:
        Absolute path to the project root directory.  Defaults to the
        directory three levels above this file (…/zoho).
    """

    def __init__(self, project_root: Optional[str] = None) -> None:
        if project_root is None:
            # backend/app/services/settings_inventory.py → go up 3 levels
            self.project_root = Path(__file__).resolve().parents[3]
        else:
            self.project_root = Path(project_root).resolve()

    # ── Public API ────────────────────────────────────────────────────────────

    def scan(self) -> InventoryReport:
        """Run a full inventory scan and return the report."""
        report = InventoryReport()
        report.config_files = self._scan_config_files()
        report.env_vars = self._scan_env_vars()
        report.validation_errors, report.validation_warnings = self._validate_env_vars(report.env_vars)
        report.hardcoded_secrets_found = self._detect_hardcoded_secrets(report.config_files)
        return report

    def scan_config_files(self) -> List[ConfigFileEntry]:
        """Return catalogued config file entries."""
        return self._scan_config_files()

    def scan_env_vars(self) -> List[EnvVarEntry]:
        """Return documented environment variable entries."""
        return self._scan_env_vars()

    def validate_env_vars(self, env_vars: Optional[List[EnvVarEntry]] = None) -> tuple[List[str], List[str]]:
        """Validate environment variables.

        Returns
        -------
        (errors, warnings)
            errors   — issues that block production startup
            warnings — issues that are acceptable in development
        """
        if env_vars is None:
            env_vars = self._scan_env_vars()
        return self._validate_env_vars(env_vars)

    def parse_env_file(self, env_file_path: str) -> Dict[str, str]:
        """Parse a .env file and return key-value pairs.

        Raises
        ------
        FileNotFoundError
            If the file does not exist.
        ValueError
            If the file contains malformed lines that cannot be parsed.
        """
        path = Path(env_file_path)
        if not path.exists():
            raise FileNotFoundError(f"Environment file not found: {env_file_path}")

        result: Dict[str, str] = {}
        parse_errors: List[str] = []

        with open(path, encoding="utf-8") as fh:
            for line_no, raw_line in enumerate(fh, start=1):
                line = raw_line.strip()
                # Skip blank lines and comments
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    parse_errors.append(f"Line {line_no}: missing '=' separator: {line!r}")
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if not key:
                    parse_errors.append(f"Line {line_no}: empty key")
                    continue
                result[key] = value

        if parse_errors:
            raise ValueError(
                f"Errors parsing {env_file_path}:\n" + "\n".join(parse_errors)
            )

        return result

    def parse_json_config(self, json_file_path: str) -> Dict[str, Any]:
        """Parse a JSON configuration file.

        Raises
        ------
        FileNotFoundError
            If the file does not exist.
        ValueError
            If the file contains invalid JSON.
        """
        path = Path(json_file_path)
        if not path.exists():
            raise FileNotFoundError(f"Config file not found: {json_file_path}")

        try:
            with open(path, encoding="utf-8") as fh:
                return json.load(fh)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON in {json_file_path}: {exc}") from exc

    def detect_hardcoded_secrets(self, file_path: str) -> List[str]:
        """Scan a single file for hardcoded secrets.

        Returns a list of descriptions of found secrets (never the values).
        """
        path = Path(file_path)
        if not path.exists():
            return []

        findings: List[str] = []
        try:
            content = path.read_text(encoding="utf-8", errors="replace")
            for pattern in _SECRET_PATTERNS:
                for match in pattern.finditer(content):
                    line_no = content[: match.start()].count("\n") + 1
                    findings.append(
                        f"{file_path}:{line_no} — possible hardcoded secret "
                        f"(matched pattern: {pattern.pattern[:40]}…)"
                    )
        except OSError:
            pass
        return findings

    # ── Private helpers ───────────────────────────────────────────────────────

    def _scan_config_files(self) -> List[ConfigFileEntry]:
        entries: List[ConfigFileEntry] = []
        for spec in _CONFIG_FILE_CATALOGUE:
            abs_path = self.project_root / spec["relative_path"]
            entries.append(
                ConfigFileEntry(
                    file_path=str(abs_path),
                    purpose=spec["purpose"],
                    key_parameters=list(spec["key_parameters"]),
                    contains_sensitive_data=spec["contains_sensitive_data"],
                    category=spec["category"],
                    exists=abs_path.exists(),
                )
            )
        return entries

    def _scan_env_vars(self) -> List[EnvVarEntry]:
        entries: List[EnvVarEntry] = []
        for spec in _ENV_VAR_CATALOGUE:
            name = spec["name"]
            current = os.environ.get(name)
            insecure = (
                name in _INSECURE_DEFAULTS
                and (current or spec["default_value"]) == _INSECURE_DEFAULTS[name]
            )
            entries.append(
                EnvVarEntry(
                    name=name,
                    description=spec["description"],
                    required_in_production=spec["required_in_production"],
                    default_value=spec["default_value"],
                    current_value=current,
                    is_sensitive=spec["is_sensitive"],
                    is_insecure_default=insecure,
                )
            )
        return entries

    def _validate_env_vars(
        self, env_vars: List[EnvVarEntry]
    ) -> tuple[List[str], List[str]]:
        env_value = os.environ.get("ENVIRONMENT", "development").lower()
        is_prod = env_value == "production"
        errors: List[str] = []
        warnings: List[str] = []

        for entry in env_vars:
            if entry.required_in_production and not entry.current_value:
                msg = f"Missing required environment variable: {entry.name}"
                if is_prod:
                    errors.append(msg)
                else:
                    warnings.append(msg)

            if entry.is_insecure_default:
                if entry.is_sensitive:
                    msg = f"{entry.name} is using an insecure development default"
                else:
                    msg = f"{entry.name} is using the insecure development default ({entry.default_value!r})"
                if is_prod:
                    errors.append(msg)
                else:
                    warnings.append(msg)

        return errors, warnings

    def _detect_hardcoded_secrets(
        self, config_files: List[ConfigFileEntry]
    ) -> List[str]:
        findings: List[str] = []
        for entry in config_files:
            if entry.exists and not entry.contains_sensitive_data:
                # Only scan files not already flagged as sensitive
                findings.extend(self.detect_hardcoded_secrets(entry.file_path))
        return findings
