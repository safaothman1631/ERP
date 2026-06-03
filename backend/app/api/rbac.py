"""RBAC - Roles and Permissions"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from app.services.auth import get_current_user
from app.services.permissions import require_perm, ALL_PERMISSIONS, DEFAULT_ROLES
from app.services.report_streams import collect_stream
from app.firestore.base import BaseRepository


class RoleRepository(BaseRepository):
    collection_name = "roles"


class UserRoleRepository(BaseRepository):
    collection_name = "user_roles"


router = APIRouter(prefix="/api/rbac", tags=["RBAC"])


def _unique_values(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        if not item or item in seen:
            continue
        seen.add(item)
        result.append(item)
    return result


def _dedupe_roles(roles: list[dict]) -> list[dict]:
    seen_ids: set[str] = set()
    seen_codes: set[str] = set()
    unique: list[dict] = []
    for role in roles:
        role_id = role.get("id")
        code = role.get("code")
        if role_id and role_id in seen_ids:
            continue
        if code and code in seen_codes:
            continue
        if role_id:
            seen_ids.add(role_id)
        if code:
            seen_codes.add(code)
        unique.append(role)
    return unique


def _role_code_in_use(repo: RoleRepository, code: str, exclude_id: str | None = None) -> bool:
    roles, _ = repo.list(limit=1000)
    for role in roles:
        if exclude_id and role.get("id") == exclude_id:
            continue
        if role.get("code") == code:
            return True
    return False


@router.get("/permissions")
def list_permissions(user: dict = Depends(get_current_user)):
    """List all available permission codes."""
    return {"permissions": ALL_PERMISSIONS, "count": len(ALL_PERMISSIONS)}


@router.get("/roles")
def list_roles(user: dict = Depends(get_current_user)):
    repo = RoleRepository(user["org_id"])
    roles, _ = repo.list(limit=500)
    roles = _dedupe_roles(roles)
    # Include default roles if not yet customized
    existing_codes = {r.get("code") for r in roles}
    for code, info in DEFAULT_ROLES.items():
        if code not in existing_codes:
            roles.append({
                "id": f"default:{code}",
                "code": code,
                "name": info["name"],
                "name_ku": info.get("name_ku", info["name"]),
                "permissions": info["permissions"],
                "is_default": True,
                "is_system": True,
            })
    return _dedupe_roles(roles)


# ── Privilege-escalation guards ─────────────────────────────────────────────
# An rbac.manage holder must not be able to (a) put permissions on a role that
# they do not themselves hold, nor (b) assign the privileged default roles.
# Owner/admin/super_admin resolve to the "*" wildcard and may grant anything.
_PRIVILEGED_DEFAULT_ROLES = {"default:owner", "default:admin", "default:super_admin"}


def _assert_can_grant_permissions(user: dict, requested) -> None:
    from app.services.permissions import get_user_permissions
    requested = set(requested or [])
    if not requested:
        return
    held = get_user_permissions(user) or set()
    if "*" in held:
        return
    missing = requested - held
    if missing:
        raise HTTPException(403, f"Cannot grant permissions you do not hold: {sorted(missing)[:10]}")


@router.post("/roles", dependencies=[Depends(require_perm("rbac.manage"))])
def create_role(data: dict, user: dict = Depends(get_current_user)):
    _assert_can_grant_permissions(user, data.get("permissions", []))
    repo = RoleRepository(user["org_id"])
    code = (data.get("code") or "").strip()
    if not code:
        raise HTTPException(400, "Role code is required")
    if _role_code_in_use(repo, code):
        raise HTTPException(400, "Role code already exists")
    role = repo.create({
        "id": str(uuid.uuid4()),
        "code": code,
        "name": data.get("name"),
        "name_ku": data.get("name_ku"),
        "permissions": data.get("permissions", []),
        "is_system": False,
    })
    return role


@router.put("/roles/{role_id}", dependencies=[Depends(require_perm("rbac.manage"))])
def update_role(role_id: str, data: dict, user: dict = Depends(get_current_user)):
    if role_id.startswith("default:"):
        raise HTTPException(400, "Cannot modify default role. Create a copy instead.")
    repo = RoleRepository(user["org_id"])
    existing = repo.get(role_id)
    if not existing:
        raise HTTPException(404, "Role not found")
    _assert_can_grant_permissions(user, data.get("permissions", []))
    next_code = (data.get("code") or existing.get("code") or "").strip()
    if not next_code:
        raise HTTPException(400, "Role code is required")
    if _role_code_in_use(repo, next_code, exclude_id=role_id):
        raise HTTPException(400, "Role code already exists")
    data["code"] = next_code
    updated = repo.update(role_id, data)
    return updated


@router.delete("/roles/{role_id}", dependencies=[Depends(require_perm("rbac.manage"))])
def delete_role(role_id: str, user: dict = Depends(get_current_user)):
    if role_id.startswith("default:"):
        raise HTTPException(400, "Cannot delete default role")
    repo = RoleRepository(user["org_id"])
    repo.delete(role_id)
    return {"success": True}


@router.get("/users")
def list_org_users(user: dict = Depends(get_current_user)):
    """List all users in the org with their assigned role codes (for RBAC UI)."""
    from app.firestore.users import UserRepository
    u_repo = UserRepository(user["org_id"])
    ur_repo = UserRoleRepository(user["org_id"])
    r_repo = RoleRepository(user["org_id"])

    users, _ = u_repo.list(limit=500)
    assignments = collect_stream(ur_repo, max_docs=5000)
    custom_roles, _ = r_repo.list(limit=500)
    custom_by_id = {r["id"]: r for r in custom_roles}

    # Group assignments by user_id
    by_user: dict = {}
    for a in assignments:
        by_user.setdefault(a.get("user_id"), []).append(a.get("role_id"))

    result = []
    for u in users:
        role_ids = _unique_values(by_user.get(u["id"], []))
        role_labels = []
        seen_role_ids: set[str] = set()
        for rid in role_ids:
            if rid in seen_role_ids:
                continue
            seen_role_ids.add(rid)
            if rid and rid.startswith("default:"):
                code = rid.split(":", 1)[1]
                info = DEFAULT_ROLES.get(code)
                role_labels.append({"id": rid, "code": code, "name": info["name"] if info else code})
            elif rid in custom_by_id:
                r = custom_by_id[rid]
                role_labels.append({"id": rid, "code": r.get("code"), "name": r.get("name")})
        result.append({
            "id": u["id"],
            "email": u.get("email"),
            "full_name": u.get("full_name") or u.get("name"),
            "legacy_role": u.get("role"),
            "is_active": u.get("is_active", True),
            "assigned_roles": role_labels,
        })
    return result


@router.get("/users/{user_id}/roles")
def get_user_roles(user_id: str, user: dict = Depends(get_current_user)):
    repo = UserRoleRepository(user["org_id"])
    items, _ = repo.list(
        filters=[{"field": "user_id", "op": "==", "value": user_id}],
        limit=100,
    )
    return items


@router.put("/users/{user_id}/roles", dependencies=[Depends(require_perm("rbac.manage"))])
def set_user_roles(user_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Replace user's roles with the provided list."""
    role_ids = _unique_values(data.get("role_ids", []))
    # Privilege guard: only a full-access actor ("*") may assign the privileged
    # default roles — otherwise an rbac.manage holder could grant themselves owner.
    from app.services.permissions import get_user_permissions
    if "*" not in (get_user_permissions(user) or set()):
        blocked = [rid for rid in role_ids if rid in _PRIVILEGED_DEFAULT_ROLES]
        if blocked:
            raise HTTPException(403, f"Cannot assign privileged role(s): {blocked}")
    repo = UserRoleRepository(user["org_id"])
    # Remove existing
    existing, _ = repo.list(
        filters=[{"field": "user_id", "op": "==", "value": user_id}],
        limit=1000,
    )
    for item in existing:
        repo.delete(item["id"])
    # Create new
    created = []
    for rid in role_ids:
        created.append(repo.create({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "role_id": rid,
        }))
    return {"success": True, "roles_assigned": len(created)}


