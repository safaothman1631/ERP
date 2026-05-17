"""
/api/v1/accounts — Chart of Accounts resource with cursor-based pagination.

داواکاری ٧.٢، ٧.٣، ٧.٥، ٧.٦، ٧.٩، ٧.١٢
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.v1.errors import not_found
from app.api.v1.filtering import FilterParams, SortParams
from app.api.v1.pagination import PaginationParams, paginate_list
from app.api.v1.schemas import CursorPageResponse
from app.firestore.accounts import AccountRepository
from app.schemas.schemas import AccountCreate, AccountResponse
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/accounts", tags=["v1 / Accounts"])


@router.get(
    "",
    response_model=CursorPageResponse[AccountResponse],
    summary="لیستی ئەکاونتەکان",
    description="وەرگرتنی لیستی ئەکاونتەکان لەگەڵ cursor-based pagination، filtering، و sorting",
)
def list_accounts_v1(
    account_type: Optional[str] = Query(default=None, max_length=50, description="جۆری ئەکاونت"),
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    user: dict = Depends(get_current_user),
):
    """
    **GET /api/v1/accounts**

    وەرگرتنی لیستی ئەکاونتەکان لەگەڵ:
    - cursor-based pagination (`cursor`, `limit`)
    - filtering (`account_type`, `search`)
    - sorting (`sort_by`, `sort_dir`)
    """
    repo = AccountRepository(user["org_id"])

    repo_filters = [{"field": "is_active", "op": "!=", "value": False}]
    if account_type:
        repo_filters.append({"field": "account_type", "op": "==", "value": account_type})

    items, total = repo.list(
        filters=repo_filters,
        order_by=sort.order_by or "name",
        order_dir=sort.order_dir or "ASCENDING",
        limit=params.limit + 1,
        start_after=params.doc_id_after,
    )

    items = filters.apply_search(items, ["name", "name_ku", "code"])

    return paginate_list(items, params, total=total, sort_field=sort.order_by or "name")


@router.get(
    "/{account_id}",
    response_model=AccountResponse,
    summary="وەرگرتنی ئەکاونت",
    responses={404: {"model": None, "description": "ئەکاونت نەدۆزرایەوە"}},
)
def get_account_v1(
    account_id: str,
    user: dict = Depends(get_current_user),
):
    """**GET /api/v1/accounts/{account_id}**"""
    repo = AccountRepository(user["org_id"])
    account = repo.get(account_id)
    if not account or account.get("org_id") != user["org_id"]:
        return not_found("Account", account_id, f"/api/v1/accounts/{account_id}")
    return account
