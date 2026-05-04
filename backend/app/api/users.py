"""Admin User Management API.

Provides admin-level CRUD for users in the same organisation:
- list / get / create / update
- suspend / activate / archive
- reset password
- invite by email + accept invite (Sprint C)

All endpoints require the `rbac.manage` permission, except the public
invite verification + acceptance routes used by the invitee.
"""
import uuid
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.firebase_client import get_db
from app.firestore.users import UserRepository
from app.services.auth import (
    get_current_user,
    hash_password,
    validate_password_strength,
    create_access_token,
)
from app.services.permissions import require_perm, DEFAULT_ROLES
from app.services import settings_service
from app.api.rbac import RoleRepository, UserRoleRepository

router = APIRouter(prefix="/api/users", tags=["Users (Admin)"])
limiter = Limiter(key_func=get_remote_address)


# ── Status constants ──
STATUS_INVITED = "invited"
STATUS_ACTIVE = "active"
STATUS_SUSPENDED = "suspended"
STATUS_ARCHIVED = "archived"
ALL_STATUSES = {STATUS_INVITED, STATUS_ACTIVE, STATUS_SUSPENDED, STATUS_ARCHIVED}

INVITE_TTL_DAYS = 7
INVITE_TOKEN_BYTES = 32


# ── Pydantic schemas ──
class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=8, max_length=128)
    role_ids: list[str] = Field(default_factory=list)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    status: Optional[str] = None
    role_ids: Optional[list[str]] = None


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class InviteCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=2, max_length=80)
    role_ids: list[str] = Field(default_factory=list)


class InviteAccept(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=8, max_length=128)


# ── Helpers ──
def _derive_status(user: dict) -> str:
    """Return effective status, deriving from is_active for legacy records."""
    s = user.get("status")
    if s in ALL_STATUSES:
        return s
    return STATUS_ACTIVE if user.get("is_active", True) else STATUS_SUSPENDED


def _validate_role_ids(org_id: str, role_ids: list[str]) -> None:
    """Ensure each id is either default:<code> or a real custom role document."""
    if not role_ids:
        return
    repo = RoleRepository(org_id)
    custom_ids = {r["id"] for r in repo.list(limit=1000)[0]}
    for rid in role_ids:
        if rid.startswith("default:"):
            code = rid.split(":", 1)[1]
            if code not in DEFAULT_ROLES:
                raise HTTPException(400, f"ڕۆڵی default نەناسراو: {code}")
        elif rid not in custom_ids:
            raise HTTPException(400, f"ڕۆڵ نەدۆزرایەوە: {rid}")


def _set_user_roles(org_id: str, user_id: str, role_ids: list[str], actor_id: str) -> None:
    """Replace assignments for user_id with given role_ids."""
    ur_repo = UserRoleRepository(org_id)
    existing, _ = ur_repo.list(
        filters=[{"field": "user_id", "op": "==", "value": user_id}],
        limit=1000,
    )
    for item in existing:
        ur_repo.delete(item["id"], hard=True)
    for rid in role_ids:
        ur_repo.create({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "role_id": rid,
            "assigned_by": actor_id,
        })


def _get_user_role_ids(org_id: str, user_id: str) -> list[str]:
    ur_repo = UserRoleRepository(org_id)
    items, _ = ur_repo.list(
        filters=[{"field": "user_id", "op": "==", "value": user_id}],
        limit=1000,
    )
    seen: set[str] = set()
    out: list[str] = []
    for it in items:
        rid = it.get("role_id")
        if rid and rid not in seen:
            seen.add(rid)
            out.append(rid)
    return out


def _resolve_role_labels(org_id: str, role_ids: list[str]) -> list[dict]:
    if not role_ids:
        return []
    custom_by_id: dict = {}
    repo = RoleRepository(org_id)
    for r in repo.list(limit=1000)[0]:
        custom_by_id[r["id"]] = r
    out = []
    for rid in role_ids:
        if rid.startswith("default:"):
            code = rid.split(":", 1)[1]
            info = DEFAULT_ROLES.get(code)
            out.append({
                "id": rid,
                "code": code,
                "name": info["name"] if info else code,
                "name_ku": info.get("name_ku", code) if info else code,
            })
        elif rid in custom_by_id:
            r = custom_by_id[rid]
            out.append({
                "id": rid,
                "code": r.get("code"),
                "name": r.get("name"),
                "name_ku": r.get("name_ku") or r.get("name"),
            })
    return out


