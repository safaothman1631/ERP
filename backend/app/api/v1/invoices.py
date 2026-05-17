"""
/api/v1/invoices — Invoices resource with cursor-based pagination.

داواکاری ٧.٢، ٧.٣، ٧.٥، ٧.٦، ٧.٩، ٧.١٢
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.v1.errors import not_found
from app.api.v1.filtering import FilterParams, SortParams
from app.api.v1.pagination import PaginationParams, paginate_list
from app.api.v1.schemas import CursorPageResponse, MessageResponse
from app.firestore.invoices import InvoiceRepository
from app.schemas.schemas import InvoiceCreate, InvoiceResponse, InvoiceUpdate
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/invoices", tags=["v1 / Invoices"])


@router.get(
    "",
    response_model=CursorPageResponse[InvoiceResponse],
    summary="لیستی فاکتۆرەکان",
    description="وەرگرتنی لیستی فاکتۆرەکان لەگەڵ cursor-based pagination، filtering، و sorting",
)
def list_invoices_v1(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    user: dict = Depends(get_current_user),
):
    """
    **GET /api/v1/invoices**

    وەرگرتنی لیستی فاکتۆرەکان لەگەڵ:
    - cursor-based pagination (`cursor`, `limit`)
    - filtering (`status`, `contact_id`, `date_from`, `date_to`, `search`)
    - sorting (`sort_by`, `sort_dir`)
    """
    repo = InvoiceRepository(user["org_id"])

    repo_filters = filters.to_repo_filters(date_field="date")

    items, total = repo.list(
        filters=repo_filters,
        order_by=sort.order_by or "date",
        order_dir=sort.order_dir or "DESCENDING",
        limit=params.limit + 1,
        start_after=params.doc_id_after,
    )

    items = filters.apply_search(items, ["invoice_number", "reference"])

    return paginate_list(items, params, total=total, sort_field=sort.order_by or "date")


@router.get(
    "/{invoice_id}",
    response_model=InvoiceResponse,
    summary="وەرگرتنی فاکتۆر",
    responses={404: {"model": None, "description": "فاکتۆر نەدۆزرایەوە"}},
)
def get_invoice_v1(
    invoice_id: str,
    user: dict = Depends(get_current_user),
):
    """**GET /api/v1/invoices/{invoice_id}**"""
    repo = InvoiceRepository(user["org_id"])
    invoice = repo.get(invoice_id)
    if not invoice or invoice.get("org_id") != user["org_id"]:
        return not_found("Invoice", invoice_id, f"/api/v1/invoices/{invoice_id}")
    # Load lines
    invoice["lines"] = repo.get_lines(invoice_id)
    return invoice
