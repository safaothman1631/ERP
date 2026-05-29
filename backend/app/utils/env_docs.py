"""
Environment documentation generator.

Maintains a registry of all environment variables used by the backend,
including descriptions, required/optional status, example values, and
security notes.  Provides helpers to:

  * Render Markdown documentation for all variables
  * Generate a .env.example file from the registry
  * Introspect the registry programmatically

SECRET_KEY is NEVER written to logs or API responses — only a placeholder
example value is included in generated output.

Requirements covered: 2.1, 2.2, 2.5
"""

from __future__ import annotations

import os
import textwrap
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


# ─────────────────────────────────────────────────────────────────────────────
# Data model
# ─────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class EnvVarDoc:
    """Documentation record for a single environment variable.

    Attributes
    ----------
    name:
        The environment variable name (e.g. ``DATABASE_URL``).
    description:
        Human-readable explanation of what the variable controls.
    required:
        ``True`` if the variable is required in production; ``False`` if
        optional (has a safe default).
    example:
        A safe, non-sensitive example value suitable for .env.example.
        For SECRET_KEY this is always a placeholder — never the real value.
    default:
        The default value used when the variable is absent.  ``None`` means
        there is no default and the variable must be supplied.
    sensitive:
        ``True`` if the value must never appear in logs or API responses.
    category:
        Logical grouping (e.g. "Core", "Security", "Database").
    notes:
        Optional extra guidance shown in documentation.
    """

    name: str
    description: str
    required: bool
    example: str
    default: Optional[str] = None
    sensitive: bool = False
    category: str = "General"
    notes: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# Registry — single source of truth for all environment variables
# ─────────────────────────────────────────────────────────────────────────────

