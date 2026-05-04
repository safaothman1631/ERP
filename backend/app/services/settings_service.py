"""
SettingsService — central reader for "bag" settings stored as
{key: 'blob', category: <name>, value: <json string>} in the `settings`
collection. Used by every domain module to apply user configuration.

Pattern: each Settings page section in the UI saves a JSON blob under a
category. This service reads the blob, parses it, merges with defaults,
and caches the result in-process for 60 seconds per (org_id, category).
Cache is invalidated by SettingsRepository on POST /api/system/settings.
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
    """Return merged settings bag for (org_id, category). Defaults supplied
    by caller fill missing keys. Cached 60s. Returns a NEW dict (safe to mutate)."""
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
    except Exception:
        parsed = {}
    with _LOCK:
        _CACHE[key] = (now, parsed)
    base = dict(defaults or {})
    base.update(parsed)
    return base


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
