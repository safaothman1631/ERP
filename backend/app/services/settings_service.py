"""
SettingsService — central reader/writer for "bag" settings stored as
{key: 'blob', category: <name>, value: <json string>} in the `settings`
Firestore collection. Used by every domain module to apply user configuration.

Storage layout (Requirement 11.2):
    Firestore path: settings/{category}/{doc_id}
    Each document: { org_id, key: "blob", category: <name>, value: <json string> }

Organization scoping (Requirements 11.4, 11.5):
    Every read and write is scoped to a single org_id.  Two organisations
    sharing the same Firestore project never see each other's settings.
    When a client-side setting conflicts with a server setting, the server
    value takes precedence (enforced by get_bag merging: server data
    overwrites the caller-supplied defaults).

Public API:
    get_bag(org_id, category, defaults)  — read a settings bag (cached 60 s)
    set_bag(org_id, category, data)      — write / replace a settings bag
    invalidate(org_id, category)         — drop cache for one category
    invalidate_all()                     — drop entire cache (tests / admin)

Convenience getters (e.g. get_sales_settings) call get_bag with domain
defaults so callers always receive a fully-populated dict.
"""
from __future__ import annotations

import json
import time
from threading import Lock
from typing import Any, Dict, Optional

from app.firestore.system import SettingsRepository

_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}
_LOCK = Lock()
_TTL_SECONDS = 60.0


def _cache_key(org_id: str, category: str) -> str:
    return f"{org_id}::{category}"


def get_bag(org_id: str, category: str, defaults: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Return merged settings bag for (org_id, category).

    Reads from the Firestore ``settings`` collection scoped to *org_id*.
    The stored JSON blob is merged on top of *defaults* so that any key
    present in Firestore overrides the caller-supplied default (server
    takes precedence — Requirement 11.5).

    Results are cached in-process for ``_TTL_SECONDS`` (60 s) to avoid
    repeated Firestore reads on hot paths.  The cache is invalidated by
    :func:`set_bag` and by ``POST /api/system/settings``.

    Args:
        org_id:   Organisation identifier.  Settings are strictly scoped
                  to this org (Requirement 11.4).
        category: Settings category name (e.g. ``"sales"``, ``"branding"``).
        defaults: Fallback values for keys not yet stored in Firestore.

    Returns:
        A **new** dict (safe to mutate) with defaults merged under stored
        values.  Returns a copy of *defaults* when org_id/category are
        empty or Firestore is unavailable.
    """
    if not org_id or not category:
        return dict(defaults or {})
    key = _cache_key(org_id, category)
    now = time.time()
    with _LOCK:
        cached = _CACHE.get(key)
        if cached and (now - cached[0]) < _TTL_SECONDS:
            base = dict(defaults or {})
            base.update(cached[1])
            return base
    # Cache miss — read from Firestore
    parsed: Dict[str, Any] = {}
    try:
        repo = SettingsRepository(org_id)
        items, _ = repo.list(filters=[
            {"field": "key", "op": "==", "value": "blob"},
            {"field": "category", "op": "==", "value": category},
        ], limit=1)
        if items:
            raw = items[0].get("value", "")
            if isinstance(raw, str) and raw.strip():
                try:
                    parsed = json.loads(raw)
                    if not isinstance(parsed, dict):
                        parsed = {}
                except Exception:
                    parsed = {}
            elif isinstance(raw, dict):
                parsed = raw
    except Exception as exc:
        from app.services.firestore_resilience import is_firestore_quota_error

        if is_firestore_quota_error(exc):
            with _LOCK:
                stale = _CACHE.get(key)
                if stale:
                    base = dict(defaults or {})
                    base.update(stale[1])
                    return base
        parsed = {}
    with _LOCK:
        _CACHE[key] = (now, parsed)
    base = dict(defaults or {})
    base.update(parsed)
    return base


def set_bag(org_id: str, category: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Persist a settings bag for (org_id, category) in Firestore.

    Serialises *data* as a JSON string and upserts the ``blob`` document
    for the given category under the organisation's ``settings`` collection
    (Requirement 11.2).  The in-process cache entry is invalidated so the
    next :func:`get_bag` call reflects the new values immediately.

    Args:
        org_id:   Organisation identifier.  The write is strictly scoped
                  to this org (Requirement 11.4).
        category: Settings category name (e.g. ``"sales"``, ``"branding"``).
        data:     Dict of settings to store.  Must be JSON-serialisable.

    Returns:
        The stored document dict as returned by Firestore.

    Raises:
        ValueError: If *org_id* or *category* are empty, or *data* is not
                    a dict.
    """
    if not org_id or not category:
        raise ValueError("org_id and category are required")
    if not isinstance(data, dict):
        raise ValueError("data must be a dict")

    repo = SettingsRepository(org_id)
    # Find existing blob document for this category
    items, _ = repo.list(filters=[
        {"field": "key", "op": "==", "value": "blob"},
        {"field": "category", "op": "==", "value": category},
    ], limit=1)

    payload = {
        "key": "blob",
        "category": category,
        "value": json.dumps(data),
    }

    if items:
        result = repo.update(items[0]["id"], payload)
    else:
        result = repo.create(payload)

    # Invalidate cache so next get_bag reads fresh data
    invalidate(org_id, category)
    return result


def invalidate(org_id: str, category: Optional[str] = None) -> None:
    """Drop cached entry for one category, or all categories of an org."""
    with _LOCK:
        if category:
            _CACHE.pop(_cache_key(org_id, category), None)
        else:
            for k in list(_CACHE.keys()):
                if k.startswith(f"{org_id}::"):
                    _CACHE.pop(k, None)


def invalidate_all() -> None:
    """Drop entire cache. Use only in tests or admin reset."""
    with _LOCK:
        _CACHE.clear()


# ── Convenience getters with built-in defaults ──────────────────────────

def get_sales_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "sales", {
        "quote_expiry_days": 30,
        "auto_followup_quote": True,
        "default_payment_terms_days": 30,
        "default_discount_pct": 0,
        "require_discount_approval": True,
        "commission_pct": 0,
        "pipeline_stages": "New, Qualified, Proposal, Negotiation, Won, Lost",
    })