ENV_VAR_REGISTRY: list[EnvVarDoc] = [
    # ── Core ──────────────────────────────────────────────────────────────────
    EnvVarDoc(
        name="ENVIRONMENT",
        description=(
            "Deployment context.  Controls validation strictness, logging "
            "verbosity, and whether insecure defaults are permitted."
        ),
        required=True,
        example="development",
        default="development",
        sensitive=False,
        category="Core",
        notes=(
            'Accepted values: "development" | "production".  '
            "In production, missing or insecure variables cause a hard startup failure."
        ),
    ),
    EnvVarDoc(
        name="APP_NAME",
        description="Display name shown in the UI and included in API responses.",
        required=False,
        example="Zoho Books Local",
        default="Zoho Books Local",
        sensitive=False,
        category="Core",
    ),
    EnvVarDoc(
        name="DEBUG",
        description=(
            "Enables debug mode.  When true, detailed error tracebacks are "
            "returned in API responses and extra logging is emitted."
        ),
        required=False,
        example="false",
        default="false",
        sensitive=False,
        category="Core",
        notes="Must be false (or unset) in production.",
    ),
    # ── Security ──────────────────────────────────────────────────────────────
    EnvVarDoc(
        name="SECRET_KEY",
        description=(
            "JWT signing secret used to sign and verify authentication tokens.  "
            "Must be a cryptographically random string of at least 32 characters."
        ),
        required=True,
        example="your-secret-key-here-change-in-production",
        default=None,
        sensitive=True,
        category="Security",
        notes=(
            "Generate with: python -c \"import secrets; print(secrets.token_hex(32))\"\n"
            "NEVER commit the real value to source control.  "
            "This value is never written to logs or API responses."
        ),
    ),
    # ── Database ──────────────────────────────────────────────────────────────
    EnvVarDoc(
        name="DATABASE_URL",
        description=(
            "SQLAlchemy-compatible database connection string.  "
            "SQLite is used for local development; PostgreSQL is recommended for production."
        ),
        required=True,
        example="sqlite:///./zoho_books.db",
        default="sqlite:///./zoho_books.db",
        sensitive=False,
        category="Database",
        notes=(
            "SQLite example:    sqlite:///./zoho_books.db\n"
            "PostgreSQL example: postgresql://user:pass@host:5432/dbname"
        ),
    ),
    # ── CORS ──────────────────────────────────────────────────────────────────
    EnvVarDoc(
        name="CORS_ORIGINS",
        description=(
            "Comma-separated list of allowed frontend origins for CORS.  "
            "The backend parses this list and applies it to the FastAPI CORS middleware."
        ),
        required=True,
        example=(
            "http://localhost:5173,http://127.0.0.1:5173,"
            "http://localhost:8000,http://127.0.0.1:8000"
        ),
        default=(
            "http://localhost:5173,"
            "http://127.0.0.1:5173,"
            "http://localhost:3000"
        ),
        sensitive=False,
        category="CORS",
        notes='Do NOT use "*" in production — specify explicit origins.',
    ),
    # ── Firebase ──────────────────────────────────────────────────────────────
    EnvVarDoc(
        name="FIREBASE_CREDENTIALS_PATH",
        description=(
            "Filesystem path to the Firebase service-account JSON file used for "
            "Firestore and Firebase Auth access."
        ),
        required=False,
        example="serviceAccountKey.json",
        default="serviceAccountKey.json",
        sensitive=False,
        category="Firebase",
        notes=(
            "In Cloud Run, leave unset and rely on Application Default Credentials (ADC).  "
            "Required in production unless running on Cloud Run with a workload identity."
        ),
    ),
    # ── Payments / Billing (launch-readiness R4/R5) ────────────────────────────
    EnvVarDoc(
        name="STRIPE_SECRET_KEY",
        description=(
            "Stripe secret API key for international SaaS billing (R5) and the "
            "tenant-side Stripe gateway (R4). Lazy-loaded — absence simply disables "
            "Stripe flows; it does not block startup."
        ),
        required=False,
        example="sk_test_xxxxxxxxxxxxxxxxxxxxxxxx",
        default=None,
        sensitive=True,
        category="Payments",
        notes="Use sk_test_… in development and sk_live_… in production. Never commit the real value.",
    ),
    EnvVarDoc(
        name="STRIPE_PUBLISHABLE_KEY",
        description="Stripe publishable key surfaced to the browser for client-side payment confirmation.",
        required=False,
        example="pk_test_xxxxxxxxxxxxxxxxxxxxxxxx",
        default=None,
        sensitive=False,
        category="Payments",
    ),
    EnvVarDoc(
        name="STRIPE_WEBHOOK_SECRET",
        description=(
            "Signing secret used to verify Stripe webhook payloads at "
            "POST /api/saas-billing/webhooks/stripe and the tenant-side payments webhook."
        ),
        required=False,
        example="whsec_xxxxxxxxxxxxxxxxxxxxxxxx",
        default=None,
        sensitive=True,
        category="Payments",
        notes="Obtain from the Stripe Dashboard → Developers → Webhooks for each endpoint.",
    ),
    EnvVarDoc(
        name="PUBLIC_APP_URL",
        description=(
            "Public base URL of the frontend, used to build tenant-facing payment "
            "links (invoice pay-link, hosted payment page)."
        ),
        required=False,
        example="https://app.example.com",
        default="http://localhost:5173",
        sensitive=False,
        category="Payments",
    ),
    # ── Support stack (growth-to-100 § G2) ──────────────────────────────────────
    EnvVarDoc(
        name="CRISP_WEBSITE_ID",
        description="Crisp website ID used to boot the chat SDK and identify users.",
        required=False,
        example="00000000-0000-0000-0000-000000000000",
        default="",
        sensitive=False,
        category="Support",
        notes="Absent → chat widget no-ops cleanly. Frontend reads VITE_CRISP_WEBSITE_ID.",
    ),
    EnvVarDoc(
        name="CRISP_API_IDENTIFIER",
        description="Crisp REST API identifier for server-side ticket forwarding.",
        required=False,
        example="00000000-0000-0000-0000-000000000000",
        default="",
        sensitive=False,
        category="Support",
    ),
    EnvVarDoc(
        name="CRISP_API_KEY",
        description="Crisp REST API key paired with CRISP_API_IDENTIFIER.",
        required=False,
        example="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        default="",
        sensitive=True,
        category="Support",
        notes="Never commit the real value.",
    ),
    EnvVarDoc(
        name="DIALOG360_API_KEY",
        description="360Dialog WhatsApp Business API key for inbound/outbound message routing.",
        required=False,
        example="xxxxxxxxxxxxxxxxxxxxxxxx",
        default="",
        sensitive=True,
        category="Support",
    ),
    EnvVarDoc(
        name="DIALOG360_API_URL",
        description="360Dialog messages endpoint.",
        required=False,
        example="https://waba.360dialog.io/v1/messages",
        default="https://waba.360dialog.io/v1/messages",
        sensitive=False,
        category="Support",
    ),
    EnvVarDoc(
        name="STATUSPAGE_API_KEY",
        description="Statuspage.io OAuth key used by the 60s synthetic health emit job.",
        required=False,
        example="xxxxxxxxxxxxxxxxxxxx",
        default="",
        sensitive=True,
        category="Support",
    ),
    EnvVarDoc(
        name="STATUSPAGE_PAGE_ID",
        description="Statuspage.io page ID whose components are updated by the health emit job.",
        required=False,
        example="abc123def456",
        default="",
        sensitive=False,
        category="Support",
    ),
    EnvVarDoc(
        name="STATUSPAGE_COMPONENTS",
        description="JSON map of logical component name → Statuspage component ID.",
        required=False,
        example='{"api":"<id>","firestore":"<id>","pos_offline_sync":"<id>","email_delivery":"<id>"}',
        default="",
        sensitive=False,
        category="Support",
        notes="Fetch IDs once provisioned: GET …/components.json.",
    ),
    EnvVarDoc(
        name="INTERNAL_CRON_TOKEN",
        description="Shared secret authorizing manual calls to internal cron endpoints (e.g. health-emit).",
        required=False,
        example="change-me-internal-cron-token",
        default="",
        sensitive=True,
        category="Support",
    ),
    # ── Iraq compliance (growth-to-100 § G4 — e-Fakhata + CBI) ──────────────────
    EnvVarDoc(
        name="MOF_BASE",
        description=(
            "Iraq Ministry of Finance e-Fakhata API base URL (HTTPS). When unset the "
            "submission worker holds the queue without erroring."
        ),
        required=False,
        example="https://efakhata.mof.gov.iq",
        default="",
        sensitive=False,
        category="Iraq Compliance",
        notes="Endpoint paths/field shapes pending verification against the published MoF spec (R7.X).",
    ),
    EnvVarDoc(
        name="EFAKHATA_LOCAL_CERT_STORE",
        description=(
            "Set to 1 to bypass GCP Secret Manager and use the in-process PKCS#12 "
            "cert store (dev/CI only)."
        ),
        required=False,
        example="1",
        default="0",
        sensitive=False,
        category="Iraq Compliance",
    ),
    EnvVarDoc(
        name="GCP_PROJECT_ID",
        description="GCP project ID used to build Secret Manager resource names for tenant e-Fakhata certs.",
        required=False,
        example="my-gcp-project",
        default="",
        sensitive=False,
        category="Iraq Compliance",
    ),
    EnvVarDoc(
        name="CBI_API_URL",
        description="Central Bank of Iraq daily USD↔IQD rate source consumed by the 06:00 UTC refresh job.",
        required=False,
        example="https://cbi.iq/en/currency",
        default="",
        sensitive=False,
        category="Iraq Compliance",
        notes="Falls back to the previous day's rate (then a hardcoded 1320) on fetch failure. Format pending R7.6.",
    ),
]

