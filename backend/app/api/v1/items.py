"""
/api/v1/items — Items/Products resource with cursor-based pagination.

داواکاری ٧.٢، ٧.٣، ٧.٥، ٧.٦، ٧.٩، ٧.١٢
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.v1.errors import not_found
from app.api.v1.filtering import FilterParams, SortParams
from app.api.v1.pagination import PaginationParams, paginate_list
from app.api.v1.schemas import CursorPageResponse, MessageResponse
from app.firestore.items import ItemRepository
from app.schemas.schemas import ItemCreate, ItemResponse, ItemUpdate
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/items", tags=["v1 / Items"])


@router.get(
    "",
    response_model=CursorPageResponse[ItemResponse],
    summary="لیستی کاڵاکان",
    description="وەرگرتنی لیستی کاڵاکان لەگەڵ cursor-based pagination، filtering، و sorting",
)
def list_items_v1(
    item_type: Optional[str] = Query(default=None, max_length=20, description="جۆری کاڵا: goods، service"),
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    user: dict = Depends(get_current_user),
):
    """
    **GET /api/v1/items**

    وەرگرتنی لیستی کاڵاکان لەگەڵ:
    - cursor-based pagination (`cursor`, `limit`)
    - filtering (`item_type`, `search`)
    - sorting (`sort_by`, `sort_dir`)
    """
    repo = ItemRepository(user["org_id"])

    repo_filters = [{"field": "is_active", "op": "!=", "value": False}]
    if item_type:
        repo_filters.append({"field": "item_type", "op": "==", "value": item_type})

    items, total = repo.list(
        filters=repo_filters,
        order_by=sort.order_by or "name",
        order_dir=sort.order_dir or "ASCENDING",
        limit=params.limit + 1,
        start_after=params.doc_id_after,
    )

    items = filters.apply_search(items, ["name", "sku", "description"])

    return paginate_list(items, params, total=total, sort_field=sort.order_by or "name")


@router.get(
    "/{item_id}",
    response_model=ItemResponse,
    summary="وەرگرتنی کاڵا",
    responses={404: {"model": None, "description": "کاڵا نەدۆزرایەوە"}},
)
def get_item_v1(
    item_id: str,
    user: dict = Depends(get_current_user),
):
    """**GET /api/v1/items/{item_id}**"""
    repo = ItemRepository(user["org_id"])
    item = repo.get(item_id)
    if not item or item.get("org_id") != user["org_id"]:
        return not_found("Item", item_id, f"/api/v1/items/{item_id}")
    return item
