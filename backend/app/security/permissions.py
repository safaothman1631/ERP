"""
Permission checking utilities for the ERP RBAC system.

Provides:
  - checkPermission(): pure function for checking if a role set grants access
  - ROLE_PERMISSIONS: flat map of role → permissions (for PBT and direct checks)
  - get_user_permissions(): resolves effective permissions for a user dict
  - user_has_perm(): boolean check for a single permission code
  - can_access_field(): field-level permission check (Requirement 14.6)
  - filter_record_fields(): strip restricted fields from a record

Requirements: 14.1, 14.4, 14.6, 14.7
"""
from __future__ import annotations

from typing import Set

from app.security.roles import (
    BUILT_IN_ROLES,
    FIELD_PERMISSIONS,
    _MODULES,
    _ACTIONS,
    resolve_inherited_permissions,
    can_access_field,
    filter_record_fields,
)

# Re-export field-level helpers so callers can import from either location
__all__ = [
    "checkPermission",
    "ROLE_PERMISSIONS",
    "ALL_PERMISSIONS",
    "get_user_permissions",
    "user_has_perm",
    "can_access_field",
    "filter_record_fields",
    "FIELD_PERMISSIONS",
]

# ─────────────────────────────────────────────────────────────────────────────
# Flat ROLE_PERMISSIONS map — used by PBT (Property 4) and direct checks
# Maps role_code → set of permission strings
# ─────────────────────────────────────────────────────────────────────────────

ROLE_PERMISSIONS: dict[str, list[str]] = {
    code: list(info["permissions"])
    for code, info in BUILT_IN_ROLES.items()
}

# ─────────────────────────────────────────────────────────────────────────────
# All available permission codes
# ─────────────────────────────────────────────────────────────────────────────

ALL_PERMISSIONS: list[str] = []
for _m in _MODULES:
    for _a in _ACTIONS:
        ALL_PERMISSIONS.append(f"{_m}.{_a}")

# Special meta-permissions
ALL_PERMISSIONS += [
    "rbac.manage",
    "audit.view_all",
    "reports.export",
    "settings.billing",
    "org.manage",
    "pos.view",
    "pos.manage",
    "pos.refund",
    "pos.discount",
    "pos.force_close",
    "pos.admin",
]


# ─────────────────────────────────────────────────────────────────────────────
# Core permission check — pure function (testable without FastAPI context)
# Property 4: can_access(u, r, a) ↔ ∃ role ∈ u.roles: permission(role, r, a) = true
# ─────────────────────────────────────────────────────────────────────────────

def checkPermission(roles: list[str], resource: str, action: str) -> bool:
    """Check whether any of the given roles grants access to resource+action.

    This is the core RBAC invariant (Property 4):
        can_access ↔ ∃ role ∈ roles: permission(role, resource, action) = true

    Args:
        roles: List of role codes assigned to the user.
        resource: The resource/module being accessed (e.g. 'invoices').
        action: The action being performed (e.g. 'create', 'read').

    Returns:
        True if any role grants the permission, False otherwise.
    """
    permission_code = f"{resource}.{action}"

    for role_code in roles:
        role_perms = ROLE_PERMISSIONS.get(role_code, [])

        # Wildcard — role grants everything
        if "*" in role_perms:
            return True

        # Exact match
        if permission_code in role_perms:
            return True

        # Module wildcard: "invoices.*"
        module_wildcard = f"{resource}.*"
        if module_wildcard in role_perms:
            return True

    return False


def _expand_permissions(raw_perms: list[str]) -> Set[str]:
    """Expand a permission list, resolving wildcards to concrete codes."""
    expanded: Set[str] = set()
    for p in raw_perms:
        if p == "*":
            # Grant all known permissions
            expanded.update(ALL_PERMISSIONS)
        elif p.endswith(".*"):
            # Module wildcard: expand to all actions for that module
            module = p[:-2]
            for action in _ACTIONS:
                expanded.add(f"{module}.{action}")
        else:
            expanded.add(p)
    return expanded


