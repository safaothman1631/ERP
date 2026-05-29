"""Quick-create endpoints (launch-readiness spec § R2).

Backs the entity slugs declared in the frontend ``quickCreateRegistry.ts`` that
had no production backend route — each previously surfaced a 404 the first time
a user opened the quick-create modal. Every endpoint here:

  * scopes writes to the caller's ``org_id`` (enforced inside the repository),
  * enforces RBAC via ``require_perm`` using the same code the registry declares,
  * returns ``201 Created`` with a ``Location`` header,
  * exposes a ``GET`` list for the registry's ``loadOptions``.

``Idempotency-Key`` and per-tenant rate limiting are applied globally by
``app.middleware.idempotency_http`` and ``RateLimitMiddleware`` — the new
prefixes are registered there.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response

from app.services.auth import get_current_user
from app.services.permissions import require_perm

from app.firestore.quick_create_repos import (
    BusinessLocationRepository,
    CurrencyRepository,
    EquipmentCategoryRepository,
    ExpenseCategoryRepository,
    PaymentMethodRepository,
    TagRepository,
    TeamRepository,
)
from app.firestore.banking import BankAccountRepository
from app.firestore.subscriptions import SubscriptionPlanRepository

from app.schemas.quick_create import (
    BankAccountQuickCreate,
    CurrencyCreate,
    EquipmentCategoryCreate,
    ExpenseCategoryCreate,
    LocationQuickCreate,
    PaymentMethodCreate,
    SubscriptionPlanQuickCreate,
    TagCreate,
    TeamCreate,
    _GATEWAY_TYPES,
)


def _new_id() -> str:
    return str(uuid.uuid4())


def _set_location(response: Response, base: str, doc_id: str) -> None:
    response.headers["Location"] = f"{base}/{doc_id}"


def _demote_existing_default(repo, *, scope_filters=None) -> None:
    """Flip any current ``is_default=True`` row to False (single-default invariant)."""
    filters = [{"field": "is_default", "op": "==", "value": True}]
    if scope_filters:
        filters.extend(scope_filters)
    existing, _ = repo.list(filters=filters, limit=50)
    for row in existing:
        repo.update(row["id"], {"is_default": False})


# ── Expense categories ───────────────────────────────────────────────────

expense_categories_router = APIRouter(
    prefix="/api/expense-categories", tags=["quick-create"]
)


@expense_categories_router.get("")
def list_expense_categories(user: dict = Depends(get_current_user)):
    repo = ExpenseCategoryRepository(user["org_id"])
    items, total = repo.list(
        filters=[{"field": "is_active", "op": "!=", "value": False}],
        order_by="name", order_dir="ASCENDING", limit=200,
    )
    return {"items": items, "total": total}


@expense_categories_router.post(
    "", status_code=201,
    dependencies=[Depends(require_perm("expenses.create_category"))],
)
def create_expense_category(
    data: ExpenseCategoryCreate,
    response: Response,
    user: dict = Depends(get_current_user),
):
    repo = ExpenseCategoryRepository(user["org_id"])
    rec = repo.create({"id": _new_id(), **data.model_dump()})
    _set_location(response, "/api/expense-categories", rec["id"])
    return rec


# ── Equipment categories ─────────────────────────────────────────────────

equipment_categories_router = APIRouter(
    prefix="/api/equipment-categories", tags=["quick-create"]
)


@equipment_categories_router.get("")
def list_equipment_categories(user: dict = Depends(get_current_user)):
    repo = EquipmentCategoryRepository(user["org_id"])
    items, total = repo.list(
        filters=[{"field": "is_active", "op": "!=", "value": False}],
        order_by="name", order_dir="ASCENDING", limit=200,
    )
    return {"items": items, "total": total}


@equipment_categories_router.post(
    "", status_code=201,
    dependencies=[Depends(require_perm("equipment.create_category"))],
)
def create_equipment_category(
    data: EquipmentCategoryCreate,
    response: Response,
    user: dict = Depends(get_current_user),
):
    repo = EquipmentCategoryRepository(user["org_id"])
    rec = repo.create({"id": _new_id(), **data.model_dump()})
    _set_location(response, "/api/equipment-categories", rec["id"])
    return rec


# ── Currencies ───────────────────────────────────────────────────────────

currencies_router = APIRouter(prefix="/api/currencies", tags=["quick-create"])


@currencies_router.get("")
def list_currencies(user: dict = Depends(get_current_user)):
    repo = CurrencyRepository(user["org_id"])
    items, total = repo.list(
        filters=[{"field": "is_active", "op": "!=", "value": False}],
        order_by="code", order_dir="ASCENDING", limit=200,
    )
    return {"items": items, "total": total}


@currencies_router.post(
    "", dependencies=[Depends(require_perm("currencies.create"))],
)
def create_currency(
    data: CurrencyCreate,
    response: Response,
    user: dict = Depends(get_current_user),
):
    """Idempotent upsert keyed by the uppercased ISO code (R2.11).

    Re-adding an existing code returns the existing record with 200 OK rather
    than creating a duplicate — the currency code is the document id.
    """
    repo = CurrencyRepository(user["org_id"])
    code_upper = data.code.upper()
    existing = repo.get(code_upper)
    if existing:
        response.status_code = 200
        _set_location(response, "/api/currencies", code_upper)
        return existing
    payload = data.model_dump()
    payload["code"] = code_upper
    payload["exchange_rate_to_base"] = float(payload["exchange_rate_to_base"])
    rec = repo.create({"id": code_upper, **payload})
    response.status_code = 201
    _set_location(response, "/api/currencies", code_upper)
    return rec


# ── Tags ─────────────────────────────────────────────────────────────────

tags_router = APIRouter(prefix="/api/tags", tags=["quick-create"])


@tags_router.get("")
def list_tags(user: dict = Depends(get_current_user)):
    repo = TagRepository(user["org_id"])
    items, total = repo.list(order_by="name", order_dir="ASCENDING", limit=200)
    return {"items": items, "total": total}


@tags_router.post("", dependencies=[Depends(require_perm("tags.create"))])
def create_tag(
    data: TagCreate,
    response: Response,
    user: dict = Depends(get_current_user),
):
    """``(scope, name)`` is unique per tenant; a collision returns the existing
    record with 200 OK — quick-create semantics favour idempotency (R2.12)."""
    repo = TagRepository(user["org_id"])
    dupes, _ = repo.list(
        filters=[
            {"field": "scope", "op": "==", "value": data.scope},
            {"field": "name", "op": "==", "value": data.name},
        ],
        limit=1,
    )
    if dupes:
        response.status_code = 200
        _set_location(response, "/api/tags", dupes[0]["id"])
        return dupes[0]
    rec = repo.create({"id": _new_id(), **data.model_dump()})
    response.status_code = 201
    _set_location(response, "/api/tags", rec["id"])
    return rec


# ── Payment methods ──────────────────────────────────────────────────────

payment_methods_router = APIRouter(
    prefix="/api/payment-methods", tags=["quick-create"]
)


@payment_methods_router.get("")
def list_payment_methods(user: dict = Depends(get_current_user)):
    repo = PaymentMethodRepository(user["org_id"])
    items, total = repo.list(
        filters=[{"field": "is_active", "op": "!=", "value": False}],
        order_by="name", order_dir="ASCENDING", limit=200,
    )
    return {"items": items, "total": total}


@payment_methods_router.post(
    "", status_code=201,
    dependencies=[Depends(require_perm("payments.create_method"))],
)
def create_payment_method(
    data: PaymentMethodCreate,
    response: Response,
    user: dict = Depends(get_current_user),
):
    repo = PaymentMethodRepository(user["org_id"])
    if data.is_default:
        _demote_existing_default(repo)
    payload = data.model_dump()
    payload["type"] = data.resolved_type()
    requires_gateway = payload["type"] in _GATEWAY_TYPES
    payload["requires_gateway_config"] = requires_gateway
    rec = repo.create({"id": _new_id(), **payload})
    rec["requires_gateway_config"] = requires_gateway
    _set_location(response, "/api/payment-methods", rec["id"])
    return rec


# ── Teams ────────────────────────────────────────────────────────────────

teams_router = APIRouter(prefix="/api/teams", tags=["quick-create"])


@teams_router.get("")
def list_teams(user: dict = Depends(get_current_user)):
    repo = TeamRepository(user["org_id"])
    items, total = repo.list(
        filters=[{"field": "is_active", "op": "!=", "value": False}],
        order_by="name", order_dir="ASCENDING", limit=200,
    )
    return {"items": items, "total": total}


@teams_router.post(
    "", status_code=201, dependencies=[Depends(require_perm("teams.create"))],
)
def create_team(
    data: TeamCreate,
    response: Response,
    user: dict = Depends(get_current_user),
):
    repo = TeamRepository(user["org_id"])
    payload = data.model_dump()
    # Accept either lead_id (registry) or manager_user_id (spec) as the lead.
    payload["lead_id"] = data.lead_id or data.manager_user_id
    rec = repo.create({"id": _new_id(), **payload})
    _set_location(response, "/api/teams", rec["id"])
    return rec


# ── Subscription plans (alias of /api/subscriptions/plans) ───────────────

subscription_plans_router = APIRouter(
    prefix="/api/subscription-plans", tags=["quick-create"]
)


@subscription_plans_router.get("")
def list_subscription_plans(user: dict = Depends(get_current_user)):
    repo = SubscriptionPlanRepository(user["org_id"])
    items, total = repo.list(order_by="name", order_dir="ASCENDING", limit=200)
    return {"items": items, "total": total}


@subscription_plans_router.post(
    "", status_code=201,
    dependencies=[Depends(require_perm("subscriptions.create_plan"))],
)
def create_subscription_plan(
    data: SubscriptionPlanQuickCreate,
    response: Response,
    user: dict = Depends(get_current_user),
):
    repo = SubscriptionPlanRepository(user["org_id"])
    payload = data.model_dump()
    payload["price"] = float(payload["price"])
    rec = repo.create({"id": _new_id(), **payload})
    _set_location(response, "/api/subscription-plans", rec["id"])
    return rec


# ── Bank accounts (alias of /api/banking/accounts) ───────────────────────

bank_accounts_router = APIRouter(
    prefix="/api/bank-accounts", tags=["quick-create"]
)


def _mask_account_number(number: str) -> str:
    if not number or len(number) <= 4:
        return number
    return "•" * (len(number) - 4) + number[-4:]


@bank_accounts_router.get("")
def list_bank_accounts(user: dict = Depends(get_current_user)):
    repo = BankAccountRepository(user["org_id"])
    items, total = repo.list(
        filters=[{"field": "is_active", "op": "!=", "value": False}],
        order_by="name", order_dir="ASCENDING", limit=200,
    )
    for it in items:
        if it.get("account_number"):
            it["account_number"] = _mask_account_number(it["account_number"])
    return {"items": items, "total": total}


@bank_accounts_router.post(
    "", status_code=201,
    dependencies=[Depends(require_perm("bank_accounts.create"))],
)
def create_bank_account(
    data: BankAccountQuickCreate,
    response: Response,
    user: dict = Depends(get_current_user),
):
    repo = BankAccountRepository(user["org_id"])
    payload = data.model_dump()
    payload["opening_balance"] = float(payload["opening_balance"])
    payload["current_balance"] = payload["opening_balance"]
    # Mirror to account_name for compatibility with /api/banking consumers.
    payload["account_name"] = data.name
    rec = repo.create({"id": _new_id(), **payload})
    rec["account_number"] = _mask_account_number(data.account_number)
    _set_location(response, "/api/bank-accounts", rec["id"])
    return rec


# ── Locations (business/operating locations) ─────────────────────────────

locations_qc_router = APIRouter(prefix="/api/locations", tags=["quick-create"])


@locations_qc_router.get("")
def list_locations(user: dict = Depends(get_current_user)):
    repo = BusinessLocationRepository(user["org_id"])
    items, total = repo.list(
        filters=[{"field": "is_active", "op": "!=", "value": False}],
        order_by="name", order_dir="ASCENDING", limit=200,
    )
    return {"items": items, "total": total}


@locations_qc_router.post(
    "", status_code=201,
    dependencies=[Depends(require_perm("locations.create"))],
)
def create_location(
    data: LocationQuickCreate,
    response: Response,
    user: dict = Depends(get_current_user),
):
    repo = BusinessLocationRepository(user["org_id"])
    if data.is_default:
        _demote_existing_default(repo)
    rec = repo.create({"id": _new_id(), **data.model_dump()})
    _set_location(response, "/api/locations", rec["id"])
    return rec


# Convenience: every router this module exposes, for bulk registration.
ALL_ROUTERS = [
    expense_categories_router,
    equipment_categories_router,
    currencies_router,
    tags_router,
    payment_methods_router,
    teams_router,
    subscription_plans_router,
    bank_accounts_router,
    locations_qc_router,
]
