"""Tenant webhook settings — CRUD + test delivery."""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, HttpUrl

from app.api.system import _log_settings_change, _require_settings_read
from app.services import settings_service
from app.services.auth import get_current_user
from app.services.permissions import require_perm
from app.services.webhook_dispatcher import test_delivery

router = APIRouter(prefix="/api/settings/webhooks", tags=["Settings / Webhooks"])


class WebhookEndpoint(BaseModel):
    url: str = Field(max_length=500)
    events: list[str] = Field(default_factory=list)
    active: bool = True
    secret: Optional[str] = Field(default=None, max_length=200)


class WebhooksConfig(BaseModel):
    endpoints: list[WebhookEndpoint] = Field(default_factory=list)
    signing_secret: str = Field(default="", max_length=200)
    retry_count: int = Field(default=3, ge=1, le=10)
    timeout_seconds: int = Field(default=30, ge=1, le=120)


class WebhookTestRequest(BaseModel):
    url: HttpUrl
    event: str = Field(default="webhook.test", max_length=100)
    secret: Optional[str] = Field(default=None, max_length=200)


def _normalize_endpoints(raw: Any) -> list[dict]:
    if isinstance(raw, list):
        return [ep for ep in raw if isinstance(ep, dict)]
    if isinstance(raw, str) and raw.strip():
        return [{"url": raw.strip(), "events": [], "active": True}]
    return []


@router.get("")
def get_webhooks(user: dict = Depends(get_current_user)):
    """**GET /api/settings/webhooks** — return tenant webhook configuration."""
    _require_settings_read(user, "webhooks")
    cfg = settings_service.get_webhooks_settings(user["org_id"])
    endpoints = _normalize_endpoints(cfg.get("endpoints"))
    retry_count = int(cfg.get("retry_count") or cfg.get("retry_attempts") or 3)
    return {
        "endpoints": endpoints,
        "signing_secret": cfg.get("signing_secret") or "",
        "retry_count": retry_count,
        "timeout_seconds": int(cfg.get("timeout_seconds") or 30),
    }


@router.put("", dependencies=[Depends(require_perm("settings.update"))])
def save_webhooks(data: WebhooksConfig, user: dict = Depends(get_current_user)):
    """**PUT /api/settings/webhooks** — persist full webhook configuration."""
    org_id = user["org_id"]
    old_value = settings_service.get_webhooks_settings(org_id)
    payload = {
        "endpoints": [ep.model_dump() for ep in data.endpoints],
        "signing_secret": data.signing_secret,
        "retry_count": data.retry_count,
        "retry_attempts": data.retry_count,
        "timeout_seconds": data.timeout_seconds,
    }
    result = settings_service.set_bag(org_id, "webhooks", payload)
    _log_settings_change(user, "webhooks", "blob", old_value, payload)
    return {
        "endpoints": _normalize_endpoints(result.get("endpoints")),
        "signing_secret": result.get("signing_secret") or "",
        "retry_count": int(result.get("retry_count") or result.get("retry_attempts") or 3),
        "timeout_seconds": int(result.get("timeout_seconds") or 30),
    }


@router.post("/test", dependencies=[Depends(require_perm("settings.update"))])
def test_webhook(data: WebhookTestRequest, user: dict = Depends(get_current_user)):
    """**POST /api/settings/webhooks/test** — send a test payload to a URL."""
    outcome = test_delivery(
        url=str(data.url),
        org_id=user["org_id"],
        event=data.event,
        secret=data.secret,
    )
    if not outcome.get("success"):
        raise HTTPException(
            status_code=502,
            detail={
                "code": "webhook_test_failed",
                "status": outcome.get("status"),
                "message": outcome.get("message"),
            },
        )
    return outcome
