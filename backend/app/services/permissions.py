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
    "hr", "payroll", "hr.payroll", "hr.attendance", "hr.timeoff",
    "manufacturing", "crm", "crm.leads",
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
    "audit.read",
    "reports.export",
    "reports.write",
    "settings.billing",
    "settings.numbering",
    "settings.fiscal",
    "org.manage",
    "privacy.export",
    # SF2 GDPR/PDPL data-rights (T-SF.2.22): tenant-admin self-service erasure.
    # ``privacy.export`` (above) already gates the data-export request; erasure
    # is a strictly more dangerous action so it carries its own code.
    "privacy.erasure",
    # Simplified read/write/delete aliases (Phase 2 RBAC sweep)
    "bank.write", "hr.write", "payroll.write",
    "manufacturing.write", "crm.write", "projects.write",
    # Account workflow permissions
    "accounts.fx_revalue", "accounts.budget", "accounts.close_fy",
    "accounts.post_je", "accounts.reverse_je",
    "inventory.shipment",
    # POS-specific permissions
    "pos.view",          # view POS data
    "pos.manage",        # manage configs and sessions
    "pos.refund",        # create refunds
    "pos.discount",      # apply discounts
    "pos.force_close",   # force close sessions
    "pos.admin",         # full POS admin
    "purchase.receive_shortcut",  # mark PO received without GRN
    "api_keys.manage",   # Pool 3.6: create/list/revoke public API keys
    # Module licensing
    "platform.manage",
    "modules.request",
    "modules.approve",
    "modules.view",
    # Quick-create entities (launch-readiness § R2) — codes match the
    # frontend quickCreateRegistry so client gating and server enforcement agree.
    "expenses.create_category",
    "equipment.create_category",
    "currencies.create",
    "tags.create",
    "payments.create_method",
    "teams.create",
    "subscriptions.create_plan",
    "bank_accounts.create",
    "locations.create",
    # SaaS billing (launch-readiness § R5) — tenant-side actions on their own
    # subscription. ``settings.billing`` already exists above and is the
    # required code for change_plan/cancel/restart; super-admin endpoints in
    # ``saas_admin.py`` bypass require_perm via _require_platform_admin.
    "saas_billing.read",
    "saas_billing.write",
]

# write/create/update and module aliases used by user_has_perm
_ACTION_ALIASES = {
    "write": {"write", "create", "update"},
    "read": {"read"},
    "delete": {"delete"},
    "create": {"create", "write"},
    "update": {"update", "write"},
}
_MODULE_ALIASES = {
    "payroll": {"payroll", "hr.payroll"},
    "hr.payroll": {"payroll", "hr.payroll"},
    "manufacturing": {"manufacturing", "inventory"},
    "inventory": {"manufacturing", "inventory"},
}


# ===== Default roles =====
def _all_of(*modules: str) -> list:
    return [f"{m}.{a}" for m in modules for a in _ACTIONS]


DEFAULT_ROLES = {
    "admin": {
        "name": "Administrator",
        "name_ku": "بەڕێوەبەر",
        "permissions": ["*"],  # wildcard
    },
    "owner": {
        "name": "Owner",
        "name_ku": "خاوەن",
        "permissions": ["*"],
    },
    "super_admin": {
        "name": "Super Administrator",
        "name_ku": "سوپەر ئادمین",
        "permissions": ["*"],
    },
    "platform_admin": {
        "name": "Platform Administrator",
        "name_ku": "بەڕێوەبەری پلاتفۆرم",
        "permissions": ["platform.manage", "modules.approve", "modules.view"],
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
        "permissions": _all_of("inventory", "warehouses", "items", "manufacturing"),
    },
    "hr_manager": {
        "name": "HR Manager",
        "name_ku": "بەڕێوەبەری HR",
        "permissions": _all_of("hr", "payroll", "hr.payroll", "hr.attendance", "hr.timeoff"),
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
    # Legacy: admin/owner means everything
    legacy_role = user.get("role")
    if legacy_role in ("admin", "owner", "super_admin"):
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


def _expand_perm_codes(code: str) -> Set[str]:
    """Return permission codes that satisfy the requested code."""
    if "." not in code:
        return {code}
    module, action = code.rsplit(".", 1)
    modules = _MODULE_ALIASES.get(module, {module})
    actions = _ACTION_ALIASES.get(action, {action})
    return {f"{m}.{a}" for m in modules for a in actions}


def user_has_perm(user: dict, code: str) -> bool:
    perms = get_user_permissions(user)
    if "*" in perms:
        return True
    for candidate in _expand_perm_codes(code):
        if candidate in perms:
            return True
        module = candidate.split(".", 1)[0]
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
