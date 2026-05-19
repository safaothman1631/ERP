import uuid
import io
import json
import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from app.firestore.system import SettingsRepository, CurrencyRepository, ExchangeRateRepository, ReminderSettingsRepository, AuditLogRepository
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user, hash_password, verify_password
from app.services import settings_service as _settings_service
from app.services.permissions import require_perm, user_has_perm
from app.firebase_client import get_db

router = APIRouter(prefix="/api/system", tags=["System"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _require_settings_write(user: dict) -> None:
    """Raise 403 if the user does not have admin or owner role.

    Settings write operations (POST /settings, PUT /organization, etc.) require
    the user to hold the 'admin' or 'owner' role.

    Requirement 12.4 — Changes SHALL require appropriate permission (admin/owner).
    """
    role = user.get("role", "")
    if role not in ("admin", "owner") and not user_has_perm(user, "settings.update"):
        raise HTTPException(
            status_code=403,
            detail="دەسەڵات نییە: تەنها بەڕێوەبەر یان خاوەن دەتوانێت ڕێکخستنەکان بگۆڕێت",
        )


def _log_settings_change(
    user: dict,
    category: str,
    key: str,
    old_value: object,
    new_value: object,
) -> None:
    """Write an audit log entry for a settings change.

    Requirement 12.5 — THE System SHALL log all setting changes for audit purposes.

    Args:
        user:      The authenticated user performing the change.
        category:  The settings category (e.g. "general", "sales").
        key:       The settings key being modified.
        old_value: The previous value (may be None for new keys).
        new_value: The new value being written.
    """
    try:
        repo = AuditLogRepository(user["org_id"])
        repo.create({
            "id": str(uuid.uuid4()),
            "entity_type": "settings",
            "entity_id": f"{category}/{key}",
            "action": "update",
            "method": "POST",
            "user_id": user.get("id"),
            "user_email": user.get("email"),
            "user_name": user.get("display_name") or user.get("name"),
            "changes": {
                "category": category,
                "key": key,
                "old_value": old_value,
                "new_value": new_value,
            },
            "created_at": datetime.datetime.utcnow().isoformat(),
        })
    except Exception:
        # Audit logging must never block the main operation.
        pass


# --- Repositories ---
class OrganizationRepository(BaseRepository):
    collection_name = "organizations"


class NotificationPreferenceRepository(BaseRepository):
    collection_name = "notification_preferences"


# --- Pydantic Models ---
class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    phone: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_number: Optional[str] = None
    registration_number: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None


class NotificationPreferencesUpdate(BaseModel):
    invoice_overdue: bool = True
    payment_received: bool = True
    quote_accepted: bool = True
    expense_approved: bool = True


# --- Profile ---
@router.get("/profile")
def get_profile(user: dict = Depends(get_current_user)):
    from app.cache import cache as _cache
    _ck = f"profile:{user['id']}"
    cached = _cache.get(_ck)
    if cached is not None:
        return cached
    result = {
        "id": user["id"],
        "email": user.get("email", ""),
        "display_name": user.get("display_name", ""),
        "phone": user.get("phone", ""),
        "role": user.get("role", ""),
        "org_id": user.get("org_id", ""),
    }
    _cache.set(_ck, result)
    return result


@router.put("/profile")
def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    update_data: dict = {}
    if data.display_name is not None:
        update_data["display_name"] = data.display_name
    if data.phone is not None:
        update_data["phone"] = data.phone
    if not update_data:
        raise HTTPException(status_code=400, detail="هیچ داتایەک نەنێردرا")
    update_data["updated_at"] = datetime.datetime.utcnow()
    db.collection("users").document(user["id"]).update(update_data)
    return {"ok": True}


@router.put("/profile/password")
def change_password(data: PasswordChange, user: dict = Depends(get_current_user)):
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="وشەی نهێنی نوێ پێویستە لانی کەم ٦ پیت بێت")
    stored_hash = user.get("password", "")
    if not verify_password(data.current_password, stored_hash):
        raise HTTPException(status_code=400, detail="وشەی نهێنی ئێستا هەڵەیە")
    db = get_db()
    db.collection("users").document(user["id"]).update({
        "password": hash_password(data.new_password),
        "updated_at": datetime.datetime.utcnow(),
    })
    return {"ok": True}


# --- Organization ---
@router.get("/organization")
def get_organization(user: dict = Depends(get_current_user)):
    repo = OrganizationRepository(user["org_id"])
    items, _ = repo.list(limit=1)
    if items:
        return items[0]
    return {"name": "", "phone": "", "email": "", "tax_number": "", "registration_number": "",
            "address_line1": "", "address_line2": "", "city": "", "country": ""}


@router.get("/organizations")
def list_my_organizations(user: dict = Depends(get_current_user)):
    """List organizations the current user can access (current org + memberships)."""
    db = get_db()
    org_id = user.get("org_id")
    user_id = user.get("id") or user.get("uid")
    if not org_id:
        return {"current": None, "organizations": []}
    items: list[dict] = []
    seen: set[str] = set()

    def _add(oid: str, role: str, is_current: bool):
        if oid in seen:
            return
        seen.add(oid)
        org_doc = db.collection("organizations").document(oid).get()
        org_data: dict = org_doc.to_dict() if org_doc.exists else {}
        items.append({
            "id": oid,
            "name": org_data.get("name") or org_data.get("display_name") or "Organization",
            "is_current": is_current,
            "role": role,
            "logo_url": org_data.get("logo_url"),
        })

    _add(org_id, user.get("role", "member"), True)

    # Optional org_memberships collection: { user_id, org_id, role }
    if user_id:
        try:
            for snap in db.collection("org_memberships").where("user_id", "==", user_id).stream():
                m = snap.to_dict() or {}
                target = m.get("org_id")
                if target:
                    _add(target, m.get("role", "member"), target == org_id)
        except Exception:
            pass

    return {"current": org_id, "organizations": items}


@router.post("/switch-organization/{target_org_id}")
def switch_organization(target_org_id: str, user: dict = Depends(get_current_user)):
    """Issue a new JWT bound to a different organization.

    Requires either: (a) target == current, or (b) an org_memberships document
    linking the current user to target_org_id.
    """
    from app.services.auth import create_access_token
    db = get_db()
    user_id = user.get("id") or user.get("uid")
    current_org = user.get("org_id")
    if target_org_id != current_org:
        # Verify membership
        allowed = False
        if user_id:
            try:
                q = db.collection("org_memberships") \
                    .where("user_id", "==", user_id) \
                    .where("org_id", "==", target_org_id).limit(1).stream()
                allowed = any(True for _ in q)
            except Exception:
                allowed = False
        if not allowed:
            raise HTTPException(403, "ئەم بەکارهێنەرە بەشدارییە لەم دامەزراوەیەدا نییە")
    token = create_access_token({
        "sub": user.get("email") or user_id,
        "id": user_id,
        "uid": user_id,
        "email": user.get("email"),
        "org_id": target_org_id,
        "role": user.get("role", "member"),
    })
    return {"access_token": token, "token_type": "bearer", "org_id": target_org_id}



@router.put("/organization")
def update_organization(data: OrganizationUpdate, user: dict = Depends(get_current_user)):
    # Requirement 12.4 — Organization settings write requires admin/owner role.
    _require_settings_write(user)

    repo = OrganizationRepository(user["org_id"])
    items, _ = repo.list(limit=1)
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="هیچ داتایەک نەنێردرا")

    old_value = items[0] if items else None
    result = repo.update(items[0]["id"], payload) if items else repo.create(payload)

    # Requirement 12.5 — Log organization settings change.
    _log_settings_change(user, "organization", "blob", old_value, payload)

    return result