def get_user_permissions(user: dict) -> Set[str]:
    """Resolve the full effective permission set for a user.

    Combines:
    1. Legacy ``user.role`` field (backward compat)
    2. RBAC role assignments from Firestore (user_roles collection)
    3. Permission inheritance — custom roles inherit from parent roles (Req 14.7)

    Args:
        user: User dict from Firestore (must have 'id', 'org_id', 'role').

    Returns:
        Set of permission strings. Returns {'*'} for admin/super_admin.
    """
    legacy_role = user.get("role", "")

    # Admin shortcut — return wildcard set
    if legacy_role in ("admin", "super_admin"):
        return {"*"}

    perms: Set[str] = set()

    # 1. Legacy role mapping
    if legacy_role and legacy_role in BUILT_IN_ROLES:
        role_perms = BUILT_IN_ROLES[legacy_role]["permissions"]
        if "*" in role_perms:
            return {"*"}
        perms.update(_expand_permissions(role_perms))

    # 2. RBAC assignments from Firestore (with inheritance)
    try:
        from app.api.rbac import RoleRepository, UserRoleRepository
        org_id = user.get("org_id")
        if org_id:
            ur_repo = UserRoleRepository(org_id)
            role_repo = RoleRepository(org_id)
            assignments, _ = ur_repo.list(
                filters=[{"field": "user_id", "op": "==", "value": user["id"]}],
                limit=100,
            )

            # Build a map of custom roles by code for inheritance resolution
            custom_roles_raw, _ = role_repo.list(limit=500)
            custom_roles_by_code: dict[str, dict] = {
                r["code"]: r for r in custom_roles_raw if r.get("code")
            }

            for assignment in assignments:
                rid = assignment.get("role_id", "")
                if rid.startswith("default:"):
                    code = rid.split(":", 1)[1]
                    info = BUILT_IN_ROLES.get(code)
                    if info:
                        if "*" in info["permissions"]:
                            return {"*"}
                        perms.update(_expand_permissions(info["permissions"]))
                else:
                    role = role_repo.get(rid)
                    if role:
                        # Resolve with inheritance (Requirement 14.7)
                        parent_code = role.get("parent_role")
                        effective_perms = resolve_inherited_permissions(
                            role.get("permissions", []),
                            parent_code,
                            custom_roles_by_code,
                        )
                        if "*" in effective_perms:
                            return {"*"}
                        perms.update(_expand_permissions(effective_perms))
    except Exception:
        # Do not block requests if RBAC tables not yet initialised
        pass

    return perms


def user_has_perm(user: dict, code: str) -> bool:
    """Check whether a user has a specific permission code.

    Args:
        user: User dict (must have 'role', 'id', 'org_id').
        code: Permission code to check (e.g. 'invoices.create').

    Returns:
        True if the user has the permission, False otherwise.
    """
    perms = get_user_permissions(user)
    if "*" in perms or code in perms:
        return True
    # Module wildcard check
    module = code.split(".", 1)[0]
    if f"{module}.*" in perms:
        return True
    return False


def get_user_roles(user: dict) -> list[str]:
    """Return the list of role codes assigned to a user.

    Combines the legacy ``user.role`` field with RBAC assignments.

    Args:
        user: User dict from Firestore.

    Returns:
        List of role code strings.
    """
    roles: list[str] = []
    legacy_role = user.get("role", "")
    if legacy_role:
        roles.append(legacy_role)

    try:
        from app.api.rbac import RoleRepository, UserRoleRepository
        org_id = user.get("org_id")
        if org_id:
            ur_repo = UserRoleRepository(org_id)
            role_repo = RoleRepository(org_id)
            assignments, _ = ur_repo.list(
                filters=[{"field": "user_id", "op": "==", "value": user["id"]}],
                limit=100,
            )
            for assignment in assignments:
                rid = assignment.get("role_id", "")
                if rid.startswith("default:"):
                    code = rid.split(":", 1)[1]
                    if code not in roles:
                        roles.append(code)
                else:
                    role = role_repo.get(rid)
                    if role and role.get("code") and role["code"] not in roles:
                        roles.append(role["code"])
    except Exception:
        pass

    return roles
