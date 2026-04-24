import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from app.firestore.system import AttachmentRepository
from app.services.storage_service import StorageService
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/attachments", tags=["Attachments"])

@router.get("/{entity_type}/{entity_id}")
def list_attachments(entity_type: str, entity_id: str, user: dict = Depends(get_current_user)):
    repo = AttachmentRepository(user["org_id"])
    items, _ = repo.list(
        filters=[
            {"field": "entity_type", "op": "==", "value": entity_type},
            {"field": "entity_id", "op": "==", "value": entity_id},
        ],
        limit=50
    )
    return items

@router.post("/{entity_type}/{entity_id}", status_code=201)
async def upload_attachment(entity_type: str, entity_id: str,
                           file: UploadFile = File(...),
                           user: dict = Depends(get_current_user)):
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB)")
    
    storage = StorageService(user["org_id"])
    path = storage.upload_attachment(contents, file.filename, entity_type, entity_id, file.content_type)
    
    repo = AttachmentRepository(user["org_id"])
    attachment = repo.create({
        "id": str(uuid.uuid4()),
        "entity_type": entity_type,
        "entity_id": entity_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "size": len(contents),
        "storage_path": path,
        "uploaded_by": user["id"],
    })
    return attachment

@router.delete("/{attachment_id}")
def delete_attachment(attachment_id: str, user: dict = Depends(get_current_user)):
    repo = AttachmentRepository(user["org_id"])
    att = repo.get(attachment_id)
    if not att: raise HTTPException(404)
    try:
        storage = StorageService(user["org_id"])
        storage.delete_file(att["storage_path"])
    except Exception:
        pass
    repo.delete(attachment_id)
    return {"success": True}
