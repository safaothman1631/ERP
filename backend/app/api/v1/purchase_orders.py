"""
/api/v1/purchase-orders — Purchase orders resource with cursor-based pagination.
"""

from fastapi import APIRouter, Depends

from app.api.v1.errors import not_found
from app.api.v1.filtering import FilterParams, SortParams
from app.api.v1.pagination import PaginationParams, paginate_list
from app.api.v1.schemas import CursorPageResponse
from app.firestore.bills import PurchaseOrderRepository
from app.schemas.schemas import PurchaseOrderResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/purchase-orders", tags=["v1 / Purchase Orders"])


@router.get(
    "",
    response_model=CursorPageResponse[PurchaseOrderResponse],
    summary="لیستی داواکارییەکانی کڕین",
)
def list_purchase_orders_v1(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    user: dict = Depends(get_current_user),
):
    """**GET /api/v1/purchase-orders**"""
    repo = PurchaseOrderRepository(user["org_id"])
    repo_filters = filters.to_repo_filters(date_field="date")
    items, total = repo.list(
        filters=repo_filters,
        order_by=sort.order_by or "date",
        order_dir=sort.order_dir or "DESCENDING",
        limit=params.limit + 1,
        start_after=params.doc_id_after,
    )
    items = filters.apply_search(items, ["order_number", "reference"])
    return paginate_list(items, params, total=total, sort_field=sort.order_by or "date")


@router.get(
    "/{purchase_order_id}",
    response_model=PurchaseOrderResponse,
    summary="وەرگرتنی داواکاری کڕین",
    responses={404: {"model": None, "description": "داواکاری کڕین نەدۆزرایەوە"}},
)
def get_purchase_order_v1(
    purchase_order_id: str,
    user: dict = Depends(get_current_user),
):
    """**GET /api/v1/purchase-orders/{purchase_order_id}**"""
    repo = PurchaseOrderRepository(user["org_id"])
    po = repo.get_with_lines(purchase_order_id)
    if not po or po.get("org_id") != user["org_id"]:
        return not_found(
            "PurchaseOrder",
            purchase_order_id,
            f"/api/v1/purchase-orders/{purchase_order_id}",
        )
    return po