def _user_has_admin(org_id: str, user_id: str) -> bool:
    """Check whether user has any admin-equivalent role (default:admin or legacy role=admin)."""
    db = get_db()
    doc = db.collection("users").document(user_id).get()
    if doc.exists and doc.to_dict().get("role") == "admin":
        return True
    for rid in _get_user_role_ids(org_id, user_id):
        if rid == "default:admin":
            return True
    return False


def _count_active_admins(org_id: str, exclude_user_id: Optional[str] = None) -> int:
    """Count users in the org with admin privileges and active status."""
    repo = UserRepository(org_id)
    users, _ = repo.list(limit=2000)
    count = 0
    for u in users:
        if u["id"] == exclude_user_id:
            continue
        if _derive_status(u) != STATUS_ACTIVE:
            continue
        if _user_has_admin(org_id, u["id"]):
            count += 1
    return count


def _serialize_user(org_id: str, u: dict) -> dict:
    role_ids = _get_user_role_ids(org_id, u["id"])
    return {
        "id": u["id"],
        "email": u.get("email"),
        "name": u.get("name") or u.get("full_name"),
        "status": _derive_status(u),
        "is_active": _derive_status(u) == STATUS_ACTIVE,
        "legacy_role": u.get("role"),
        "auth_provider": u.get("auth_provider", "email"),
        "is_2fa_enabled": bool(u.get("is_2fa_enabled")),
        "last_login_at": u.get("last_login_at") or u.get("last_login"),
        "last_login_ip": u.get("last_login_ip"),
        "invited_by": u.get("invited_by"),
        "invited_at": u.get("invited_at"),
        "accepted_at": u.get("accepted_at"),
        "created_at": u.get("created_at"),
        "role_ids": role_ids,
        "assigned_roles": _resolve_role_labels(org_id, role_ids),
    }


def _guard_self(actor_id: str, target_id: str, action_msg: str) -> None:
    if actor_id == target_id:
        raise HTTPException(400, f"ناتوانیت {action_msg} لەسەر ئەکاونتی خۆت بکەیت")


def _guard_last_admin(org_id: str, target_id: str) -> None:
    """Block actions that would leave the org without any active admin."""
    if not _user_has_admin(org_id, target_id):
        return
    remaining = _count_active_admins(org_id, exclude_user_id=target_id)
    if remaining == 0:
        raise HTTPException(409, "ئەمە تاکە بەڕێوەبەری چالاکی ڕێکخراوەیە و ناتوانرێت ناچالاک بکرێت")


def _email_exists(email: str, exclude_user_id: Optional[str] = None) -> bool:
    db = get_db()
    docs = db.collection("users").where("email", "==", email).limit(5).stream()
    for doc in docs:
        if exclude_user_id and doc.id == exclude_user_id:
            continue
        return True
    return False


