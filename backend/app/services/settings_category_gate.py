"""Category-level module and permission guards for settings bags."""
from __future__ import annotations

from typing import Iterable

from fastapi import HTTPException

from app.services.module_gate import is_module_enabled
from app.services.module_registry import ALWAYS_ON
from app.services.org_license import is_license_valid
from app.services.permissions import user_has_perm

CategoryModules = str | tuple[str, ...]

# Settings category -> required module(s). Tuple means OR semantics.
CATEGORY_MODULE: dict[str, CategoryModules] = {
    "sales": "sales",
    "crm": "crm",
    "purchases": "purchase",
    "inventory": "inventory",
    "mrp": "manufacturing",
    "pos": "pos",
    "hr": "hr",
    "payroll": "hr",
    "projects": "projects",
    "helpdesk": "ext.helpdesk",
    "ecommerce": "ext.subscriptions",
    "marketing": ("crm", "sales"),
    "fiscal": "accounting",
    "budgets": "accounting",
    "taxes": "accounting",
    "banking": "banking",
    "currencies": "accounting",
    "payment_methods": ("sales", "pos"),
    "einvoice": "einvoice",
    "templates": "sales",
    "reminders": "sales",
    "workflows": ("sales", "purchase", "inventory", "manufacturing", "pos", "crm", "hr", "projects"),
    "approvals": ("sales", "purchase", "hr"),
    "documents": "ext.documents",
    "numbering": ("sales", "purchase", "inventory", "hr"),
    "sms_whatsapp": ("whatsapp", "ext.comms"),
    "mobile": "ext.mobile",
}

# Category-specific write permissions. Categories not listed fall back to settings.update.
CATEGORY_WRITE_PERM: dict[str, str] = {
    "organization": "org.manage",
    "users": "rbac.manage",
    "roles": "rbac.manage",
    "permissions": "rbac.manage",
    "fiscal": "settings.fiscal",
    "budgets": "accounts.budget",
    "taxes": "taxes.update",
    "banking": "bank.write",
    "numbering": "settings.numbering",
}

_MODULE_DEFAULT_CATEGORIES: dict[str, tuple[str, ...]] = {
    "sales": ("sales", "payment_methods"),
    "purchase": ("purchases",),
    "inventory": ("inventory",),
    "manufacturing": ("mrp",),
    "pos": ("pos", "payment_methods"),
    "crm": ("crm",),
    "hr": ("hr", "payroll"),
    "ext.documents": ("documents",),
    "whatsapp": ("sms_whatsapp",),
    "ext.comms": ("sms_whatsapp",),
    "ext.mobile": ("mobile",),
}

_CATEGORY_DEFAULT_GETTER: dict[str, str] = {
    "sales": "get_sales_settings",
    "purchases": "get_purchases_settings",
    "inventory": "get_inventory_settings",
    "mrp": "get_mrp_settings",
    "pos": "get_pos_settings",
    "hr": "get_hr_settings",
    "payroll": "get_payroll_settings",
    "crm": "get_crm_settings",
    "documents": "get_documents_settings",
    "mobile": "get_mobile_settings",
    "sms_whatsapp": "get_sms_whatsapp_settings",
    "payment_methods": "get_payment_methods_settings",
}


def _normalize_category(category: str | None) -> str:
    return (category or "").strip().lower().replace("-", "_")


def modules_for_category(category: str | None) -> tuple[str, ...]:
    value = CATEGORY_MODULE.get(_normalize_category(category))
    if not value:
        return ()
    if isinstance(value, str):
        return (value,)
    return tuple(value)


def category_write_permission(category: str | None) -> str | None:
    return CATEGORY_WRITE_PERM.get(_normalize_category(category))


def default_write_permission(category: str | None) -> str:
    return category_write_permission(category) or "settings.update"


# Categories that are read-only for all roles (activity log UI).
READ_ONLY_CATEGORIES: frozenset[str] = frozenset({"activity"})

# Specialist roles may GET settings for their primary module only.
SPECIALIST_ROLE_MODULE: dict[str, str] = {
    "sales": "sales",
    "purchaser": "purchase",
    "inventory": "inventory",
    "warehouse": "inventory",
    "pos_cashier": "pos",
}

ACCOUNTANT_READ_CATEGORIES: frozenset[str] = frozenset({
    "fiscal", "budgets", "taxes", "banking", "currencies",
})


def _category_matches_module(category: str | None, module: str) -> bool:
    cat = _normalize_category(category)
    mapped = CATEGORY_MODULE.get(cat)
    if mapped == module:
        return True
    if isinstance(mapped, tuple) and module in mapped:
        return True
    return cat in _MODULE_DEFAULT_CATEGORIES.get(module, ())


def is_read_only_category(category: str | None) -> bool:
    return _normalize_category(category) in READ_ONLY_CATEGORIES


def has_settings_write_access(user: dict, category: str | None = None) -> bool:
    if is_read_only_category(category):
        return False
    role = user.get("role", "")
    if role in ("admin", "owner"):
        return True
    if user_has_perm(user, "settings.update"):
        return True
    category_perm = category_write_permission(category)
    return bool(category_perm and user_has_perm(user, category_perm))


def has_settings_read_access(user: dict, category: str | None = None) -> bool:
    role = user.get("role", "")
    org_id = user.get("org_id", "")

    specialist_module = SPECIALIST_ROLE_MODULE.get(role)
    if specialist_module and _category_matches_module(category, specialist_module):
        if is_module_enabled(org_id, specialist_module):
            return True

    if role == "accountant" and _normalize_category(category) in ACCOUNTANT_READ_CATEGORIES:
        return True

    if role in ("admin", "owner", "manager"):
        return True
    if user_has_perm(user, "settings.read") or user_has_perm(user, "settings.update"):
        return True
    category_perm = category_write_permission(category)
    return bool(category_perm and user_has_perm(user, category_perm))


def require_module_for_category(org_id: str, category: str | None) -> None:
    """Raise 403 when category is module-bound and unavailable."""
    modules = modules_for_category(category)
    if not modules:
        return

    if not is_license_valid(org_id):
        gated = [m for m in modules if m not in ALWAYS_ON]
        if gated:
            raise HTTPException(
                status_code=403,
                detail={"code": "license_expired", "module": gated[0]},
            )

    for module in modules:
        if is_module_enabled(org_id, module):
            return

    detail: dict[str, object] = {"code": "module_disabled", "module": modules[0]}
    if len(modules) > 1:
        detail["modules"] = list(modules)
    raise HTTPException(status_code=403, detail=detail)


def seed_default_bags_for_modules(org_id: str, modules: Iterable[str]) -> list[str]:
    """Best-effort seeding of settings blobs for newly approved modules."""
    from app.firestore.system import SettingsRepository
    from app.services import settings_service as _settings_service

    repo = SettingsRepository(org_id)
    seeded: set[str] = set()

    for module in set(modules):
        categories = _MODULE_DEFAULT_CATEGORIES.get(module, ())
        for category in categories:
            getter_name = _CATEGORY_DEFAULT_GETTER.get(category)
            if not getter_name:
                continue
            existing, _ = repo.list(
                filters=[
                    {"field": "key", "op": "==", "value": "blob"},
                    {"field": "category", "op": "==", "value": category},
                ],
                limit=1,
            )
            if existing:
                continue
            getter = getattr(_settings_service, getter_name, None)
            if getter is None:
                continue
            defaults = getter(org_id)
            _settings_service.set_bag(org_id, category, defaults)
            seeded.add(category)

    return sorted(seeded)
