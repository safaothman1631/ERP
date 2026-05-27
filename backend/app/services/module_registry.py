"""Module key registry — maps API path prefixes to logical ERP modules."""
from __future__ import annotations

from typing import Optional

# Mirrors frontend ALWAYS_ON in industries.ts
ALWAYS_ON = frozenset({"accounting", "banking"})

# Longest-prefix wins when resolving a request path to a module.
MODULE_PREFIXES: dict[str, tuple[str, ...]] = {
    "sales": (
        "/api/invoices",
        "/api/quotes",
        "/api/sales-orders",
        "/api/credit-notes",
        "/api/recurring-invoices",
        "/api/payment-links",
        "/api/returns",
        "/api/payments-received",
    ),
    "purchase": (
        "/api/bills",
        "/api/purchase-orders",
        "/api/vendor-credits",
        "/api/expenses",
        "/api/recurring-bills",
        "/api/expense-claims",
        "/api/payments-made",
    ),
    "inventory": (
        "/api/inventory",
        "/api/items",
        "/api/locations",
        "/api/shipments",
        "/api/challans",
    ),
    "pos": ("/api/pos", "/api/restaurant"),
    "manufacturing": ("/api/manufacturing",),
    "crm": ("/api/crm", "/api/marketing"),
    "hr": ("/api/hr", "/api/payroll", "/api/hr-extended"),
    "projects": ("/api/projects",),
    "assets": ("/api/fixed-assets",),
    "accounting": (
        "/api/accounts",
        "/api/journals",
        "/api/fiscal",
        "/api/taxes",
        "/api/reports",
        "/api/analytic",
        "/api/budgets",
        "/api/currency-rates",
        "/api/revaluations",
        "/api/cashflow-forecast",
        "/api/customer-statements",
    ),
    "banking": ("/api/banking",),
    "einvoice": ("/api/einvoice",),
    "whatsapp": ("/api/whatsapp",),
    "ocr": ("/api/ocr",),
    "l10n_iq": ("/api/l10n",),
}

# Paths that bypass module gate (auth, onboarding, platform, health)
SKIP_GATE_PREFIXES: tuple[str, ...] = (
    "/api/auth",
    "/api/onboarding",
    "/api/platform",
    "/api/health",
    "/api/system/health",
    "/api/chatter",
    "/api/users",
    "/api/rbac",
    "/api/dashboard",
    "/api/privacy",
    "/api/feature-flags",
    "/api/import",
    "/api/export",
    "/api/trash",
    "/api/audit",
    "/api/comments",
    "/api/attachments",
    "/api/system",
    "/api/companies",
    "/api/contacts",
    "/api/migration",
    "/api/jobs",
    "/api/storefront",
    "/api/ecommerce",
    "/api/iraq-payments",
)

# Flatten for fast lookup: prefix → module (sorted longest first at import)
_PREFIX_TO_MODULE: list[tuple[str, str]] = []


def _build_prefix_index() -> None:
    pairs: list[tuple[str, str]] = []
    for module, prefixes in MODULE_PREFIXES.items():
        for p in prefixes:
            pairs.append((p, module))
    pairs.sort(key=lambda x: len(x[0]), reverse=True)
    _PREFIX_TO_MODULE.clear()
    _PREFIX_TO_MODULE.extend(pairs)


_build_prefix_index()


def module_for_path(path: str) -> Optional[str]:
    """Return the module key guarding this API path, or None if unmapped / skipped."""
    if not path.startswith("/api/"):
        return None
    for skip in SKIP_GATE_PREFIXES:
        if path == skip or path.startswith(skip + "/"):
            return None
    for prefix, module in _PREFIX_TO_MODULE:
        if path == prefix or path.startswith(prefix + "/"):
            return module
    return None


def all_module_keys() -> list[str]:
    return sorted(MODULE_PREFIXES.keys())
