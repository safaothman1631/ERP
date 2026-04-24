"""Sprint 29: Migration Wizard (FIX-461..475).

Generic CSV import + dry-run + apply. Initial entity support: contacts, items,
chart of accounts. Each migration job records counts, errors, and status so the
UI can resume / retry.
"""
import csv
import io
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from app.firestore.base import BaseRepository
from app.firestore.contacts import ContactRepository
from app.firestore.items import ItemRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/migration", tags=["Migration"])


class MigrationJobRepository(BaseRepository):
    collection_name = "migration_jobs"


SUPPORTED_ENTITIES = {"contacts", "items", "chart_of_accounts"}


def _parse_csv(content: bytes) -> tuple[list[dict], list[str]]:
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    rows = [dict(r) for r in reader]
    return rows, headers


def _map_row(entity: str, row: dict) -> dict:
    if entity == "contacts":
        return {
            "name": row.get("name") or row.get("Name"),
            "email": row.get("email") or row.get("Email"),
            "phone": row.get("phone") or row.get("Phone"),
            "type": row.get("type") or "customer",
        }
    if entity == "items":
        return {
            "name": row.get("name") or row.get("Name"),
            "sku": row.get("sku") or row.get("SKU"),
            "price": float(row.get("price") or 0),
            "cost": float(row.get("cost") or 0),
            "type": row.get("type") or "product",
        }
    if entity == "chart_of_accounts":
        return {
            "name": row.get("name") or row.get("Name"),
            "code": row.get("code") or row.get("Code"),
            "type": row.get("type"),
        }
    return row


def _validate_row(entity: str, mapped: dict) -> Optional[str]:
    if entity in {"contacts", "items"}:
        if not mapped.get("name"):
            return "missing 'name'"
    if entity == "chart_of_accounts":
        if not mapped.get("code") or not mapped.get("name"):
            return "missing 'code' or 'name'"
    return None


@router.get("/entities")
def supported_entities(user: dict = Depends(get_current_user)):
    return {"entities": sorted(SUPPORTED_ENTITIES)}


@router.post("/dry-run", dependencies=[Depends(require_perm("settings.update"))])
async def dry_run(entity: str = Form(...), file: UploadFile = File(...),
                   user: dict = Depends(get_current_user)):
    if entity not in SUPPORTED_ENTITIES:
        raise HTTPException(400, "unsupported entity")
    content = await file.read()
    rows, headers = _parse_csv(content)
    valid = 0
    errors: list[dict] = []
    preview: list[dict] = []
    for idx, r in enumerate(rows, start=2):  # row 2 = first data row
        mapped = _map_row(entity, r)
        err = _validate_row(entity, mapped)
        if err:
            errors.append({"row": idx, "error": err, "data": r})
        else:
            valid += 1
            if len(preview) < 5:
                preview.append(mapped)
    return {
        "entity": entity, "headers": headers,
        "total_rows": len(rows), "valid_rows": valid,
        "error_count": len(errors), "errors": errors[:50],
        "preview": preview,
    }


@router.post("/apply", status_code=201,
              dependencies=[Depends(require_perm("settings.update"))])
async def apply_migration(entity: str = Form(...), file: UploadFile = File(...),
                           user: dict = Depends(get_current_user)):
    if entity not in SUPPORTED_ENTITIES:
        raise HTTPException(400, "unsupported entity")
    org = user["org_id"]
    content = await file.read()
    rows, headers = _parse_csv(content)
    job_repo = MigrationJobRepository(org)
    job = job_repo.create({
        "entity": entity,
        "filename": file.filename,
        "total_rows": len(rows),
        "status": "running",
        "started_at": datetime.utcnow().isoformat(),
        "started_by": user["id"],
    })

    inserted = 0
    failed: list[dict] = []
    if entity == "contacts":
        repo: BaseRepository = ContactRepository(org)
    elif entity == "items":
        repo = ItemRepository(org)
    else:
        # chart_of_accounts → BaseRepository on coa collection
        class _COA(BaseRepository):
            collection_name = "chart_of_accounts"
        repo = _COA(org)

    for idx, r in enumerate(rows, start=2):
        mapped = _map_row(entity, r)
        err = _validate_row(entity, mapped)
        if err:
            failed.append({"row": idx, "error": err})
            continue
        try:
            repo.create(mapped)
            inserted += 1
        except Exception as exc:
            failed.append({"row": idx, "error": str(exc)[:200]})

    final_status = "completed" if not failed else ("partial" if inserted else "failed")
    final = job_repo.update(job["id"], {
        "status": final_status,
        "inserted": inserted,
        "failed_count": len(failed),
        "failures": failed[:100],
        "finished_at": datetime.utcnow().isoformat(),
    })
    return final


@router.get("/jobs")
def list_jobs(entity: Optional[str] = None, status: Optional[str] = None,
               user: dict = Depends(get_current_user)):
    repo = MigrationJobRepository(user["org_id"])
    filters = []
    if entity:
        filters.append({"field": "entity", "op": "==", "value": entity})
    if status:
        filters.append({"field": "status", "op": "==", "value": status})
    items, total = repo.list(filters=filters or None, limit=200,
                              order_by="started_at", order_dir="DESCENDING")
    return {"items": items, "total": total}


@router.get("/jobs/{job_id}")
def get_job(job_id: str, user: dict = Depends(get_current_user)):
    item = MigrationJobRepository(user["org_id"]).get(job_id)
    if not item or item.get("org_id") != user["org_id"]:
        raise HTTPException(404, "job not found")
    return item
