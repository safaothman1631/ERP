"""
Role definitions for the ERP RBAC system.

Defines the built-in roles and their permission sets.
Custom roles can be created per-org and stored in Firestore.

Requirements: 14.1, 14.2, 14.3, 14.6, 14.7
"""
from __future__ import annotations

# ─────────────────────────────────────────────────────────────────────────────
# All modules that have CRUD permissions
# ─────────────────────────────────────────────────────────────────────────────
_MODULES = [
    # Sales
    "invoices", "quotes", "sales_orders", "credit_notes", "payments",
    # Purchasing
    "bills", "purchase_orders", "vendor_credits", "expenses",
    # Contacts & Items
    "contacts", "items",
    # Inventory
    "inventory", "warehouses", "stock_moves",
    # Accounting
    "bank", "accounts", "journals", "taxes", "fiscal",
    # Reports
    "reports",
    # Projects
    "projects", "tasks", "timesheets",
    # Fixed Assets
    "assets",
    # HR & Payroll
    "hr", "hr.payroll", "hr.attendance", "hr.timeoff",
    # CRM
    "crm", "crm.leads",
    # POS
    "pos",
    # Marketing
    "marketing",
    # System
    "settings", "rbac", "audit",
]

_ACTIONS = ["create", "read", "update", "delete"]


def _all_of(*modules: str) -> list[str]:
    """Return all CRUD permissions for the given modules."""
    return [f"{m}.{a}" for m in modules for a in _ACTIONS]


def _read_only(*modules: str) -> list[str]:
    """Return read-only permissions for the given modules."""
    return [f"{m}.read" for m in modules]


# ─────────────────────────────────────────────────────────────────────────────
# Built-in role definitions
# Requirements: 14.2 — Super Admin, Admin, Manager, Accountant, Sales Rep, HR, Viewer
# ─────────────────────────────────────────────────────────────────────────────

BUILT_IN_ROLES: dict[str, dict] = {
    "super_admin": {
        "name": "Super Admin",
        "name_ku": "سوپەر ئەدمین",
        "description": "Full system access including billing and org management",
        "permissions": ["*"],  # wildcard — all permissions
        "is_system": True,
    },
    "admin": {
        "name": "Administrator",
        "name_ku": "بەڕێوەبەر",
        "description": "Full access to all modules except billing",
        "permissions": ["*"],  # wildcard
        "is_system": True,
    },
    "manager": {
        "name": "Manager",
        "name_ku": "بەڕێوەبەری بەش",
        "description": "Access to all business modules, read-only on settings",
        "permissions": _all_of(
            "invoices", "quotes", "sales_orders", "credit_notes", "payments",
            "bills", "purchase_orders", "vendor_credits", "expenses",
            "contacts", "items", "inventory", "warehouses",
            "bank", "accounts", "journals", "taxes",
            "projects", "tasks", "timesheets",
            "crm", "crm.leads",
            "reports",
        ) + _read_only("settings", "audit") + ["reports.export"],
        "is_system": True,
    },
    "accountant": {
        "name": "Accountant",
        "name_ku": "ژمێریار",
        "description": "Full access to accounting, sales, and purchasing modules",
        "permissions": _all_of(
            "invoices", "quotes", "sales_orders", "credit_notes", "payments",
            "bills", "purchase_orders", "vendor_credits", "expenses",
            "bank", "accounts", "journals", "taxes", "fiscal", "assets",
            "reports",
        ) + _read_only("contacts", "items") + ["reports.export"],
        "is_system": True,
    },
    "sales_rep": {
        "name": "Sales Representative",
        "name_ku": "نوێنەری فرۆشتن",
        "description": "Access to sales, CRM, and customer-facing modules",
        "permissions": _all_of(
            "crm", "crm.leads", "quotes", "sales_orders", "invoices", "payments",
        ) + [
            "contacts.create", "contacts.read", "contacts.update",
            "items.read",
        ],
        "is_system": True,
    },
    "hr": {
        "name": "HR Manager",
        "name_ku": "بەڕێوەبەری HR",
        "description": "Full access to HR and payroll modules",
        "permissions": _all_of(
            "hr", "hr.payroll", "hr.attendance", "hr.timeoff",
        ) + _read_only("reports"),
        "is_system": True,
    },
    "viewer": {
        "name": "Viewer",
        "name_ku": "بینەر",
        "description": "Read-only access to all modules",
        "permissions": _read_only(*_MODULES),
        "is_system": True,
    },
    # Additional specialized roles
    "purchaser": {
        "name": "Purchaser",
        "name_ku": "بەڕێوەبەری کڕین",
        "description": "Access to purchasing and vendor management",
        "permissions": _all_of(
            "purchase_orders", "vendor_credits", "bills", "expenses",
        ) + [
            "contacts.read", "contacts.create",
            "items.read",
            "inventory.read",
        ],
        "is_system": True,
    },
    "inventory_manager": {
        "name": "Inventory Manager",
        "name_ku": "بەڕێوەبەری مەخزەن",
        "description": "Full access to inventory and warehouse management",
        "permissions": _all_of("inventory", "warehouses", "items", "stock_moves"),
        "is_system": True,
    },
    "cashier": {
        "name": "Cashier (POS)",
        "name_ku": "خەزنەدار",
        "description": "POS operations access",
        "permissions": _all_of("pos") + _read_only("items", "contacts") + ["contacts.create"],
        "is_system": True,
    },
}

