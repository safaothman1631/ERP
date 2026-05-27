"""
/api/v1/payments — Payments received resource with cursor-based pagination.
"""

from fastapi import APIRouter, Depends

from app.api.v1.errors import not_found
from app.api.v1.filtering import FilterParams, SortParams
from app.api.v1.pagination import PaginationParams, paginate_list
from app.api.v1.schemas import CursorPageResponse
from app.firestore.payments import PaymentReceivedRepository
from app.schemas.schemas import PaymentReceivedResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/payments", tags=["v1 / Payments"])


@router.get(
    "",
    response_model=CursorPageResponse[PaymentReceivedResponse],
    summary="لیستی پارە وەرگیراوەکان",
)
def list_payments_v1(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    user: dict = Depends(get_current_user),
):
    """**GET /api/v1/payments**"""
    repo = PaymentReceivedRepository(user["org_id"])
    repo_filters = filters.to_repo_filters(date_field="date")
    items, total = repo.list(
        filters=repo_filters,
        order_by=sort.order_by or "date",
        order_dir=sort.order_dir or "DESCENDING",
        limit=params.limit + 1,
        start_after=params.doc_id_after,
    )
    items = filters.apply_search(items, ["payment_number", "reference"])
    return paginate_list(items, params, total=total, sort_field=sort.order_by or "date")


@router.get(
    "/{payment_id}",
    response_model=PaymentReceivedResponse,
    summary="وەرگرتنی پارە وەرگیراو",
    responses={404: {"model": None, "description": "پارەدان نەدۆزرایەوە"}},
)
def get_payment_v1(
    payment_id: str,
    user: dict = Depends(get_current_user),
):
    """**GET /api/v1/payments/{payment_id}**"""
    repo = PaymentReceivedRepository(user["org_id"])
    payment = repo.get(payment_id)
    if not payment or payment.get("org_id") != user["org_id"]:
        return not_found("Payment", payment_id, f"/api/v1/payments/{payment_id}")
    return payment
