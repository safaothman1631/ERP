"""OCR receipt scanning endpoints + scan history."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.firestore.base import BaseRepository
from app.services.auth import get_current_user
from app.services.ocr_service import extract_from_image, parse_text_payload


class ReceiptScanRepository(BaseRepository):
    collection_name = "receipt_scans"


router = APIRouter(prefix="/api/ocr", tags=["OCR"])


class TextScanRequest(BaseModel):
    text: str
    save: bool = True


class ConfirmRequest(BaseModel):
    scan_id: str
    bill_id: Optional[str] = None
    parsed: dict


@router.post("/scan")
async def scan_receipt(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "image file required")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "file too large (max 10MB)")
    result = extract_from_image(content)

    repo = ReceiptScanRepository(user["org_id"])
    saved = repo.create({
        "filename": file.filename or "receipt.jpg",
        "content_type": file.content_type,
        "status": result.get("status"),
        "raw_text": result.get("raw_text", ""),
        "parsed": result.get("parsed", {}),
        "scanned_at": datetime.utcnow().isoformat(),
        "linked_bill_id": None,
    })
    return {"id": saved["id"], **result}


@router.post("/scan-text")
def scan_text(payload: TextScanRequest, user: dict = Depends(get_current_user)):
    """Use this when integrating with external OCR (e.g. Google Vision) on the client."""
    result = parse_text_payload(payload.text)
    if payload.save:
        repo = ReceiptScanRepository(user["org_id"])
        saved = repo.create({
            "filename": "text-payload",
            "content_type": "text/plain",
            "status": "ok",
            "raw_text": payload.text,
            "parsed": result.get("parsed", {}),
            "scanned_at": datetime.utcnow().isoformat(),
            "linked_bill_id": None,
        })
        result["id"] = saved["id"]
    return result


@router.get("/scans")
def list_scans(user: dict = Depends(get_current_user)):
    repo = ReceiptScanRepository(user["org_id"])
    items, total = repo.list(limit=100, order_by="scanned_at", order_dir="DESCENDING")
    # Strip raw_text from list view; keep it in the detail endpoint
    light = [{k: v for k, v in i.items() if k != "raw_text"} for i in items]
    return {"items": light, "total": total}


@router.get("/scans/{scan_id}")
def get_scan(scan_id: str, user: dict = Depends(get_current_user)):
    repo = ReceiptScanRepository(user["org_id"])
    scan = repo.get(scan_id)
    if not scan or scan.get("org_id") != user["org_id"]:
        raise HTTPException(404, "scan not found")
    return scan


@router.post("/confirm")
def confirm_scan(payload: ConfirmRequest, user: dict = Depends(get_current_user)):
    """Mark scan as processed and optionally attach a bill_id created by the UI."""
    repo = ReceiptScanRepository(user["org_id"])
    scan = repo.get(payload.scan_id)
    if not scan or scan.get("org_id") != user["org_id"]:
        raise HTTPException(404, "scan not found")
    return repo.update(payload.scan_id, {
        "parsed": payload.parsed,
        "linked_bill_id": payload.bill_id,
        "confirmed_at": datetime.utcnow().isoformat(),
        "status": "confirmed",
    })


@router.delete("/scans/{scan_id}")
def delete_scan(scan_id: str, user: dict = Depends(get_current_user)):
    repo = ReceiptScanRepository(user["org_id"])
    if not repo.get(scan_id):
        raise HTTPException(404, "scan not found")
    repo.delete(scan_id)
    return {"success": True}
