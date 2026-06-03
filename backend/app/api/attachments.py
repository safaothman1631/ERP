import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from app.firestore.system import AttachmentRepository
from app.services.storage_service import StorageService
from app.services.auth import get_current_user
from app.services.upload_validation import validate_upload, UploadValidationError

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
    # Validate end-to-end: size cap + magic-byte sniff + extension blocklist +
    # filename sanitisation (+ optional ClamAV). Replaces the bare 10MB check so
    # attacker-controlled filenames/content-types are never stored or served raw.
    try:
        validated = validate_upload(
            file_bytes=contents,
            filename=file.filename or "",
            declared_content_type=file.content_type,
            category="any",
        )
    except UploadValidationError as exc:
        raise HTTPException(exc.status_code, exc.detail)

    storage = StorageService(user["org_id"])
    path = storage.upload_attachment(contents, validated.safe_filename, entity_type, entity_id, validated.content_type)

    repo = AttachmentRepository(user["org_id"])
    attachment = repo.create({
        "id": str(uuid.uuid4()),
        "entity_type": entity_type,
        "entity_id": entity_id,
        "filename": validated.safe_filename,
        "content_type": validated.content_type,
        "size": validated.size_bytes,
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