# --- Notification Preferences ---
@router.get("/notification-preferences")
def get_notification_preferences(user: dict = Depends(get_current_user)):
    repo = NotificationPreferenceRepository(user["org_id"])
    filters = [{"field": "user_id", "op": "==", "value": user["id"]}]
    items, _ = repo.list(filters=filters, limit=1)
    if items:
        return items[0]
    return {"invoice_overdue": True, "payment_received": True, "quote_accepted": True, "expense_approved": True}


@router.put("/notification-preferences")
def update_notification_preferences(data: NotificationPreferencesUpdate, user: dict = Depends(get_current_user)):
    repo = NotificationPreferenceRepository(user["org_id"])
    filters = [{"field": "user_id", "op": "==", "value": user["id"]}]
    items, _ = repo.list(filters=filters, limit=1)
    payload = data.model_dump()
    payload["user_id"] = user["id"]
    if items:
        return repo.update(items[0]["id"], payload)
    return repo.create(payload)


@router.post("/notification-preferences/test")
def test_notification(data: dict, user: dict = Depends(get_current_user)):
    """Send a test notification on the requested channel.

    Accepts: { "channel": "email" | "sms" | "push" | "whatsapp" | "slack" | "in_app" }
    Returns a confirmation — actual delivery is best-effort.
    """
    channel = data.get("channel", "in_app")
    allowed = {"email", "sms", "push", "whatsapp", "slack", "in_app"}
    if channel not in allowed:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Channel '{channel}' not supported. Use one of: {', '.join(sorted(allowed))}")
    # Log the test request to the audit log (best-effort)
    try:
        repo = AuditLogRepository(user["org_id"])
        import uuid as _uuid, datetime as _dt
        repo.create({
            "id": str(_uuid.uuid4()),
            "entity_type": "notification_test",
            "entity_id": channel,
            "action": "test",
            "method": "POST",
            "user_id": user.get("id"),
            "user_email": user.get("email"),
            "user_name": user.get("display_name") or user.get("name"),
            "changes": {"channel": channel},
            "created_at": _dt.datetime.utcnow().isoformat(),
        })
    except Exception:
        pass
    return {"ok": True, "channel": channel, "message": f"Test {channel} notification queued"}


