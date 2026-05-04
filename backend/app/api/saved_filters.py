# API endpoints for saved filters
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from app.firestore.saved_filters import SavedFilterRepository
from app.services.auth import get_current_user
import uuid

router = APIRouter(prefix="/api/saved-filters", tags=["SavedFilters"])


class SavedFilterCreate(BaseModel):
    page_key: str = Field(..., description="Page identifier (e.g., 'invoices', 'sales_orders')")
    name: str = Field(..., min_length=1, max_length=100)
    filters: dict[str, Any] = Field(default_factory=dict)
    columns: list[str] = Field(default_factory=list)
    is_default: bool = False


class SavedFilterUpdate(BaseModel):
    name: Optional[str] = None
    filters: Optional[dict[str, Any]] = None
    columns: Optional[list[str]] = None
    is_default: Optional[bool] = None


@router.get("")
def list_saved_filters(
    page_key: str = Query(...),
    user: dict = Depends(get_current_user)
):
    """List all saved filters for current user on a specific page"""
    org_id = user.get("org_id")
    user_id = user.get("uid")
    repo = SavedFilterRepository(org_id)
    return repo.get_user_filters(user_id, page_key)


@router.post("")
def create_saved_filter(
    data: SavedFilterCreate,
    user: dict = Depends(get_current_user)
):
    """Create a new saved filter"""
    org_id = user.get("org_id")
    user_id = user.get("uid")
    repo = SavedFilterRepository(org_id)

    # If setting as default, clear other defaults
    if data.is_default:
        existing = repo.get_user_filters(user_id, data.page_key)
        for item in existing:
            if item.get("is_default"):
                repo.update(item["id"], {"is_default": False})

    filter_doc = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "user_id": user_id,
        "page_key": data.page_key,
        "name": data.name,
        "filters": data.filters,
        "columns": data.columns,
        "is_default": data.is_default,
        "created_at": datetime.utcnow().isoformat(),
    }
    repo.create(filter_doc["id"], filter_doc)
    return filter_doc


@router.put("/{filter_id}")
def update_saved_filter(
    filter_id: str = Path(...),
    data: SavedFilterUpdate = ...,
    user: dict = Depends(get_current_user)
):
    """Update an existing saved filter"""
    org_id = user.get("org_id")
    user_id = user.get("uid")
    repo = SavedFilterRepository(org_id)

    existing = repo.get(filter_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Filter not found")
    if existing.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}

    # If setting as default, clear other defaults
    if update_data.get("is_default"):
        page_key = existing.get("page_key")
        filters = repo.get_user_filters(user_id, page_key)
        for item in filters:
            if item.get("is_default") and item["id"] != filter_id:
                repo.update(item["id"], {"is_default": False})

    repo.update(filter_id, update_data)
    return {**existing, **update_data}


@router.delete("/{filter_id}")
def delete_saved_filter(
    filter_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Delete a saved filter"""
    org_id = user.get("org_id")
    user_id = user.get("uid")
    repo = SavedFilterRepository(org_id)

    existing = repo.get(filter_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Filter not found")
    if existing.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    repo.delete(filter_id)
    return {"message": "Filter deleted"}


@router.post("/{filter_id}/set-default")
def set_default_filter(
    filter_id: str = Path(...),
    user: dict = Depends(get_current_user)
):
    """Set a filter as the default for its page"""
    org_id = user.get("org_id")
    user_id = user.get("uid")
    repo = SavedFilterRepository(org_id)

    existing = repo.get(filter_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Filter not found")
    if existing.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    page_key = existing.get("page_key")
    repo.set_default(filter_id, user_id, page_key)
    return {"message": "Default filter set"}
