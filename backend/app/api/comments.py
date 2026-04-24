"""API endpoints for comments on transactions"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from app.firestore.comments import CommentRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/comments", tags=["Comments"])


@router.get("/{entity_type}/{entity_id}")
def list_comments(
    entity_type: str,
    entity_id: str,
    user: dict = Depends(get_current_user),
):
    """List all comments for a specific entity (invoice, bill, quote, etc.)"""
    repo = CommentRepository(user["org_id"])
    filters = [
        {"field": "entity_type", "op": "==", "value": entity_type},
        {"field": "entity_id", "op": "==", "value": entity_id},
    ]
    items, total = repo.list(
        filters=filters,
        order_by="created_at",
        order_dir="DESCENDING",
        limit=100
    )
    return {"items": items, "total": total}


@router.post("/{entity_type}/{entity_id}", status_code=201)
def create_comment(
    entity_type: str,
    entity_id: str,
    data: dict,
    user: dict = Depends(get_current_user),
):
    """Add a new comment to an entity"""
    repo = CommentRepository(user["org_id"])
    comment = repo.create({
        "id": str(uuid.uuid4()),
        "entity_type": entity_type,
        "entity_id": entity_id,
        "text": data["text"],
        "user_id": user["id"],
        "user_name": user.get("full_name", user.get("email", "")),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    })
    return comment


@router.put("/{comment_id}")
def update_comment(
    comment_id: str,
    data: dict,
    user: dict = Depends(get_current_user),
):
    """Edit an existing comment"""
    repo = CommentRepository(user["org_id"])
    comment = repo.get(comment_id)
    if not comment or comment.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="سەرنج نەدۆزرایەوە")
    
    # Only the comment author can edit
    if comment.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="تەنها خاوەنی سەرنج دەتوانێت دەستکاری بکات")
    
    updated = repo.update(comment_id, {
        "text": data["text"],
        "updated_at": datetime.utcnow(),
    })
    return updated


@router.delete("/{comment_id}")
def delete_comment(
    comment_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a comment"""
    repo = CommentRepository(user["org_id"])
    comment = repo.get(comment_id)
    if not comment or comment.get("org_id") != user["org_id"]:
        raise HTTPException(status_code=404, detail="سەرنج نەدۆزرایەوە")
    
    # Only the comment author can delete
    if comment.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="تەنها خاوەنی سەرنج دەتوانێت بسڕێتەوە")
    
    repo.delete(comment_id)
    return {"success": True, "message": "سەرنج سڕایەوە"}
