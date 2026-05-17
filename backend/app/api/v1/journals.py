"""
/api/v1/journals — Journal Entries resource with cursor-based pagination.

داواکاری ٧.٢، ٧.٣، ٧.٥، ٧.٦، ٧.٩، ٧.١٢
"""

from fastapi import APIRouter, Depends

from app.api.v1.errors import not_found
from app.api.v1.filtering import FilterParams, SortParams
from app.api.v1.pagination import PaginationParams, paginate_list
from app.api.v1.schemas import CursorPageResponse
from app.firestore.journals import JournalEntryRepository
from app.schemas.schemas import JournalEntryCreate, JournalEntryResponse
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/journals", tags=["v1 / Journals"])


@router.get(
    "",
    response_model=CursorPageResponse[JournalEntryResponse],
    summary="لیستی جۆرنال ئەنتریەکان",
    description="وەرگرتنی لیستی جۆرنال ئەنتریەکان لەگەڵ cursor-based pagination، filtering، و sorting",
)
def list_journals_v1(
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    user: dict = Depends(get_current_user),
):
    """
    **GET /api/v1/journals**

    وەرگرتنی لیستی جۆرنال ئەنتریەکان لەگەڵ:
    - cursor-based pagination (`cursor`, `limit`)
    - filtering (`status`, `date_from`, `date_to`, `search`)
    - sorting (`sort_by`, `sort_dir`)
    """
    repo = JournalEntryRepository(user["org_id"])

    repo_filters = filters.to_repo_filters(date_field="date")

    items, total = repo.list(
        filters=repo_filters,
        order_by=sort.order_by or "date",
        order_dir=sort.order_dir or "DESCENDING",
        limit=params.limit + 1,
        start_after=params.doc_id_after,
    )

    items = filters.apply_search(items, ["entry_number", "reference", "description"])

    return paginate_list(items, params, total=total, sort_field=sort.order_by or "date")


@router.get(
    "/{journal_id}",
    response_model=JournalEntryResponse,
    summary="وەرگرتنی جۆرنال ئەنتری",
    responses={404: {"model": None, "description": "جۆرنال ئەنتری نەدۆزرایەوە"}},
)
def get_journal_v1(
    journal_id: str,
    user: dict = Depends(get_current_user),
):
    """**GET /api/v1/journals/{journal_id}**"""
    repo = JournalEntryRepository(user["org_id"])
    entry = repo.get(journal_id)
    if not entry or entry.get("org_id") != user["org_id"]:
        return not_found("Journal Entry", journal_id, f"/api/v1/journals/{journal_id}")
    entry["lines"] = repo.get_lines(journal_id)
    return entry
