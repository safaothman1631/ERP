"""Aggregate integration readiness for Settings → Integration health panel."""
from __future__ import annotations

import os
from typing import Any, Optional

from app.firestore.iraq_payments import IraqGatewayConfigRepository
from app.firestore.system import SettingsRepository
from app.services.einvoice_service import is_einvoice_production_ready, merge_einvoice_config
from app.services.settings_service import get_webhooks_settings
from app.services.whatsapp_service import is_whatsapp_production_ready, merge_config as merge_whatsapp_config

IntegrationStatus = str  # 'ok' | 'preview' | 'missing'


def _item(
    key: str,
    label: str,
    status: IntegrationStatus,
    configure_url: str,
    message: str = "",
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "status": status,
        "configure_url": configure_url,
        "message": message,
    }


def _load_integrations_doc(org_id: str, doc_key: str) -> dict:
    repo = SettingsRepository(org_id)
    items, _ = repo.list(
        filters=[
            {"field": "key", "op": "==", "value": doc_key},
            {"field": "category", "op": "==", "value": "integrations"},
        ],
        limit=1,
    )
    if not items:
        return {}
    raw = items[0].get("value")
    return raw if isinstance(raw, dict) else {}


def _load_email_kv(org_id: str) -> dict[str, str]:
    repo = SettingsRepository(org_id)
    items, _ = repo.list(
        filters=[{"field": "category", "op": "==", "value": "email"}],
        limit=50,
    )
    out: dict[str, str] = {}
    for row in items:
        key = row.get("key")
        if key:
            out[str(key)] = str(row.get("value") or "")
    return out


def _count_webhook_endpoints(endpoints: str) -> int:
    return len([line for line in (endpoints or "").splitlines() if line.strip()])


def _gateway_configured(org_id: str, gateway: str) -> tuple[bool, str]:
    env_map = {
        "fib": ("FIB_MERCHANT_ID", "FIB_API_KEY"),
        "zain_cash": ("ZAIN_CASH_MERCHANT_ID", "ZAIN_CASH_SECRET"),
    }
    env_keys = env_map.get(gateway, ())
    if env_keys and all(os.environ.get(k) for k in env_keys):
        return True, "Configured via environment variables"

    try:
        repo = IraqGatewayConfigRepository(org_id)
        rows, _ = repo.list(filters=[{"field": "gateway", "op": "==", "value": gateway}], limit=1)
        if rows:
            row = rows[0]
            if row.get("enabled") and row.get("merchant_id"):
                return True, "Gateway credentials stored"
    except Exception:
        pass
    return False, "Merchant ID and API credentials required"


def _check_einvoice(org_id: str) -> dict[str, Any]:
    config = merge_einvoice_config(_load_integrations_doc(org_id, "einvoice_config"))
    if not config.get("enabled"):
        return _item(
            "einvoice",
            "E-Invoice (ITA)",
            "missing",
            "/settings?s=einvoice",
            "E-invoice is disabled",
        )
    if is_einvoice_production_ready(config):
        return _item(
            "einvoice",
            "E-Invoice (ITA)",
            "ok",
            "/settings?s=einvoice",
            "Production portal configured",
        )
    if config.get("preview_mode", True) or not config.get("portal_url"):
        return _item(
            "einvoice",
            "E-Invoice (ITA)",
            "preview",
            "/settings?s=einvoice",
            "Preview mode or portal URL missing",
        )
    return _item(
        "einvoice",
        "E-Invoice (ITA)",
        "preview",
        "/settings?s=einvoice",
        "Complete portal credentials to go live",
    )


def _check_whatsapp(org_id: str) -> dict[str, Any]:
    config = merge_whatsapp_config(_load_integrations_doc(org_id, "whatsapp_config"))
    if not config.get("enabled"):
        return _item(
            "whatsapp",
            "WhatsApp Business",
            "missing",
            "/settings?s=sms_whatsapp",
            "WhatsApp integration is disabled",
        )
    if is_whatsapp_production_ready(config):
        return _item(
            "whatsapp",
            "WhatsApp Business",
            "ok",
            "/settings?s=sms_whatsapp",
            "Cloud API token and phone number configured",
        )
    if config.get("preview_mode", True) or not config.get("api_token"):
        return _item(
            "whatsapp",
            "WhatsApp Business",
            "preview",
            "/settings?s=sms_whatsapp",
            "Preview mode or API token missing",
        )
    return _item(
        "whatsapp",
        "WhatsApp Business",
        "preview",
        "/settings?s=sms_whatsapp",
        "Add phone number ID and disable preview mode",
    )


def _check_fib(org_id: str) -> dict[str, Any]:
    ok, msg = _gateway_configured(org_id, "fib")
    if ok:
        return _item("fib", "FIB Payments", "ok", "/settings?s=payment_methods", msg)
    return _item("fib", "FIB Payments", "missing", "/settings?s=payment_methods", msg)


def _check_zain(org_id: str) -> dict[str, Any]:
    ok, msg = _gateway_configured(org_id, "zain_cash")
    if ok:
        return _item("zain_cash", "Zain Cash", "ok", "/settings?s=payment_methods", msg)
    return _item("zain_cash", "Zain Cash", "missing", "/settings?s=payment_methods", msg)


def _check_smtp(org_id: str) -> dict[str, Any]:
    email = _load_email_kv(org_id)
    host = email.get("smtp_host") or os.environ.get("SMTP_HOST", "")
    user = email.get("smtp_user") or os.environ.get("SMTP_USER", "")
    password = email.get("smtp_password") or os.environ.get("SMTP_PASSWORD", "")
    sender = email.get("email_from") or os.environ.get("EMAIL_FROM", "")

    if host and user and password and sender:
        return _item(
            "smtp",
            "SMTP Email",
            "ok",
            "/settings?s=email",
            "Outbound mail credentials configured",
        )
    if host or user:
        return _item(
            "smtp",
            "SMTP Email",
            "preview",
            "/settings?s=email",
            "Partial SMTP configuration — verify host, user, password, and from address",
        )
    return _item(
        "smtp",
        "SMTP Email",
        "missing",
        "/settings?s=email",
        "SMTP host and credentials not configured",
    )


def _check_webhooks(org_id: str) -> dict[str, Any]:
    cfg = get_webhooks_settings(org_id)
    count = _count_webhook_endpoints(str(cfg.get("endpoints") or ""))
    if count >= 1 and cfg.get("signing_secret"):
        return _item(
            "webhooks",
            "Webhooks (outbound)",
            "ok",
            "/settings?s=webhooks",
            f"{count} endpoint(s) with signing secret",
        )
    if count >= 1:
        return _item(
            "webhooks",
            "Webhooks (outbound)",
            "preview",
            "/settings?s=webhooks",
            f"{count} endpoint(s) — add HMAC signing secret",
        )
    return _item(
        "webhooks",
        "Webhooks (outbound)",
        "missing",
        "/settings?s=webhooks",
        "No webhook endpoints configured",
    )


def _check_api_v1() -> dict[str, Any]:
    return _item(
        "api_v1",
        "Public API v1",
        "ok",
        "/settings?s=api_tokens",
        "REST API available — see OpenAPI docs at /docs",
    )


def get_integration_health(org_id: str) -> list[dict[str, Any]]:
    """Return integration readiness rows for the given organisation."""
    if not org_id:
        return []
    return [
        _check_einvoice(org_id),
        _check_whatsapp(org_id),
        _check_fib(org_id),
        _check_zain(org_id),
        _check_smtp(org_id),
        _check_webhooks(org_id),
        _check_api_v1(),
    ]
