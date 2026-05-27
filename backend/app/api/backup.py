"""
Backup API router.

Exposes three endpoints under /api/system:
  - GET  /backup/list              — list last 30 backup records (admin/owner only)
  - POST /backup/run               — enqueue a manual backup run (admin/owner only)
  - GET  /backup/{backup_id}/download — generate a signed download URL (any authenticated user,
                                        org-scoped: 403 if backup belongs to a different org)

Authentication:
  All endpoints require a valid session via ``get_current_user``.
  Unauthenticated requests are rejected with HTTP 401 by the dependency.

Access control:
  - list and run require role ``admin`` or ``owner`` (Requirement 10.2, 10.4).
  - download requires org_id match regardless of role (Requirement 10.3).

Requirements: 4.6, 8.3, 8.4, 10.2, 10.3, 10.4
"""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.firebase_client import get_db
from app.services.auth import get_current_user
from app.services.backup_service import BackupService
from app.services.storage_service import StorageService

router = APIRouter(prefix="/api/system", tags=["Backup"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _require_admin(user: dict) -> None:
    """Raise HTTP 403 if the user does not hold the ``admin`` or ``owner`` role.

    Args:
        user: The authenticated user dict from ``get_current_user``.

    Raises:
        HTTPException: 403 when the user's role is not ``admin`` or ``owner``.

    Requirements: 10.2, 10.4
    """
    if user.get("role") not in ("admin", "owner"):
        raise HTTPException(
            status_code=403,
            detail="دەسەڵات نییە: تەنها بەڕێوەبەر یان خاوەن دەتوانێت ئەم کارە ئەنجام بدات",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/backup/list")
def list_backups(user: dict = Depends(get_current_user)) -> list[dict]:
    """Return the last 30 backup records for the authenticated user's organisation.

    Access: admin or owner only (Requirement 10.4).

    Args:
        user: Authenticated user dict injected by ``get_current_user``.

    Returns:
        A list of up to 30 backup record dicts ordered by ``created_at`` descending.

    Requirements: 4.6, 8.1, 10.4
    """
    _require_admin(user)

    db = get_db()
    # Fetch without order_by to avoid requiring a composite Firestore index
    # (the backups collection is new and may not have the index yet).
    # Sort in Python instead — 30 records is trivially fast.
    docs = (
        db.collection("backups")
        .where("org_id", "==", user["org_id"])
        .limit(30)
        .stream()
    )
    records = [{"id": doc.id, **doc.to_dict()} for doc in docs]
    records.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return records


@router.post("/backup/run", status_code=202)
def run_backup(
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict:
    """Enqueue a manual backup run for the authenticated user's organisation.

    The backup is executed asynchronously as a FastAPI ``BackgroundTasks`` task
    so the response is returned immediately with HTTP 202 Accepted.

    Access: admin or owner only (Requirement 10.2).

    Args:
        background_tasks: FastAPI background task queue.
        user:             Authenticated user dict injected by ``get_current_user``.

    Returns:
        ``{"status": "queued"}``

    Requirements: 4.6, 8.2, 10.2
    """
    _require_admin(user)

    import asyncio

    def _run_backup_sync(org_id: str) -> None:
        """Wrapper to run the async backup coroutine from a sync background task."""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(BackupService(org_id).run_backup())
            finally:
                loop.close()
        except Exception:
            import logging
            logging.getLogger(__name__).error(
                "Background backup failed for org %s", org_id, exc_info=True
            )

    background_tasks.add_task(_run_backup_sync, user["org_id"])
    return {"status": "queued"}


@router.get("/backup/{backup_id}/download")
def download_backup(
    backup_id: str,
    user: dict = Depends(get_current_user),
):
    """Generate a signed Cloud Storage URL for downloading a backup file.

    Any authenticated user may call this endpoint, but the backup record's
    ``org_id`` must match the requesting user's ``org_id`` — cross-org access
    is rejected with HTTP 403 regardless of the user's role (Requirement 10.3).

    The signed URL is valid for 60 minutes.

    Args:
        backup_id: Firestore document ID of the backup record.
        user:      Authenticated user dict injected by ``get_current_user``.

    Returns:
        ``{"url": "<signed_url>", "expires_in_minutes": 60}``

    Raises:
        HTTPException: 404 if the backup record does not exist.
        HTTPException: 403 if the backup belongs to a different organisation.

    Requirements: 8.3, 8.4, 10.3
    """
    db = get_db()
    doc = db.collection("backups").document(backup_id).get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="تۆمارەکەی پاڵپشتکردن نەدۆزرایەوە")

    record = doc.to_dict()

    # Org-scoped access check — enforced regardless of role (Requirement 10.3).
    # MUST run before any Cloud Storage access so cross-org callers never reach
    # StorageService.
    if record.get("org_id") != user["org_id"]:
        raise HTTPException(
            status_code=403,
            detail="دەسەڵات نییە: ئەم پاڵپشتکردنە بۆ دامەزراوەی تر",
        )

    storage_path: str = record.get("storage_path", "")

    if not storage_path:
        raise HTTPException(
            status_code=500,
            detail="ئەم تۆمارەی پاڵپشتکردن ناونیشانی فایلی نییە",
        )

    # Generate a 60-minute signed Cloud Storage URL (Requirements 8.3, 8.4).
    try:
        storage_service = StorageService(user["org_id"])
        signed_url = storage_service.get_signed_url(storage_path, expires_minutes=60)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"دروستکردنی بەستەری داونلۆد سەرکەوتوو نەبوو: {exc}"
        )

    return {"url": signed_url, "expires_in_minutes": 60}