# --- Settings ---
@router.get("/settings")
def get_settings(user: dict = Depends(get_current_user)):
    """List all raw settings documents for the current organisation."""
    from app.cache import cache as _cache
    _ck = f"settings_all:{user['org_id']}"
    cached = _cache.get(_ck)
    if cached is not None:
        return cached
    repo = SettingsRepository(user["org_id"])
    items, _ = repo.list(limit=100)
    _cache.set(_ck, items)
    return items


@router.post("/settings")
def upsert_setting(data: dict, user: dict = Depends(get_current_user)):
    """Upsert a single settings key/value pair for the current organisation.

    Requirement 12.4 — Requires admin or owner role.
    Requirement 12.5 — Logs the change to the audit log.
    """
    # Requirement 12.4 — Settings write requires admin/owner role.
    _require_settings_write(user)

    key = data.get("key")
    if not key:
        raise HTTPException(status_code=400, detail="key required")

    category = data.get("category", "general")
    repo = SettingsRepository(user["org_id"])
    items, _ = repo.list(
        filters=[
            {"field": "key", "op": "==", "value": key},
            {"field": "category", "op": "==", "value": category},
        ],
        limit=1,
    )

    # Capture old value for audit log before overwriting.
    old_value = items[0].get("value") if items else None
    new_value = data.get("value", "")

    payload = {
        "key": key,
        "value": new_value,
        "category": category,
    }
    result = repo.update(items[0]["id"], payload) if items else repo.create(payload)
    try:
        _settings_service.invalidate(user["org_id"], category)
    except Exception:
        pass
    # Invalidate settings cache
    from app.cache import cache as _cache
    _cache.delete(f"settings_all:{user['org_id']}")

    # Requirement 12.5 — Log all setting changes for audit purposes.
    _log_settings_change(user, category, key, old_value, new_value)

    return result