@router.get("/me/permissions")
def my_permissions(user: dict = Depends(get_current_user)):
    """Return the effective permission set for the current user."""
    from app.services.permissions import get_user_permissions
    perms = get_user_permissions(user)
    return {"user_id": user["id"], "permissions": sorted(perms), "role": user.get("role")}


# Persona hints aligned with frontend roleThemes / rolePersonaRegistry
_ROLE_PERSONA: dict[str, dict] = {
    "owner": {"theme_id": "executive", "default_route": "/dashboard", "label_key": "roles.owner"},
    "admin": {"theme_id": "administrator", "default_route": "/dashboard", "label_key": "roles.admin"},
    "manager": {"theme_id": "manager", "default_route": "/dashboard", "label_key": "roles.manager"},
    "accountant": {"theme_id": "finance", "default_route": "/dashboard", "label_key": "roles.accountant"},
    "sales": {"theme_id": "sales", "default_route": "/crm/leads", "label_key": "roles.sales"},
    "sales_rep": {"theme_id": "sales", "default_route": "/crm/leads", "label_key": "roles.sales_rep"},
    "purchaser": {"theme_id": "purchase", "default_route": "/purchase-orders", "label_key": "roles.purchaser"},
    "inventory": {"theme_id": "inventory", "default_route": "/inventory", "label_key": "roles.inventory"},
    "inventory_manager": {"theme_id": "inventory", "default_route": "/inventory", "label_key": "roles.inventory"},
    "cashier": {"theme_id": "pos", "default_route": "/pos", "label_key": "roles.cashier"},
    "pos_cashier": {"theme_id": "pos", "default_route": "/pos", "label_key": "roles.pos_cashier"},
    "hr": {"theme_id": "hr", "default_route": "/hr", "label_key": "roles.hr"},
    "hr_manager": {"theme_id": "hr", "default_route": "/hr", "label_key": "roles.hr_manager"},
    "viewer": {"theme_id": "readonly", "default_route": "/dashboard", "label_key": "roles.viewer"},
    "user": {"theme_id": "personal", "default_route": "/dashboard", "label_key": "roles.user"},
    "super_admin": {"theme_id": "administrator", "default_route": "/platform", "label_key": "roles.platform_admin"},
}


@router.get("/me/summary")
def my_role_summary(user: dict = Depends(get_current_user)):
    """Role UX summary for adaptive UI — persona, theme, default route."""
    from app.services.permissions import get_user_permissions
    role = (user.get("role") or "user").strip()
    perms = sorted(get_user_permissions(user))
    persona = _ROLE_PERSONA.get(role, _ROLE_PERSONA["user"]).copy()
    if role == "super_admin" or user.get("is_platform_admin"):
        persona = _ROLE_PERSONA["super_admin"].copy()
    return {
        "user_id": user["id"],
        "org_id": user.get("org_id"),
        "role": role,
        "permissions": perms,
        "persona": persona,
        "is_platform_admin": bool(user.get("is_platform_admin") or role == "super_admin"),
    }