def get_purchases_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "purchases", {
        "rfq_required": False,
        "three_way_match": True,
        "require_grn": True,
        "approval_threshold": 5000,
        "default_lead_time_days": 7,
        "default_payment_terms_days": 30,
        "allow_dropship": False,
        "over_receipt_pct": 5,
    })


def get_inventory_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "inventory", {
        "default_warehouse": "WH-001",
        "removal_strategy": "fifo",
        "allow_negative_stock": False,
        "lot_tracking": True,
        "serial_tracking": False,
        "barcode_required": False,
        "reorder_enabled": True,
        "reorder_lead_days": 7,
    })


def get_pos_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "pos", {
        "walk_in_contact_id": "",
        "receipt_printer_url": "",
        "cash_drawer_enabled": True,
        "barcode_scanner_enabled": True,
        "card_terminal_enabled": False,
        "tip_default_pct": 0,
        "service_charge_pct": 0,
        "offline_mode": True,
        "restaurant_mode": False,
        "require_cashier_pin": True,
    })


def get_hr_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "hr", {
        "default_contract_type": "full_time",
        "probation_days": 90,
        "annual_leave_days": 21,
        "sick_leave_days": 10,
        "weekly_off_days": 1,
        "max_overtime_hours": 40,
        "require_check_in": True,
        "geofence_enabled": False,
    })


def get_payroll_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "payroll", {
        "pay_period": "monthly",
        "pay_day": 25,
        "tax_withholding_pct": 5,
        "social_security_pct": 5,
        "overtime_multiplier": 1.5,
        "allowance_default": 0,
        "deduction_default": 0,
        "payslip_email_enabled": True,
    })


def get_documents_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "documents", {
        "storage_backend": "local",
        "max_file_size_mb": 25,
        "ocr_enabled": False,
        "share_link_expiry_days": 7,
        "require_signin_for_share": False,
        "allowed_extensions": "pdf, docx, xlsx, jpg, jpeg, png, csv, zip",
    })


