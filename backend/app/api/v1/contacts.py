"""
/api/v1/contacts — Contacts resource with cursor-based pagination.

داواکاری ٧.٢، ٧.٣، ٧.٥، ٧.٦، ٧.٩، ٧.١٢
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.api.v1.pagination import PaginationParams, paginate_list
from app.api.v1.filtering import FilterParams, SortParams, build_filters
from app.api.v1.errors import not_found
from app.api.v1.schemas import CursorPageResponse, MessageResponse
from app.firestore.contacts import ContactRepository
from app.schemas.schemas import ContactCreate, ContactUpdate, ContactResponse
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/contacts", tags=["v1 / Contacts"])


@router.get(
    "",
    response_model=CursorPageResponse[ContactResponse],
    summary="لیستی پەیوەندییەکان",
    description="وەرگرتنی لیستی پەیوەندییەکان لەگەڵ cursor-based pagination، filtering، و sorting",
)
def list_contacts_v1(
    contact_type: Optional[str] = Query(default=None, max_length=20, description="جۆری پەیوەندی: customer، vendor"),
    params: PaginationParams = Depends(),
    filters: FilterParams = Depends(),
    sort: SortParams = Depends(),
    user: dict = Depends(get_current_user),
):
    """
    **GET /api/v1/contacts**

    وەرگرتنی لیستی پەیوەندییەکان لەگەڵ:
    - cursor-based pagination (`cursor`, `limit`)
    - filtering (`status`, `search`, `contact_type`)
    - sorting (`sort_by`, `sort_dir`)
    """
    repo = ContactRepository(user["org_id"])

    repo_filters = [{"field": "is_active", "op": "!=", "value": False}]
    if contact_type:
        repo_filters.append({"field": "contact_type", "op": "==", "value": contact_type})

    items, total = repo.list(
        filters=repo_filters,
        order_by=sort.order_by or "display_name",
        order_dir=sort.order_dir or "ASCENDING",
        limit=params.limit + 1,
        start_after=params.doc_id_after,
    )

    # Apply text search in memory
    items = filters.apply_search(items, ["display_name", "email", "phone", "company_name"])

    return paginate_list(items, params, total=total, sort_field=sort.order_by or "display_name")


@router.get(
    "/{contact_id}",
    response_model=ContactResponse,
    summary="وەرگرتنی پەیوەندی",
    responses={404: {"model": None, "description": "پەیوەندی نەدۆزرایەوە"}},
)
def get_contact_v1(
    contact_id: str,
    user: dict = Depends(get_current_user),
):
    """**GET /api/v1/contacts/{contact_id}**"""
    repo = ContactRepository(user["org_id"])
    contact = repo.get(contact_id)
    if not contact or contact.get("org_id") != user["org_id"]:
        return not_found("Contact", contact_id, f"/api/v1/contacts/{contact_id}")
    return contact


@router.post(
    "",
    status_code=201,
    response_model=ContactResponse,
    summary="دروستکردنی پەیوەندی نوێ",
    dependencies=[Depends(require_perm("contacts.create"))],
)
def create_contact_v1(
    data: ContactCreate,
    user: dict = Depends(get_current_user),
):
    """**POST /api/v1/contacts**"""
    import uuid
    repo = ContactRepository(user["org_id"])
    return repo.create({"id": str(uuid.uuid4()), **data.model_dump()})


@router.put(
    "/{contact_id}",
    response_model=ContactResponse,
    summary="نوێکردنەوەی پەیوەندی",
    dependencies=[Depends(require_perm("contacts.update"))],
    responses={404: {"model": None, "description": "پەیوەندی نەدۆزرایەوە"}},
)
def update_contact_v1(
    contact_id: str,
    data: ContactUpdate,
    user: dict = Depends(get_current_user),
):
    """**PUT /api/v1/contacts/{contact_id}**"""
    repo = ContactRepository(user["org_id"])
    existing = repo.get(contact_id)
    if not existing or existing.get("org_id") != user["org_id"]:
        return not_found("Contact", contact_id, f"/api/v1/contacts/{contact_id}")
    return repo.update(contact_id, data.model_dump(exclude_unset=True))


@router.delete(
    "/{contact_id}",
    response_model=MessageResponse,
    summary="سڕینەوەی پەیوەندی",
    dependencies=[Depends(require_perm("contacts.delete"))],
    responses={404: {"model": None, "description": "پەیوەندی نەدۆزرایەوە"}},
)
def delete_contact_v1(
    contact_id: str,
    user: dict = Depends(get_current_user),
):
    """**DELETE /api/v1/contacts/{contact_id}** (soft delete)"""
    repo = ContactRepository(user["org_id"])
    existing = repo.get(contact_id)
    if not existing or existing.get("org_id") != user["org_id"]:
        return not_found("Contact", contact_id, f"/api/v1/contacts/{contact_id}")
    repo.delete(contact_id)
    return {"message": "پەیوەندی سڕایەوە", "success": True}
