"""Firestore repository backing the tenant-facing data-rights workflow (T-SF.2.22).

A single ``data_rights_requests`` collection records both *export* (GDPR Art. 15 /
PDPL right of access + portability) and *erasure* (GDPR Art. 17 / PDPL right to
be forgotten) requests for the caller's own organization. Every row is scoped to
``org_id`` by :class:`~app.firestore.base.BaseRepository`, so a tenant admin can
only ever see or act on their own organization's requests.

No ``WRITE_MODEL`` is set: validation already happens at the FastAPI layer via the
``*Request`` Pydantic models, and the service layer writes a controlled,
fixed-shape payload. Following the same rationale as ``quick_create_repos``.
"""
from __future__ import annotations

from app.firestore.base import BaseRepository


class DataRightsRequestRepository(BaseRepository):
    """CRUD for ``data_rights_requests`` (one collection, two request kinds).

    Document shape (fields the service layer manages)::

        kind:                 "export" | "erasure"
        status:               see app.services.data_rights_service.* status enums
        requested_by:         user id of the requesting admin
        requested_by_email:   denormalized for the audit trail / UI
        requested_at:         ISO-8601 string
        # export-specific
        signed_url:           short-lived GCS download URL (export only)
        gcs_path:             object path inside the export bucket
        bytes:                compressed archive size
        document_count:       total docs included
        collections:          {collection_name: row_count}
        completed_at:         ISO-8601 string
        error:                failure detail (export only)
        # erasure-specific
        confirm_token:        opaque token the admin must echo to confirm
        confirmed_at:         ISO-8601 string (set on confirm)
        scheduled_purge_at:   ISO-8601 string (now + GRACE_DAYS) — honoured by
                              the grace-period hard-delete sweep
        purged_at:            ISO-8601 string (set when the sweep finalizes)
        documents_purged:     count finalized by the sweep
        cancelled_at:         ISO-8601 string (admin cancelled before grace ended)
    """

    collection_name = "data_rights_requests"