def get_audit_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "audit", {
        "retention_days": 365,
        "export_format": "csv",
        "anomaly_alerts": True,
        "alert_email": "",
        "immutable_log": True,
    })


def get_security_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "security", {
        "require_2fa_for_admin": True,
        "session_timeout_minutes": 60,
        "password_min_length": 8,
    })


def get_api_tokens_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "api_tokens", {
        "rate_limit_per_min": 600,
        "default_token_ttl_days": 90,
        "require_ip_whitelist": False,
        "ip_whitelist": "",
        "require_2fa_for_token_creation": True,
    })


def get_webhooks_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "webhooks", {
        "endpoints": "",
        "signing_secret": "",
        "retry_attempts": 3,
        "retry_backoff_seconds": 60,
        "timeout_seconds": 30,
        "events": [],
    })


def get_crm_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "crm", {
        "pipelines": "Sales, Partnerships, Renewals",
        "lead_sources": "Website, Referral, Cold call, Event, Social media, Advertisement",
        "lost_reasons": "Price, Competitor, Timing, No budget, No decision-maker",
        "scoring_high": 80,
        "scoring_medium": 50,
        "round_robin": True,
        "duplicate_detection": True,
        "default_owner_id": "",
    })


def get_mrp_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "mrp", {
        "quality_checks_required": True,
        "auto_create_work_orders": True,
        "allow_subcontracting": False,
        "allow_byproducts": False,
        "bom_default_qty": 1,
        "default_workcenter_capacity_hours": 8,
    })


def get_branding_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "branding", {
        "logo_url": "",
        "primary_color": "#1677ff",
        "secondary_color": "",
        "font_family": "system-ui",
        "invoice_template": "default",
        "email_template": "default",
    })


def get_formats_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "formats", {
        "date_format": "YYYY-MM-DD",
        "time_format": "24h",
        "thousand_sep": ",",
        "decimal_sep": ".",
        "first_day_of_week": "sun",
        "units": "metric",
        "paper_size": "A4",
    })


def get_localization_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "localization", {
        "country_pack": "IQ",
        "coa_template": "iraq_standard",
        "address_format": "{name}\n{line1}\n{line2}\n{city}, {country}",
        "phone_format": "+964 ## ### ####",
        "postal_code_format": "#####",
        "iban_validation": True,
    })


def get_payment_methods_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "payment_methods", {
        "cash": True, "card": True, "bank_transfer": True,
        "fib": False, "zaincash": False, "asiacell": False,
        "default_currency": "IQD",
    })


def get_working_hours_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "working_hours", {
        "open_time": "09:00", "close_time": "17:00",
        "workdays": ["sun", "mon", "tue", "wed", "thu"],
    })


def get_sso_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "sso", {
        "google": False, "microsoft": False, "saml": False, "ldap": False,
        "two_factor_required": False,
    })


def get_portals_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "portals", {
        "customer_portal_enabled": True,
        "vendor_portal_enabled": True,
        "link_expiry_days": 30,
        "require_terms_acceptance": False,
        "terms_url": "",
    })


def get_mobile_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "mobile", {
        "push_enabled": True,
        "biometric_required": False,
        "force_min_version": "1.0.0",
        "deep_link_scheme": "zoho://",
        "offline_sync_enabled": True,
        "camera_barcode_enabled": True,
    })


def get_gdpr_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "gdpr", {
        "consent_required": True,
        "dsr_email": "",
        "default_retention_days": 730,
        "allow_self_export": True,
        "allow_self_delete": True,
        "breach_notify_within_hours": 72,
        "breach_notify_email": "",
    })


def get_holidays_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "holidays", {"items": []})


def get_sms_whatsapp_settings(org_id: str) -> Dict[str, Any]:
    return get_bag(org_id, "sms_whatsapp", {
        "provider": "local",
        "sender_id": "",
        "account_sid": "",
        "auth_token": "",
        "wa_phone_number_id": "",
        "otp_template": "Your code is {{code}}. It expires in 10 minutes.",
        "daily_quota": 1000,
    })