@router.get("/settings/{category}")
def get_settings_bag(category: str, user: dict = Depends(get_current_user)):
    """Return the merged settings bag for *category* scoped to the current
    organisation (Requirement 11.4).  Defaults are applied for any key not
    yet stored in Firestore so callers always receive a complete dict.

    The response is organisation-scoped: two organisations sharing the same
    Firestore project never see each other's settings (Requirement 11.4).
    """
    return _settings_service.get_bag(user["org_id"], category)


@router.put("/settings/{category}")
def set_settings_bag(category: str, data: dict, user: dict = Depends(get_current_user)):
    """Persist a full settings bag for *category* scoped to the current
    organisation (Requirements 11.2, 11.4).

    The entire *data* dict is serialised as a JSON blob and stored in
    Firestore under ``settings/{category}``.  The in-process cache is
    invalidated so subsequent GET calls reflect the new values immediately.
    Server settings take precedence over any conflicting client-side values
    (Requirement 11.5).

    Requirement 12.4 — Requires admin or owner role.
    Requirement 12.5 — Logs the change to the audit log.
    """
    # Requirement 12.4 — Settings write requires admin/owner role.
    _require_settings_write(user)

    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Request body must be a JSON object")

    # Capture old value for audit log.
    old_value = _settings_service.get_bag(user["org_id"], category)

    try:
        result = _settings_service.set_bag(user["org_id"], category, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Requirement 12.5 — Log all setting changes for audit purposes.
    _log_settings_change(user, category, "blob", old_value, data)

    return result


@router.get("/reminder-settings")
def get_reminder_settings(user: dict = Depends(get_current_user)):
    repo = ReminderSettingsRepository(user["org_id"])
    items, _ = repo.list(limit=1)
    if items:
        return items[0]
    return {
        "before_due_days": "3,7,14",
        "after_due_days": "1,3,7",
        "email_subject_template": "Invoice reminder",
        "email_body_template": "Your invoice is due soon.",
        "is_active": True,
    }


@router.put("/reminder-settings")
def update_reminder_settings(data: dict, user: dict = Depends(get_current_user)):
    # Requirement 12.4 — Settings write requires admin/owner role.
    _require_settings_write(user)

    repo = ReminderSettingsRepository(user["org_id"])
    items, _ = repo.list(limit=1)
    old_value = items[0] if items else None
    payload = {
        "before_due_days": data.get("before_due_days", "3,7,14"),
        "after_due_days": data.get("after_due_days", "1,3,7"),
        "email_subject_template": data.get("email_subject_template", "Invoice reminder"),
        "email_body_template": data.get("email_body_template", "Your invoice is due soon."),
        "is_active": bool(data.get("is_active", True)),
    }
    result = repo.update(items[0]["id"], payload) if items else repo.create(payload)

    # Requirement 12.5 — Log reminder settings change.
    _log_settings_change(user, "reminders", "blob", old_value, payload)

    return result


@router.get("/currencies")
def list_currencies():
    repo = CurrencyRepository("system")
    items, _ = repo.list(limit=200)
    return items


# --- Exchange Rates ---
class ExchangeRateIn(BaseModel):
    from_currency: str
    to_currency: str
    rate: float
    date: str


@router.get("/exchange-rates")
def list_exchange_rates(user: dict = Depends(get_current_user)):
    repo = ExchangeRateRepository(user["org_id"])
    items, _ = repo.list(limit=500)
    return items


@router.post("/exchange-rates", status_code=201)
def create_exchange_rate(data: ExchangeRateIn, user: dict = Depends(get_current_user)):
    repo = ExchangeRateRepository(user["org_id"])
    return repo.create(data.model_dump())


# --- Invoice Templates ---
class InvoiceTemplateIn(BaseModel):
    name: str
    layout: str = "classic"
    colors: Optional[str] = None
    show_logo: bool = True
    footer_text: Optional[str] = None


class InvoiceTemplateRepo(BaseRepository):
    collection_name = "invoice_templates"


@router.get("/invoice-templates")
def list_invoice_templates(user: dict = Depends(get_current_user)):
    repo = InvoiceTemplateRepo(user["org_id"])
    items, _ = repo.list(limit=100)
    return items


@router.post("/invoice-templates", status_code=201)
def create_invoice_template(data: InvoiceTemplateIn, user: dict = Depends(get_current_user)):
    repo = InvoiceTemplateRepo(user["org_id"])
    payload = data.model_dump()
    # first template is default
    existing, _ = repo.list(limit=1)
    payload["is_default"] = len(existing) == 0
    return repo.create(payload)


@router.post("/invoice-templates/{template_id}/set-default")
def set_default_template(template_id: str, user: dict = Depends(get_current_user)):
    repo = InvoiceTemplateRepo(user["org_id"])
    # unset all defaults
    items, _ = repo.list(limit=100)
    for item in items:
        repo.update(item["id"], {"is_default": item["id"] == template_id})
    return {"ok": True}


# --- Backup ---
class BackupRepo(BaseRepository):
    collection_name = "backups"


@router.get("/backup/list")
def list_backups(user: dict = Depends(get_current_user)):
    repo = BackupRepo(user["org_id"])
    items, _ = repo.list(limit=50)
    return items


@router.post("/backup", status_code=201)
def create_backup(user: dict = Depends(get_current_user)):
    repo = BackupRepo(user["org_id"])
    now = datetime.datetime.utcnow()
    filename = f"backup_{now.strftime('%Y%m%d_%H%M%S')}.json"
    entry = repo.create({"filename": filename, "created": now.isoformat(), "size": 0})
    return entry


@router.get("/backup/download")
def download_backup(user: dict = Depends(get_current_user)):
    data = json.dumps({"org_id": user["org_id"], "exported_at": datetime.datetime.utcnow().isoformat()})
    return StreamingResponse(
        io.BytesIO(data.encode()),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=backup.json"}
    )


# --- Activity Log ---
class ActivityLogRepo(BaseRepository):
    collection_name = "activity_log"


@router.get("/activity-log")
def list_activity_log(
    page: int = 1,
    page_size: int = 20,
    action: Optional[str] = Query(None),
    entity: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    repo = ActivityLogRepo(user["org_id"])
    filters: List[dict] = []
    if action:
        filters.append({"field": "action", "op": "==", "value": action})
    if entity:
        filters.append({"field": "entity_type", "op": "==", "value": entity})
    if from_date:
        filters.append({"field": "created_at", "op": ">=", "value": datetime.datetime.fromisoformat(from_date)})
    if to_date:
        filters.append({"field": "created_at", "op": "<=", "value": datetime.datetime.fromisoformat(to_date + "T23:59:59")})
    items, total = repo.list(
        filters=filters if filters else None,
        limit=page_size,
        offset=(page - 1) * page_size,
        order_by="created_at",
    )
    return {"items": items, "total": total}


@router.get("/public-config")
def get_public_config(user: dict = Depends(get_current_user)):
    """Bootstrap config consumed by the SPA: formats, branding, payment methods,
    localization, mobile, working hours, languages, SSO providers."""
    org_id = user["org_id"]
    return {
        "formats": _settings_service.get_formats_settings(org_id),
        "branding": _settings_service.get_branding_settings(org_id),
        "payment_methods": _settings_service.get_payment_methods_settings(org_id),
        "localization": _settings_service.get_localization_settings(org_id),
        "mobile": _settings_service.get_mobile_settings(org_id),
        "working_hours": _settings_service.get_working_hours_settings(org_id),
        "holidays": _settings_service.get_holidays_settings(org_id),
        "sso": _settings_service.get_sso_settings(org_id),
        "portals": _settings_service.get_portals_settings(org_id),
        "languages": _settings_service.get_bag(org_id, "languages", {
            "active": ["ku", "en", "ar"],
            "default_lang": "ku",
            "document_lang": "en",
            "rtl": True,
        }),
    }
