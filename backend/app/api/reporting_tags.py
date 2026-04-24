"""API endpoints for reporting tags (tag groups for filtering reports)"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from app.firestore.reporting_tags import ReportingTagRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/reporting-tags", tags=["Reporting Tags"])


@router.get("")
def list_tags(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    """List all reporting tag groups"""
    repo = ReportingTagRepository(user["org_id"])
    filters = [{"field": "is_active", "op": "!=", "value": False}]
    items, total = repo.list(
        filters=filters,
        order_by="name",
        order_dir="ASCENDING",
        limit=page_size,
        offset=(page - 1) * page_size
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", status_code=201)
def create_tag(data: dict, user: dict = Depends(get_current_user)):
    """Create a new tag group with options"""
    repo = ReportingTagRepository(user["org_id"])
    tag = repo.create({
        "id": str(uuid.uuid4()),
        "name": data["name"],
        "name_ku": data.get("name_ku", ""),
        "options": data.get("options", []),  # List of tag values
        "is_active": True,
    })
    return tag


@router.get("/{tag_id}")
def get_tag(tag_id: str, user: dict = Depends(get_current_user)):
    """Get a specific tag group"""
    repo = ReportingTagRepository(user["org_id"])
    tag = repo.get(tag_id)
    if not tag or tag.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تاگ نەدۆزرایەوە")
    return tag


@router.put("/{tag_id}")
def update_tag(tag_id: str, data: dict, user: dict = Depends(get_current_user)):
    """Update a tag group"""
    repo = ReportingTagRepository(user["org_id"])
    tag = repo.get(tag_id)
    if not tag or tag.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تاگ نەدۆزرایەوە")
    
    updated = repo.update(tag_id, {
        "name": data.get("name", tag["name"]),
        "name_ku": data.get("name_ku", tag.get("name_ku", "")),
        "options": data.get("options", tag.get("options", [])),
    })
    return updated


@router.delete("/{tag_id}")
def delete_tag(tag_id: str, user: dict = Depends(get_current_user)):
    """Delete (deactivate) a tag group"""
    repo = ReportingTagRepository(user["org_id"])
    tag = repo.get(tag_id)
    if not tag or tag.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="تاگ نەدۆزرایەوە")
    
    repo.update(tag_id, {"is_active": False})
    return {"success": True, "message": "تاگ سڕایەوە"}
