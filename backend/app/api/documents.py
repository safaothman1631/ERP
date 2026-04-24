"""Sprint 39: Documents + DMS + e-Signature.

FIX-1111..FIX-1145.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.firestore.base import BaseRepository
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/documents", tags=["Documents"])


class DocFolderRepo(BaseRepository):
    collection_name = "doc_folders"


class DocFileRepo(BaseRepository):
    collection_name = "doc_files"


class DocVersionRepo(BaseRepository):
    collection_name = "doc_versions"


class DocSignRequestRepo(BaseRepository):
    collection_name = "doc_sign_requests"


class DocSignatureRepo(BaseRepository):
    collection_name = "doc_signatures"


class DocWorkflowRepo(BaseRepository):
    collection_name = "doc_workflows"


class DocShareRepo(BaseRepository):
    collection_name = "doc_shares"


class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    description: Optional[str] = None


class FileCreate(BaseModel):
    name: str
    folder_id: Optional[str] = None
    storage_url: str
    mime_type: str = "application/octet-stream"
    size_bytes: int = 0
    description: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class FileUpdate(BaseModel):
    name: Optional[str] = None
    folder_id: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list[str]] = None


class VersionCreate(BaseModel):
    file_id: str
    storage_url: str
    size_bytes: int = 0
    notes: Optional[str] = None


class SignRequestCreate(BaseModel):
    file_id: str
    signers: list[dict] = Field(default_factory=list)
    message: Optional[str] = None
    expires_in_days: int = Field(14, ge=1, le=90)


class SignatureCreate(BaseModel):
    sign_request_id: str
    signer_email: str
    signature_data_url: str
    signed_at: Optional[str] = None


class WorkflowCreate(BaseModel):
    name: str
    file_id: Optional[str] = None
    steps: list[dict] = Field(default_factory=list)


class ShareCreate(BaseModel):
    file_id: str
    user_id: Optional[str] = None
    public_link: bool = False
    permission: str = Field("view", pattern=r"^(view|comment|edit)$")
    expires_at: Optional[str] = None


def _own(repo, doc_id, org_id):
    item = repo.get(doc_id)
    if not item or item.get("org_id") != org_id:
        raise HTTPException(404, "نەدۆزرایەوە")
    return item


# Folders
@router.get("/folders")
def list_folders(user: dict = Depends(get_current_user), parent_id: Optional[str] = None):
    filters = []
    if parent_id:
        filters.append({"field": "parent_id", "op": "==", "value": parent_id})
    items, total = DocFolderRepo(user["org_id"]).list(filters=filters, limit=500)
    return {"items": items, "total": total}


@router.post("/folders", status_code=201)
def create_folder(body: FolderCreate, user: dict = Depends(get_current_user)):
    return DocFolderRepo(user["org_id"]).create(body.model_dump())


@router.delete("/folders/{fid}", status_code=204)
def delete_folder(fid: str, user: dict = Depends(get_current_user)):
    repo = DocFolderRepo(user["org_id"])
    _own(repo, fid, user["org_id"])
    repo.delete(fid)


# Files
@router.get("/files")
def list_files(
    user: dict = Depends(get_current_user),
    folder_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = 0,
):
    filters = []
    if folder_id:
        filters.append({"field": "folder_id", "op": "==", "value": folder_id})
    items, total = DocFileRepo(user["org_id"]).list(filters=filters, limit=limit, offset=offset)
    return {"items": items, "total": total}


@router.post("/files", status_code=201)
def create_file_doc(body: FileCreate, user: dict = Depends(get_current_user)):
    data = body.model_dump()
    data["uploaded_by"] = user.get("id") or user.get("email")
    data["version"] = 1
    return DocFileRepo(user["org_id"]).create(data)


@router.get("/files/{fid}")
def get_file(fid: str, user: dict = Depends(get_current_user)):
    return _own(DocFileRepo(user["org_id"]), fid, user["org_id"])


@router.patch("/files/{fid}")
def update_file(fid: str, body: FileUpdate, user: dict = Depends(get_current_user)):
    repo = DocFileRepo(user["org_id"])
    _own(repo, fid, user["org_id"])
    return repo.update(fid, {k: v for k, v in body.model_dump().items() if v is not None})


@router.delete("/files/{fid}", status_code=204)
def delete_file(fid: str, user: dict = Depends(get_current_user)):
    repo = DocFileRepo(user["org_id"])
    _own(repo, fid, user["org_id"])
    repo.delete(fid)


# Versions
@router.get("/files/{fid}/versions")
def list_versions(fid: str, user: dict = Depends(get_current_user)):
    items, total = DocVersionRepo(user["org_id"]).list(
        filters=[{"field": "file_id", "op": "==", "value": fid}],
        order_by="created_at", limit=500,
    )
    return {"items": items, "total": total}


@router.post("/files/{fid}/versions", status_code=201)
def add_version(fid: str, body: VersionCreate, user: dict = Depends(get_current_user)):
    file_repo = DocFileRepo(user["org_id"])
    f = _own(file_repo, fid, user["org_id"])
    data = body.model_dump()
    data["file_id"] = fid
    data["version_number"] = int(f.get("version", 1)) + 1
    data["uploaded_by"] = user.get("id") or user.get("email")
    v = DocVersionRepo(user["org_id"]).create(data)
    file_repo.update(fid, {
        "version": data["version_number"],
        "storage_url": data["storage_url"],
        "size_bytes": data.get("size_bytes", 0),
    })
    return v


# Sign Requests
@router.get("/sign-requests")
def list_sign_reqs(user: dict = Depends(get_current_user), status: Optional[str] = None):
    filters = []
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = DocSignRequestRepo(user["org_id"]).list(filters=filters, limit=500)
    return {"items": items, "total": total}


@router.post("/sign-requests", status_code=201)
def create_sign_req(body: SignRequestCreate, user: dict = Depends(get_current_user)):
    data = body.model_dump()
    data["status"] = "pending"
    data["created_by"] = user.get("id") or user.get("email")
    return DocSignRequestRepo(user["org_id"]).create(data)


@router.get("/sign-requests/{sid}")
def get_sign_req(sid: str, user: dict = Depends(get_current_user)):
    return _own(DocSignRequestRepo(user["org_id"]), sid, user["org_id"])


@router.post("/sign-requests/{sid}/cancel")
def cancel_sign_req(sid: str, user: dict = Depends(get_current_user)):
    repo = DocSignRequestRepo(user["org_id"])
    _own(repo, sid, user["org_id"])
    return repo.update(sid, {"status": "cancelled", "cancelled_at": datetime.utcnow().isoformat()})


# Signatures
@router.post("/signatures", status_code=201)
def create_sig(body: SignatureCreate, user: dict = Depends(get_current_user)):
    data = body.model_dump()
    data["signed_at"] = data.get("signed_at") or datetime.utcnow().isoformat()
    sig = DocSignatureRepo(user["org_id"]).create(data)
    # If all signers signed, mark request complete
    req_repo = DocSignRequestRepo(user["org_id"])
    req = req_repo.get(body.sign_request_id)
    if req:
        sigs, _ = DocSignatureRepo(user["org_id"]).list(
            filters=[{"field": "sign_request_id", "op": "==", "value": body.sign_request_id}], limit=100,
        )
        signers = req.get("signers", [])
        if signers and len(sigs) >= len(signers):
            req_repo.update(body.sign_request_id, {"status": "completed", "completed_at": datetime.utcnow().isoformat()})
    return sig


@router.get("/sign-requests/{sid}/signatures")
def list_sigs(sid: str, user: dict = Depends(get_current_user)):
    items, total = DocSignatureRepo(user["org_id"]).list(
        filters=[{"field": "sign_request_id", "op": "==", "value": sid}], limit=500,
    )
    return {"items": items, "total": total}


# Workflows
@router.get("/workflows")
def list_workflows(user: dict = Depends(get_current_user)):
    items, total = DocWorkflowRepo(user["org_id"]).list(limit=500)
    return {"items": items, "total": total}


@router.post("/workflows", status_code=201)
def create_workflow(body: WorkflowCreate, user: dict = Depends(get_current_user)):
    return DocWorkflowRepo(user["org_id"]).create(body.model_dump())


@router.delete("/workflows/{wid}", status_code=204)
def delete_workflow(wid: str, user: dict = Depends(get_current_user)):
    repo = DocWorkflowRepo(user["org_id"])
    _own(repo, wid, user["org_id"])
    repo.delete(wid)


# Shares
@router.post("/shares", status_code=201)
def create_share(body: ShareCreate, user: dict = Depends(get_current_user)):
    return DocShareRepo(user["org_id"]).create(body.model_dump())


@router.get("/shares")
def list_shares(user: dict = Depends(get_current_user), file_id: Optional[str] = None):
    filters = []
    if file_id:
        filters.append({"field": "file_id", "op": "==", "value": file_id})
    items, total = DocShareRepo(user["org_id"]).list(filters=filters, limit=500)
    return {"items": items, "total": total}


@router.delete("/shares/{shid}", status_code=204)
def delete_share(shid: str, user: dict = Depends(get_current_user)):
    repo = DocShareRepo(user["org_id"])
    _own(repo, shid, user["org_id"])
    repo.delete(shid)