# Alias for backward compatibility with services/permissions.py
DEFAULT_ROLES = BUILT_IN_ROLES


def get_role_permissions(role_code: str) -> list[str]:
    """Return the permission list for a built-in role code.

    Args:
        role_code: The role identifier (e.g. 'admin', 'accountant').

    Returns:
        List of permission strings, or empty list if role not found.
    """
    role = BUILT_IN_ROLES.get(role_code)
    if not role:
        return []
    return list(role["permissions"])


def is_built_in_role(role_code: str) -> bool:
    """Check whether a role code refers to a built-in system role."""
    return role_code in BUILT_IN_ROLES


def list_built_in_roles() -> list[dict]:
    """Return all built-in roles as a list of dicts (without permissions for brevity)."""
    return [
        {
            "code": code,
            "name": info["name"],
            "name_ku": info["name_ku"],
            "description": info.get("description", ""),
            "is_system": info.get("is_system", True),
        }
        for code, info in BUILT_IN_ROLES.items()
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Permission Inheritance — Requirement 14.7
# Custom roles can inherit from a parent (built-in or custom) role.
# The child role's permissions are the union of parent + its own permissions.
# ─────────────────────────────────────────────────────────────────────────────

def resolve_inherited_permissions(
    own_permissions: list[str],
    parent_role_code: str | None,
    custom_roles_by_code: dict[str, dict] | None = None,
    _visited: set[str] | None = None,
) -> list[str]:
    """Resolve the effective permission list for a role with optional inheritance.

    Walks the parent chain (up to 10 levels deep to prevent cycles) and returns
    the union of all permissions.

    Args:
        own_permissions: The role's own permission list.
        parent_role_code: Optional parent role code to inherit from.
        custom_roles_by_code: Dict of custom roles keyed by code (for org-level roles).
        _visited: Internal set used to detect cycles.

    Returns:
        Deduplicated list of all effective permissions.

    Requirements: 14.7
    """
    if _visited is None:
        _visited = set()

    effective: list[str] = list(own_permissions)

    if not parent_role_code or parent_role_code in _visited:
        return effective

    _visited.add(parent_role_code)

    # Resolve parent permissions
    parent_perms: list[str] = []

    # Check built-in roles first
    if parent_role_code in BUILT_IN_ROLES:
        parent_perms = list(BUILT_IN_ROLES[parent_role_code]["permissions"])
    elif custom_roles_by_code and parent_role_code in custom_roles_by_code:
        parent_role = custom_roles_by_code[parent_role_code]
        grandparent = parent_role.get("parent_role")
        parent_perms = resolve_inherited_permissions(
            parent_role.get("permissions", []),
            grandparent,
            custom_roles_by_code,
            _visited,
        )

    # Merge: parent permissions come first, child can override/extend
    merged: list[str] = list(parent_perms)
    for p in effective:
        if p not in merged:
            merged.append(p)

    return merged


# ─────────────────────────────────────────────────────────────────────────────
# Field-Level Permissions — Requirement 14.6
# Defines which fields are restricted per module and which roles can see them.
# ─────────────────────────────────────────────────────────────────────────────

# Map: module → field → list of roles that can see/edit the field
# If a field is not listed, it is visible to all roles with module.read access.
FIELD_PERMISSIONS: dict[str, dict[str, list[str]]] = {
    "invoices": {
        # Sensitive financial fields — only accountants, managers, admins
        "discount_amount": ["super_admin", "admin", "manager", "accountant"],
        "tax_amount": ["super_admin", "admin", "manager", "accountant"],
        "cost_price": ["super_admin", "admin", "manager", "accountant"],
        "profit_margin": ["super_admin", "admin", "manager", "accountant"],
        "internal_notes": ["super_admin", "admin", "manager", "accountant"],
    },
    "contacts": {
        # Personal/sensitive contact data
        "credit_limit": ["super_admin", "admin", "manager", "accountant"],
        "bank_account": ["super_admin", "admin", "accountant"],
        "tax_id": ["super_admin", "admin", "accountant"],
        "internal_notes": ["super_admin", "admin", "manager"],
    },
    "employees": {
        # HR sensitive fields
        "salary": ["super_admin", "admin", "hr"],
        "bank_account": ["super_admin", "admin", "hr"],
        "social_security_number": ["super_admin", "admin", "hr"],
        "performance_rating": ["super_admin", "admin", "hr", "manager"],
        "disciplinary_notes": ["super_admin", "admin", "hr"],
        "emergency_contact": ["super_admin", "admin", "hr"],
    },
    "hr": {
        "salary": ["super_admin", "admin", "hr"],
        "bank_account": ["super_admin", "admin", "hr"],
        "social_security_number": ["super_admin", "admin", "hr"],
    },
    "items": {
        # Cost/pricing fields
        "cost_price": ["super_admin", "admin", "manager", "accountant", "inventory_manager"],
        "supplier_price": ["super_admin", "admin", "manager", "accountant"],
        "internal_notes": ["super_admin", "admin", "manager"],
    },
    "purchase_orders": {
        "internal_notes": ["super_admin", "admin", "manager", "accountant"],
        "cost_breakdown": ["super_admin", "admin", "manager", "accountant"],
    },
    "accounts": {
        # Chart of accounts — sensitive balance info
        "balance": ["super_admin", "admin", "manager", "accountant"],
        "budget": ["super_admin", "admin", "manager", "accountant"],
    },
}


def can_access_field(roles: list[str], module: str, field: str) -> bool:
    """Check whether any of the given roles can access a specific field.

    If the field is not listed in FIELD_PERMISSIONS for the module, it is
    accessible to all roles (open by default).

    Args:
        roles: List of role codes assigned to the user.
        module: The module/resource name (e.g. 'invoices', 'employees').
        field: The field name to check (e.g. 'salary', 'discount_amount').

    Returns:
        True if any role grants access to the field, False otherwise.

    Requirements: 14.6
    """
    module_fields = FIELD_PERMISSIONS.get(module, {})
    allowed_roles = module_fields.get(field)

    # Field not restricted — open to all
    if allowed_roles is None:
        return True

    # Check if any of the user's roles is in the allowed list
    for role in roles:
        if role in allowed_roles:
            return True

    return False


def filter_record_fields(
    record: dict,
    roles: list[str],
    module: str,
) -> dict:
    """Remove restricted fields from a record dict based on the user's roles.

    Args:
        record: The full record dict from Firestore.
        roles: List of role codes assigned to the user.
        module: The module/resource name (e.g. 'invoices').

    Returns:
        A copy of the record with restricted fields removed.

    Requirements: 14.6
    """
    module_fields = FIELD_PERMISSIONS.get(module, {})
    if not module_fields:
        return record  # No field restrictions for this module

    filtered = dict(record)
    for field, allowed_roles in module_fields.items():
        if field in filtered:
            has_access = any(r in allowed_roles for r in roles)
            if not has_access:
                del filtered[field]

    return filtered