# ── Endpoints: list + read ──
@router.get("", dependencies=[Depends(require_perm("rbac.manage"))])
def list_users(
    user: dict = Depends(get_current_user),
    status: Optional[str] = Query(default=None),
    role_id: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    include_archived: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """List users in current org with optional filters."""
    org_id = user["org_id"]
    repo = UserRepository(org_id)
    users, _ = repo.list(limit=2000, include_deleted=False)

    items: list[dict] = []
    for u in users:
        s = _derive_status(u)
        if not include_archived and s == STATUS_ARCHIVED:
            continue
        if status and s != status:
            continue
        if q:
            ql = q.lower()
            hay = f"{(u.get('email') or '').lower()} {(u.get('name') or '').lower()} {(u.get('full_name') or '').lower()}"
            if ql not in hay:
                continue
        items.append(_serialize_user(org_id, u))

    if role_id:
        items = [it for it in items if role_id in (it.get("role_ids") or [])]

    total = len(items)
    items.sort(key=lambda x: (x.get("created_at") or ""), reverse=True)
    return {
        "items": items[offset: offset + limit],
        "total": total,
    }


@router.get("/{uid}", dependencies=[Depends(require_perm("rbac.manage"))])
def get_user(uid: str, user: dict = Depends(get_current_user)):
    repo = UserRepository(user["org_id"])
    u = repo.get(uid)
    if not u or u.get("org_id") != user["org_id"]:
        raise HTTPException(404, "بەکارهێنەر نەدۆزرایەوە")
    return _serialize_user(user["org_id"], u)


# ── Create / update ──
@router.post("", dependencies=[Depends(require_perm("rbac.manage"))])
@limiter.limit("20/minute")
def create_user(request: Request, data: UserCreate, user: dict = Depends(get_current_user)):
    """Direct create — no email invite. Useful for seeding internal accounts."""
    # Apply GDPR config if applicable
    try:
        cfg = settings_service.get_bag(user["org_id"], "gdpr")
    except Exception:
        cfg = {}
    
    # Check consent requirement
    if cfg.get("require_consent", False):
        if not hasattr(data, 'consent') or not data.consent:
            raise HTTPException(400, "User consent is required per GDPR policy")
    
    validate_password_strength(data.password)
    if _email_exists(data.email):
        raise HTTPException(409, "ئەم ئیمەیڵە پێشتر تۆمارکراوە")
    _validate_role_ids(user["org_id"], data.role_ids)

    repo = UserRepository(user["org_id"])
    new_id = str(uuid.uuid4())
    repo.create({
        "id": new_id,
        "email": data.email,
        "name": data.name,
        "password_hash": hash_password(data.password),
        "status": STATUS_ACTIVE,
        "is_active": True,
        "auth_provider": "email",
        "created_by": user["id"],
    })
    _set_user_roles(user["org_id"], new_id, data.role_ids, user["id"])
    return _serialize_user(user["org_id"], repo.get(new_id))


@router.put("/{uid}", dependencies=[Depends(require_perm("rbac.manage"))])
@limiter.limit("30/minute")
def update_user(request: Request, uid: str, data: UserUpdate, user: dict = Depends(get_current_user)):
    repo = UserRepository(user["org_id"])
    existing = repo.get(uid)
    if not existing or existing.get("org_id") != user["org_id"]:
        raise HTTPException(404, "بەکارهێنەر نەدۆزرایەوە")

    update_payload: dict = {}
    if data.name is not None:
        update_payload["name"] = data.name

    if data.status is not None:
        if data.status not in ALL_STATUSES:
            raise HTTPException(400, f"دۆخی نەناسراو: {data.status}")
        # Prevent self-disable / removing the last admin
        if data.status != STATUS_ACTIVE:
            _guard_self(user["id"], uid, "گۆڕینی دۆخ")
            _guard_last_admin(user["org_id"], uid)
        update_payload["status"] = data.status
        update_payload["is_active"] = (data.status == STATUS_ACTIVE)

    if update_payload:
        repo.update(uid, update_payload)

    if data.role_ids is not None:
        _validate_role_ids(user["org_id"], data.role_ids)
        # Removing admin role from yourself or last admin → block
        if not any(rid == "default:admin" for rid in data.role_ids):
            if _user_has_admin(user["org_id"], uid):
                _guard_self(user["id"], uid, "لابردنی ڕۆڵی بەڕێوەبەر")
                _guard_last_admin(user["org_id"], uid)
        _set_user_roles(user["org_id"], uid, data.role_ids, user["id"])

    return _serialize_user(user["org_id"], repo.get(uid))


# ── Status actions ──
@router.post("/{uid}/suspend", dependencies=[Depends(require_perm("rbac.manage"))])
def suspend_user(uid: str, user: dict = Depends(get_current_user)):
    _guard_self(user["id"], uid, "ناچالاککردن")
    repo = UserRepository(user["org_id"])
    existing = repo.get(uid)
    if not existing or existing.get("org_id") != user["org_id"]:
        raise HTTPException(404, "بەکارهێنەر نەدۆزرایەوە")
    _guard_last_admin(user["org_id"], uid)
    repo.update(uid, {"status": STATUS_SUSPENDED, "is_active": False, "suspended_at": datetime.utcnow()})
    return _serialize_user(user["org_id"], repo.get(uid))


@router.post("/{uid}/activate", dependencies=[Depends(require_perm("rbac.manage"))])
def activate_user(uid: str, user: dict = Depends(get_current_user)):
    repo = UserRepository(user["org_id"])
    existing = repo.get(uid)
    if not existing or existing.get("org_id") != user["org_id"]:
        raise HTTPException(404, "بەکارهێنەر نەدۆزرایەوە")
    repo.update(uid, {"status": STATUS_ACTIVE, "is_active": True, "suspended_at": None})
    return _serialize_user(user["org_id"], repo.get(uid))


@router.delete("/{uid}", dependencies=[Depends(require_perm("rbac.manage"))])
def archive_user(uid: str, user: dict = Depends(get_current_user)):
    """Soft-archive — user can no longer log in but data is preserved."""
    _guard_self(user["id"], uid, "ئەرشیفکردن")
    repo = UserRepository(user["org_id"])
    existing = repo.get(uid)
    if not existing or existing.get("org_id") != user["org_id"]:
        raise HTTPException(404, "بەکارهێنەر نەدۆزرایەوە")
    _guard_last_admin(user["org_id"], uid)
    repo.update(uid, {"status": STATUS_ARCHIVED, "is_active": False, "archived_at": datetime.utcnow()})
    return {"success": True}


# ── Password ──
@router.post("/{uid}/reset-password", dependencies=[Depends(require_perm("rbac.manage"))])
@limiter.limit("10/minute")
def admin_reset_password(request: Request, uid: str, data: PasswordReset, user: dict = Depends(get_current_user)):
    """Admin sets a new temporary password and forces change on next login."""
    validate_password_strength(data.new_password)
    repo = UserRepository(user["org_id"])
    existing = repo.get(uid)
    if not existing or existing.get("org_id") != user["org_id"]:
        raise HTTPException(404, "بەکارهێنەر نەدۆزرایەوە")
    repo.update(uid, {
        "password_hash": hash_password(data.new_password),
        "must_change_password": True,
        "password_reset_at": datetime.utcnow(),
    })
    return {"success": True}


# ── Sprint C: Invite-by-email ──
def _generate_invite_token() -> str:
    return secrets.token_urlsafe(INVITE_TOKEN_BYTES)


def _store_invite(org_id: str, user_id: str, token: str, invited_by: str) -> None:
    db = get_db()
    db.collection("invite_tokens").document(token).set({
        "token": token,
        "user_id": user_id,
        "org_id": org_id,
        "invited_by": invited_by,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(days=INVITE_TTL_DAYS),
        "used_at": None,
    })


def _send_invite_email(email: str, name: str, org_name: str, accept_url: str, org_id: str | None = None) -> None:
    """Send invitation email via SMTP if org SMTP is configured; otherwise log the URL."""
    import logging
    log = logging.getLogger("invite")
    body_html = (
        f"<html><body style='font-family:Arial,sans-serif'>"
        f"<h2>بانگهێشت بۆ {org_name}</h2>"
        f"<p>سڵاو {name},</p>"
        f"<p>تۆ بانگهێشت کراویت بۆ بەشداری لە <b>{org_name}</b> لە سیستەمی Zoho ERP.</p>"
        f"<p>بۆ پەسەندکردنی بانگهێشتەکە، کلیک لەسەر بەستەری خوارەوە بکە:</p>"
        f"<p><a href='{accept_url}' style='background:#1677ff;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px'>پەسەندکردنی بانگهێشت</a></p>"
        f"<p style='color:#888;font-size:11px'>ئەم بەستەرە لە ماوەی {INVITE_TTL_DAYS} ڕۆژدا بەسەردەچێت.</p>"
        f"</body></html>"
    )
    if org_id:
        try:
            from app.services.email_service import send_email
            send_email(
                org_id=org_id,
                to_email=email,
                subject=f"بانگهێشت بۆ {org_name}",
                body_html=body_html,
                entity_type="invite",
                entity_id=email,
            )
            log.info("[INVITE] sent via SMTP to=%s org=%s", email, org_name)
            return
        except Exception as ex:
            log.warning("[INVITE] SMTP failed (%s); falling back to log: to=%s url=%s", ex, email, accept_url)
    log.warning("[INVITE] (no SMTP) to=%s name=%s org=%s url=%s", email, name, org_name, accept_url)


@router.post("/invite", dependencies=[Depends(require_perm("rbac.manage"))])
@limiter.limit("20/hour")
def invite_user(request: Request, data: InviteCreate, user: dict = Depends(get_current_user)):
    org_id = user["org_id"]
    if _email_exists(data.email):
        raise HTTPException(409, "ئەم ئیمەیڵە پێشتر هەیە")
    _validate_role_ids(org_id, data.role_ids)

    repo = UserRepository(org_id)
    new_id = str(uuid.uuid4())
    repo.create({
        "id": new_id,
        "email": data.email,
        "name": data.name,
        "password_hash": "",
        "status": STATUS_INVITED,
        "is_active": False,
        "auth_provider": "email",
        "invited_by": user["id"],
        "invited_at": datetime.utcnow(),
    })
    _set_user_roles(org_id, new_id, data.role_ids, user["id"])

    token = _generate_invite_token()
    _store_invite(org_id, new_id, token, user["id"])

    # Build accept URL using request origin
    origin = str(request.base_url).rstrip("/").replace(":8000", ":5173")
    accept_url = f"{origin}/accept-invite?token={token}"

    db = get_db()
    org_doc = db.collection("organizations").document(org_id).get()
    org_name = org_doc.to_dict().get("name") if org_doc.exists else "Zoho ERP"

    _send_invite_email(data.email, data.name, org_name, accept_url, org_id)

    return {
        "user": _serialize_user(org_id, repo.get(new_id)),
        "invite": {
            "token": token,
            "accept_url": accept_url,
            "expires_in_days": INVITE_TTL_DAYS,
        },
    }


@router.post("/invite/{uid}/resend", dependencies=[Depends(require_perm("rbac.manage"))])
@limiter.limit("3/hour")
def resend_invite(request: Request, uid: str, user: dict = Depends(get_current_user)):
    repo = UserRepository(user["org_id"])
    existing = repo.get(uid)
    if not existing or existing.get("org_id") != user["org_id"]:
        raise HTTPException(404, "بەکارهێنەر نەدۆزرایەوە")
    if _derive_status(existing) != STATUS_INVITED:
        raise HTTPException(400, "ئەم بەکارهێنەرە لە دۆخی بانگهێشتدا نییە")

    # Invalidate prior tokens for this user
    db = get_db()
    for doc in db.collection("invite_tokens").where("user_id", "==", uid).stream():
        d = doc.to_dict() or {}
        if not d.get("used_at"):
            doc.reference.update({"expires_at": datetime.utcnow()})

    token = _generate_invite_token()
    _store_invite(user["org_id"], uid, token, user["id"])

    origin = str(request.base_url).rstrip("/").replace(":8000", ":5173")
    accept_url = f"{origin}/accept-invite?token={token}"

    org_doc = db.collection("organizations").document(user["org_id"]).get()
    org_name = org_doc.to_dict().get("name") if org_doc.exists else "Zoho ERP"
    _send_invite_email(existing.get("email"), existing.get("name") or "", org_name, accept_url, org_id)

    return {"token": token, "accept_url": accept_url, "expires_in_days": INVITE_TTL_DAYS}


@router.get("/invite/verify")
def verify_invite(token: str = Query(...)):
    """Public endpoint — used by accept-invite page to show name/org before submit."""
    db = get_db()
    doc = db.collection("invite_tokens").document(token).get()
    if not doc.exists:
        raise HTTPException(404, "بانگهێشت نەدۆزرایەوە")
    inv = doc.to_dict() or {}
    if inv.get("used_at"):
        raise HTTPException(400, "ئەم بانگهێشتە پێشتر بەکارهاتووە")
    expires = inv.get("expires_at")
    if isinstance(expires, str):
        try:
            expires = datetime.fromisoformat(expires)
        except Exception:
            expires = None
    if expires and expires < datetime.utcnow():
        raise HTTPException(400, "ماوەی بانگهێشت بەسەرچوو")

    user_doc = db.collection("users").document(inv["user_id"]).get()
    if not user_doc.exists:
        raise HTTPException(404, "بەکارهێنەر نەدۆزرایەوە")
    u = user_doc.to_dict()
    org_doc = db.collection("organizations").document(inv["org_id"]).get()
    org_name = org_doc.to_dict().get("name") if org_doc.exists else "Zoho ERP"

    return {
        "valid": True,
        "email": u.get("email"),
        "name": u.get("name"),
        "org_name": org_name,
    }


@router.post("/accept-invite")
@limiter.limit("10/hour")
def accept_invite(request: Request, data: InviteAccept):
    """Public endpoint — user sets password and activates account."""
    validate_password_strength(data.password)
    db = get_db()
    doc_ref = db.collection("invite_tokens").document(data.token)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(404, "بانگهێشت نەدۆزرایەوە")
    inv = doc.to_dict() or {}
    if inv.get("used_at"):
        raise HTTPException(400, "ئەم بانگهێشتە پێشتر بەکارهاتووە")
    expires = inv.get("expires_at")
    if isinstance(expires, str):
        try:
            expires = datetime.fromisoformat(expires)
        except Exception:
            expires = None
    if expires and expires < datetime.utcnow():
        raise HTTPException(400, "ماوەی بانگهێشت بەسەرچوو")

    repo = UserRepository(inv["org_id"])
    existing = repo.get(inv["user_id"])
    if not existing:
        raise HTTPException(404, "بەکارهێنەر نەدۆزرایەوە")

    repo.update(inv["user_id"], {
        "password_hash": hash_password(data.password),
        "status": STATUS_ACTIVE,
        "is_active": True,
        "accepted_at": datetime.utcnow(),
    })
    doc_ref.update({"used_at": datetime.utcnow()})

    token = create_access_token(data={"sub": inv["user_id"], "org_id": inv["org_id"]})
    return {
        "access_token": token,
        "user_id": inv["user_id"],
        "org_id": inv["org_id"],
        "user_name": existing.get("name"),
    }


# ── Bulk (Sprint E) ──
class BulkAction(BaseModel):
    action: str  # suspend | activate | archive | assign_role
    user_ids: list[str]
    role_id: Optional[str] = None


@router.post("/bulk", dependencies=[Depends(require_perm("rbac.manage"))])
@limiter.limit("10/minute")
def bulk_action(request: Request, data: BulkAction, user: dict = Depends(get_current_user)):
    org_id = user["org_id"]
    repo = UserRepository(org_id)
    results: list[dict] = []
    for uid in data.user_ids:
        try:
            existing = repo.get(uid)
            if not existing or existing.get("org_id") != org_id:
                results.append({"id": uid, "ok": False, "error": "نەدۆزرایەوە"})
                continue
            if data.action in ("suspend", "archive"):
                _guard_self(user["id"], uid, "کرداری بەکۆمەڵ")
                _guard_last_admin(org_id, uid)
            if data.action == "suspend":
                repo.update(uid, {"status": STATUS_SUSPENDED, "is_active": False})
            elif data.action == "activate":
                repo.update(uid, {"status": STATUS_ACTIVE, "is_active": True})
            elif data.action == "archive":
                repo.update(uid, {"status": STATUS_ARCHIVED, "is_active": False})
            elif data.action == "assign_role":
                if not data.role_id:
                    raise HTTPException(400, "role_id پێویستە")
                _validate_role_ids(org_id, [data.role_id])
                current = _get_user_role_ids(org_id, uid)
                if data.role_id not in current:
                    current.append(data.role_id)
                _set_user_roles(org_id, uid, current, user["id"])
            else:
                raise HTTPException(400, f"کرداری نەناسراو: {data.action}")
            results.append({"id": uid, "ok": True})
        except HTTPException as e:
            results.append({"id": uid, "ok": False, "error": e.detail})
        except Exception as e:  # boundary
            results.append({"id": uid, "ok": False, "error": str(e)})
    return {"results": results, "total": len(results), "ok": sum(1 for r in results if r["ok"])}
