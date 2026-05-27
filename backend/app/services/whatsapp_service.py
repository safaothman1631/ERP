"""WhatsApp Cloud API integration.

Architecture:
- Settings stored under SettingsRepository (key=`whatsapp_config`, category=`integrations`).
- Outbound messages logged in `whatsapp_messages` with status lifecycle:
    queued -> sending -> sent | failed -> delivered -> read
- If preview_mode=true OR no api_token: skip HTTP call, mark as `previewed`.
- Real send uses Meta Cloud API: POST https://graph.facebook.com/v20.0/{phone_id}/messages
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Optional

import httpx

from app.firestore.system import SettingsRepository
from app.firestore.whatsapp import WhatsAppMessageRepository

DEFAULT_CONFIG: dict[str, Any] = {
    "enabled": False,
    "preview_mode": True,
    "api_base": "https://graph.facebook.com/v20.0",
    "phone_number_id": "",
    "api_token": "",
    "business_account_id": "",
    "default_country_code": "964",
    "auto_send_invoice": False,
    "auto_send_payment_receipt": False,
}


def merge_config(stored: Optional[dict]) -> dict:
    cfg = dict(DEFAULT_CONFIG)
    if stored:
        cfg.update({k: v for k, v in stored.items() if k in DEFAULT_CONFIG})
    return cfg


def is_whatsapp_production_ready(config: Optional[dict]) -> bool:
    """True when WhatsApp Cloud API can send live messages."""
    merged = merge_config(config)
    return bool(
        merged.get("enabled")
        and not merged.get("preview_mode", True)
        and str(merged.get("api_token") or "").strip()
        and str(merged.get("phone_number_id") or "").strip()
    )


def mask_config(cfg: dict) -> dict:
    masked = dict(cfg)
    if masked.get("api_token"):
        token = masked["api_token"]
        masked["api_token"] = ("•" * 8) + token[-4:] if len(token) > 4 else "••••"
    return masked


def _get_setting(repo: SettingsRepository) -> Optional[dict]:
    items, _ = repo.list(filters=[
        {"field": "key", "op": "==", "value": "whatsapp_config"},
        {"field": "category", "op": "==", "value": "integrations"},
    ], limit=1)
    return items[0] if items else None


def load_config(org_id: str) -> tuple[SettingsRepository, dict, Optional[dict]]:
    repo = SettingsRepository(org_id)
    setting = _get_setting(repo)
    return repo, merge_config(setting.get("value") if setting else None), setting


def save_config(org_id: str, payload: dict) -> dict:
    repo, current, setting = load_config(org_id)
    merged = {**current, **{k: v for k, v in payload.items() if k in DEFAULT_CONFIG}}
    if setting:
        repo.update(setting["id"], {"value": merged})
    else:
        repo.create({"key": "whatsapp_config", "category": "integrations", "value": merged})
    return merged


_PLACEHOLDER = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


def render_template(body: str, variables: dict) -> str:
    return _PLACEHOLDER.sub(lambda m: str(variables.get(m.group(1), "")), body or "")


def normalize_phone(raw: str, default_cc: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return ""
    if digits.startswith("00"):
        digits = digits[2:]
    if not digits.startswith(default_cc) and len(digits) <= 11:
        # Strip leading 0 then prefix country code
        digits = default_cc + digits.lstrip("0")
    return digits


def queue_message(org_id: str, *, to: str, body: str, related_type: str = "", related_id: str = "",
                  template_id: str = "", variables: Optional[dict] = None) -> dict:
    """Persist a queued message and (best-effort) send synchronously."""
    _, cfg, _ = load_config(org_id)
    msg_repo = WhatsAppMessageRepository(org_id)
    rendered = render_template(body, variables or {})
    phone = normalize_phone(to, cfg.get("default_country_code", "964"))

    record = {
        "to": phone,
        "raw_to": to,
        "body": rendered,
        "template_id": template_id,
        "variables": variables or {},
        "related_type": related_type,
        "related_id": related_id,
        "status": "queued",
        "preview_mode": bool(cfg.get("preview_mode") or not cfg.get("api_token")),
        "queued_at": datetime.utcnow().isoformat(),
    }
    saved = msg_repo.create(record)

    if not cfg.get("enabled"):
        msg_repo.update(saved["id"], {"status": "skipped", "error": "WhatsApp disabled"})
        return msg_repo.get(saved["id"])

    if record["preview_mode"]:
        msg_repo.update(saved["id"], {
            "status": "previewed",
            "sent_at": datetime.utcnow().isoformat(),
        })
        return msg_repo.get(saved["id"])

    # Real send via Meta Cloud API
    url = f"{cfg['api_base']}/{cfg['phone_number_id']}/messages"
    headers = {
        "Authorization": f"Bearer {cfg['api_token']}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "text",
        "text": {"body": rendered},
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.post(url, json=payload, headers=headers)
        if r.status_code < 300:
            data = r.json()
            wamid = (data.get("messages") or [{}])[0].get("id", "")
            msg_repo.update(saved["id"], {
                "status": "sent",
                "external_id": wamid,
                "sent_at": datetime.utcnow().isoformat(),
                "response": data,
            })
        else:
            msg_repo.update(saved["id"], {
                "status": "failed",
                "error": r.text[:500],
                "http_status": r.status_code,
            })
    except Exception as exc:  # pragma: no cover - network errors
        msg_repo.update(saved["id"], {"status": "failed", "error": str(exc)[:500]})

    return msg_repo.get(saved["id"])


def handle_status_webhook(org_id: str, payload: dict) -> int:
    """Process Meta status callback. Returns number of records updated."""
    msg_repo = WhatsAppMessageRepository(org_id)
    updated = 0
    entry = (payload.get("entry") or [])
    for ent in entry:
        for change in ent.get("changes", []):
            value = change.get("value", {})
            for status in value.get("statuses", []):
                wamid = status.get("id")
                state = status.get("status")
                if not wamid or not state:
                    continue
                items, _ = msg_repo.list(filters=[
                    {"field": "external_id", "op": "==", "value": wamid},
                ], limit=1)
                if items:
                    msg_repo.update(items[0]["id"], {
                        "status": state,
                        f"{state}_at": datetime.utcnow().isoformat(),
                    })
                    updated += 1
    return updated
