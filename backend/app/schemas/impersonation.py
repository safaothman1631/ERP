"""Pydantic schemas for admin impersonation (G2 — Customer Support).

Models the request/response envelopes used by
``backend/app/api/admin/impersonate.py``. The audit-event model is also
shared with ``backend/app/middleware/impersonation_audit.py``.

Reference: ``.kiro/specs/growth-to-100/design.md`` §2.3 and RFC 8693 actor
claim (``act``) semantics.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Request models ─────────────────────────────────────────────────────────


class ImpersonateStartRequest(BaseModel):
    """Start an impersonation session.

    ``reason`` is required and stored in the audit log; treat it as PII —
    do not echo it in error messages.
    """

    model_config = ConfigDict(extra="forbid")

    tenant_id: str = Field(..., min_length=1, max_length=128)
    target_user_id: Optional[str] = Field(
        default=None,
        description="Specific user inside the tenant. When omitted, the "
        "session impersonates the tenant's primary admin.",
        max_length=128,
    )
    reason: str = Field(
        ...,
        min_length=10,
        max_length=500,
        description="Why is this session being started? Visible to auditors.",
    )


class ImpersonateEndRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    audit_id: Optional[str] = Field(
        default=None,
        description="Optional — when omitted, end whatever session the "
        "caller's current token represents.",
        max_length=128,
    )


# ── Response models ────────────────────────────────────────────────────────


class ImpersonateStartResponse(BaseModel):
    """30-min read-only token plus audit metadata."""

    model_config = ConfigDict(extra="ignore")

    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Seconds until token expiry")
    expires_at: datetime
    audit_id: str
    tenant_id: str
    target_user_id: Optional[str]
    read_only: bool = True


class ImpersonateEndResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    audit_id: str
    ended_at: datetime
    status: str = "ended"


# ── Audit log models ───────────────────────────────────────────────────────


class ImpersonationAuditEntry(BaseModel):
    """Top-level audit document.

    Path: ``impersonation_audit/{audit_id}``.
    Retention: 18 months (R2.3 NFR-G10 — see scheduler purge job).
    """

    model_config = ConfigDict(extra="ignore")

    audit_id: str
    impersonator_user_id: str
    impersonator_email: Optional[str] = None
    target_tenant_id: str
    target_user_id: Optional[str] = None
    started_at: datetime
    expires_at: datetime
    ended_at: Optional[datetime] = None
    reason: str
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    scope: str = "read-only"
    status: str = "active"  # active | ended | expired


class ImpersonationAuditEvent(BaseModel):
    """Per-request event row.

    Path: ``impersonation_audit/{audit_id}/events/{event_id}``.
    """

    model_config = ConfigDict(extra="ignore")

    event_id: str
    audit_id: str
    method: str
    path: str
    status_code: int
    body_size: int
    ip: Optional[str] = None
    timestamp: datetime


class ImpersonationAuditListResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    items: list[ImpersonationAuditEntry]
    next_cursor: Optional[str] = None


__all__ = [
    "ImpersonateStartRequest",
    "ImpersonateEndRequest",
    "ImpersonateStartResponse",
    "ImpersonateEndResponse",
    "ImpersonationAuditEntry",
    "ImpersonationAuditEvent",
    "ImpersonationAuditListResponse",
]