# Lookup by name for O(1) access
_REGISTRY_BY_NAME: dict[str, EnvVarDoc] = {v.name: v for v in ENV_VAR_REGISTRY}


# ─────────────────────────────────────────────────────────────────────────────
# Public helpers
# ─────────────────────────────────────────────────────────────────────────────


def get_env_var_doc(name: str) -> Optional[EnvVarDoc]:
    """Return the :class:`EnvVarDoc` for *name*, or ``None`` if not registered."""
    return _REGISTRY_BY_NAME.get(name)


def list_required_vars() -> list[EnvVarDoc]:
    """Return all variables that are required in production."""
    return [v for v in ENV_VAR_REGISTRY if v.required]


def list_optional_vars() -> list[EnvVarDoc]:
    """Return all variables that are optional (have safe defaults)."""
    return [v for v in ENV_VAR_REGISTRY if not v.required]


def list_sensitive_vars() -> list[EnvVarDoc]:
    """Return all variables marked as sensitive (must not appear in logs)."""
    return [v for v in ENV_VAR_REGISTRY if v.sensitive]


def generate_markdown_docs() -> str:
    """Generate Markdown documentation for all registered environment variables.

    The output is grouped by category and includes the variable name,
    description, required/optional status, default value, example, and any
    additional notes.

    Returns
    -------
    str
        A Markdown string ready to be written to a file or served via an API.
    """
    lines: list[str] = [
        "# Environment Variables",
        "",
        "This document is auto-generated from the environment variable registry.",
        "Do **not** edit it manually — update `backend/app/utils/env_docs.py` instead.",
        "",
        "> **Security note:** `SECRET_KEY` is never written to logs or API responses.",
        "",
    ]

    # Group by category preserving registry order
    categories: dict[str, list[EnvVarDoc]] = {}
    for var in ENV_VAR_REGISTRY:
        categories.setdefault(var.category, []).append(var)

    for category, vars_in_category in categories.items():
        lines.append(f"## {category}")
        lines.append("")

        for var in vars_in_category:
            status = "**Required** in production" if var.required else "Optional"
            lines.append(f"### `{var.name}`")
            lines.append("")
            lines.append(var.description)
            lines.append("")
            lines.append(f"| Field   | Value |")
            lines.append(f"|---------|-------|")
            lines.append(f"| Status  | {status} |")
            if var.sensitive:
                lines.append(f"| Example | `<redacted — see notes>` |")
            else:
                lines.append(f"| Example | `{var.example}` |")
            if var.default is not None:
                lines.append(f"| Default | `{var.default}` |")
            else:
                lines.append(f"| Default | *(none — must be set)* |")
            if var.sensitive:
                lines.append(f"| Sensitive | ✅ Never logged or returned in API responses |")
            lines.append("")

            if var.notes:
                lines.append("**Notes:**")
                lines.append("")
                for note_line in var.notes.splitlines():
                    lines.append(f"> {note_line}")
                lines.append("")

    return "\n".join(lines)


