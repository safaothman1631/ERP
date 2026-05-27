"""
/api/v1/sales-orders — Sales orders resource with cursor-based pagination.
"""

from fastapi import APIRouter, Depends

from app.api.v1.errors import not_found
from app.api.v1.filtering import FilterParams, SortParams
from app.api.v1.pagination import PaginationParams, paginate_list
from app.api.v1.schemas import CursorPageResponse
from app.firestore.invoices import SalesOrderRepository
from app.schemas.schemas import SalesOrderResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/sales-orders", tags=["v1 / Sales Orders"])


@router.get(
    "",
    response_model=CursorPageResponse[SalesOrderResponse],
    summary="لیستی داواکارییەکانی فرۆشتن",
)
def list_sales_orders_v1(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    user: dict = Depends(get_current_user),
):
    """**GET /api/v1/sales-orders**"""
    repo = SalesOrderRepository(user["org_id"])
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
    "/{sales_order_id}",
    response_model=SalesOrderResponse,
    summary="وەرگرتنی داواکاری فرۆشتن",
    responses={404: {"model": None, "description": "داواکاری فرۆشتن نەدۆزرایەوە"}},
)
def get_sales_order_v1(
    sales_order_id: str,
    user: dict = Depends(get_current_user),
):
    """**GET /api/v1/sales-orders/{sales_order_id}**"""
    repo = SalesOrderRepository(user["org_id"])
    so = repo.get_with_lines(sales_order_id)
    if not so or so.get("org_id") != user["org_id"]:
        return not_found(
            "SalesOrder",
            sales_order_id,
            f"/api/v1/sales-orders/{sales_order_id}",
        )
    return so
