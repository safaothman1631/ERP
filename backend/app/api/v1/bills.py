"""
/api/v1/bills — Bills resource with cursor-based pagination.
"""

from fastapi import APIRouter, Depends

from app.api.v1.errors import not_found
from app.api.v1.filtering import FilterParams, SortParams
from app.api.v1.pagination import PaginationParams, paginate_list
from app.api.v1.schemas import CursorPageResponse
from app.firestore.bills import BillRepository
from app.schemas.schemas import BillResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/bills", tags=["v1 / Bills"])


@router.get(
    "",
    response_model=CursorPageResponse[BillResponse],
    summary="لیستی پسووڵەکان",
)
def list_bills_v1(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    user: dict = Depends(get_current_user),
):
    """**GET /api/v1/bills**"""
    repo = BillRepository(user["org_id"])
    repo_filters = filters.to_repo_filters(date_field="date")
    items, total = repo.list(
        filters=repo_filters,
        order_by=sort.order_by or "date",
        order_dir=sort.order_dir or "DESCENDING",
        limit=params.limit + 1,
        start_after=params.doc_id_after,
    )
    items = filters.apply_search(items, ["bill_number", "reference", "vendor_bill_number"])
    return paginate_list(items, params, total=total, sort_field=sort.order_by or "date")


@router.get(
    "/{bill_id}",
    response_model=BillResponse,
    summary="وەرگرتنی پسووڵە",
    responses={404: {"model": None, "description": "پسووڵە نەدۆزرایەوە"}},
)
def get_bill_v1(
    bill_id: str,
    user: dict = Depends(get_current_user),
):
    """**GET /api/v1/bills/{bill_id}**"""
    repo = BillRepository(user["org_id"])
    bill = repo.get_with_lines(bill_id)
    if not bill or bill.get("org_id") != user["org_id"]:
        return not_found("Bill", bill_id, f"/api/v1/bills/{bill_id}")
    return bill