def generate_env_example(include_comments: bool = True) -> str:
    """Generate the content of a ``.env.example`` file from the registry.

    Parameters
    ----------
    include_comments:
        When ``True`` (default), each variable is preceded by a comment block
        containing its description, status, and any notes.

    Returns
    -------
    str
        The full text content suitable for writing to ``.env.example``.
    """
    lines: list[str] = []

    if include_comments:
        header = textwrap.dedent("""\
            # ─────────────────────────────────────────────────────────────────────────────
            # Zoho ERP Backend — Environment Variables
            #
            # Auto-generated from backend/app/utils/env_docs.py
            # Copy this file to .env and fill in the values for your environment.
            # Variables marked [REQUIRED in production] MUST be set before deploying.
            # ─────────────────────────────────────────────────────────────────────────────
        """)
        lines.append(header)

    # Group by category preserving registry order
    categories: dict[str, list[EnvVarDoc]] = {}
    for var in ENV_VAR_REGISTRY:
        categories.setdefault(var.category, []).append(var)

    for category, vars_in_category in categories.items():
        if include_comments:
            lines.append(f"# ── {category} {'─' * max(0, 74 - len(category))}")
            lines.append("")

        for var in vars_in_category:
            if include_comments:
                # Description (wrapped at 78 chars)
                wrapped = textwrap.wrap(var.description, width=78)
                for desc_line in wrapped:
                    lines.append(f"# {desc_line}")

                # Status
                if var.required:
                    lines.append("# [REQUIRED in production]")
                else:
                    lines.append("# [Optional]")

                # Notes
                if var.notes:
                    for note_line in var.notes.splitlines():
                        lines.append(f"# {note_line}")

            lines.append(f"{var.name}={var.example}")
            lines.append("")

    return "\n".join(lines)


def write_env_example(
    output_path: str | Path = "backend/.env.example",
    include_comments: bool = True,
) -> Path:
    """Write a ``.env.example`` file generated from the registry.

    Parameters
    ----------
    output_path:
        Destination path.  Defaults to ``backend/.env.example`` relative to
        the current working directory.
    include_comments:
        Passed through to :func:`generate_env_example`.

    Returns
    -------
    Path
        The resolved path of the written file.
    """
    path = Path(output_path).resolve()
    content = generate_env_example(include_comments=include_comments)
    path.write_text(content, encoding="utf-8")
    return path
