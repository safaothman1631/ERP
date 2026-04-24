"""RBAC permission system - roles, permissions, and the require_perm dependency."""
from typing import Set
from fastapi import Depends, HTTPException, status
from app.services.auth import get_current_user


# ===== All available permissions =====
_MODULES = [
    "invoices", "quotes", "sales_orders", "credit_notes",
    "bills", "purchase_orders", "vendor_credits", "expenses",
    "contacts", "items", "inventory", "warehouses",
    "bank", "accounts", "journals", "taxes", "reports",
    "projects", "tasks", "timesheets", "assets",
    "hr", "hr.payroll", "hr.attendance", "hr.timeoff",
    "crm", "crm.leads",
    "pos", "marketing",
    "settings", "rbac", "audit",
]
_ACTIONS = ["create", "read", "update", "delete"]

ALL_PERMISSIONS: list = []
for m in _MODULES:
    for a in _ACTIONS:
        ALL_PERMISSIONS.append(f"{m}.{a}")
# Plus special meta permissions
ALL_PERMISSIONS += [
    "rbac.manage",       # create/edit roles
    "audit.view_all",    # see logs of other users
    "reports.export",
    "settings.billing",
    "org.manage",
    # POS-specific permissions
    "pos.view",          # view POS data
    "pos.manage",        # manage configs and sessions
    "pos.refund",        # create refunds
    "pos.discount",      # apply discounts
    "pos.force_close",   # force close sessions
    "pos.admin",         # full POS admin
]


# ===== Default roles =====
def _all_of(*modules: str) -> list:
    return [f"{m}.{a}" for m in modules for a in _ACTIONS]


DEFAULT_ROLES = {
    "admin": {
        "name": "Administrator",
        "name_ku": "بەڕێوەبەر",
        "permissions": ["*"],  # wildcard
    },
    "accountant": {
        "name": "Accountant",
        "name_ku": "ژمێریار",
        "permissions": _all_of(
            "invoices", "quotes", "sales_orders", "credit_notes",
            "bills", "purchase_orders", "vendor_credits", "expenses",
            "bank", "accounts", "journals", "taxes", "reports", "assets",
        ) + ["contacts.read", "items.read", "reports.export"],
    },
    "sales": {
        "name": "Sales",
        "name_ku": "فرۆشیار",
        "permissions": _all_of("crm", "crm.leads", "quotes", "sales_orders", "invoices")
                       + ["contacts.create", "contacts.read", "contacts.update", "items.read"],
    },
    "purchaser": {
        "name": "Purchaser",
        "name_ku": "کڕیار",
        "permissions": _all_of("purchase_orders", "vendor_credits", "bills", "expenses")
                       + ["contacts.read", "contacts.create", "items.read", "inventory.read"],
    },
    "inventory": {
        "name": "Inventory Manager",
        "name_ku": "بەڕێوەبەری مەخزەن",
        "permissions": _all_of("inventory", "warehouses", "items"),
    },
    "hr_manager": {
        "name": "HR Manager",
        "name_ku": "بەڕێوەبەری HR",
        "permissions": _all_of("hr", "hr.payroll", "hr.attendance", "hr.timeoff"),
    },
    "hr_employee": {
        "name": "Employee (Self-service)",
        "name_ku": "کارمەند",
        "permissions": ["hr.read", "hr.timeoff.create", "hr.timeoff.read", "hr.attendance.read"],
    },
    "project_manager": {
        "name": "Project Manager",
        "name_ku": "بەڕێوەبەری پرۆژە",
        "permissions": _all_of("projects", "tasks", "timesheets"),
    },
    "cashier": {
        "name": "Cashier (POS)",
        "name_ku": "خەزنەدار",
        "permissions": _all_of("pos") + ["items.read", "contacts.read", "contacts.create"],
    },
    "pos_cashier": {
        "name": "POS Cashier",
        "name_ku": "کاشێری فرۆشگا",
        "permissions": ["pos.view", "pos.create", "pos.read"] + ["items.read", "contacts.read"],
    },
    "pos_manager": {
        "name": "POS Manager",
        "name_ku": "بەڕێوەبەری فرۆشگا",
        "permissions": ["pos.view", "pos.manage", "pos.refund", "pos.discount"] + _all_of("pos") + ["items.read", "contacts.read", "contacts.create"],
    },
    "pos_admin": {
        "name": "POS Administrator",
        "name_ku": "بەڕێوەبەری گشتی فرۆشگا",
        "permissions": ["pos.admin", "pos.force_close", "pos.manage", "pos.refund", "pos.discount"] + _all_of("pos") + ["items.read", "contacts.read", "contacts.create", "contacts.update"],
    },
    "viewer": {
        "name": "Viewer (Read-only)",
        "name_ku": "بینەر",
        "permissions": [f"{m}.read" for m in _MODULES],
    },
}


def get_user_permissions(user: dict) -> Set[str]:
    """Resolve the full permission set of a user, combining legacy `role` and RBAC assignments."""
    # Legacy: user["role"] == "admin" means everything
    legacy_role = user.get("role")
    if legacy_role == "admin":
        return {"*"}

    perms: Set[str] = set()

    # Legacy mapping
    if legacy_role and legacy_role in DEFAULT_ROLES:
        for p in DEFAULT_ROLES[legacy_role]["permissions"]:
            perms.add(p)

    # New RBAC: user_roles → roles
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
            for a in assignments:
                rid = a.get("role_id", "")
                if rid.startswith("default:"):
                    code = rid.split(":", 1)[1]
                    info = DEFAULT_ROLES.get(code)
                    if info:
                        for p in info["permissions"]:
                            perms.add(p)
                else:
                    role = role_repo.get(rid)
                    if role:
                        for p in role.get("permissions", []):
                            perms.add(p)
    except Exception:
        # Do not block requests if RBAC tables not yet initialised
        pass

    return perms


def user_has_perm(user: dict, code: str) -> bool:
    perms = get_user_permissions(user)
    if "*" in perms or code in perms:
        return True
    # Wildcard module: "invoices.*"
    module = code.split(".", 1)[0]
    if f"{module}.*" in perms:
        return True
    return False


def require_perm(code: str):
    """FastAPI dependency to enforce a permission code."""
    def _dep(user: dict = Depends(get_current_user)):
        if not user_has_perm(user, code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"دەسەڵات نییە: {code}",
            )
        return user
    return _dep
