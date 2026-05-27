"""Helper to apply optimistic-lock updates from API routes (Wave C)."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import HTTPException

from app.firestore.base import VersionConflict
from app.services.version_dependency import parse_version_header


def apply_versioned_update(
    repo: Any,
    doc_id: str,
    data: dict,
    *,
    expected_version: Optional[int] = None,
    if_match: Optional[str] = None,
) -> dict:
    version = expected_version
    if version is None and if_match:
        version = parse_version_header(if_match)
    if version is not None:
        try:
            return repo.update_versioned(doc_id, data, int(version))
        except VersionConflict as exc:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "version_conflict",
                    "current_version": exc.current_version,
                    "doc_id": exc.doc_id,
                },
            ) from exc
    return repo.update(doc_id, data)
