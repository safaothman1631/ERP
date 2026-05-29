"""Iraq e-Fakhata (e-Invoicing) module — growth-to-100 § R4.

Modules:
  * ``schema``           — Pydantic XML model per MoF e-Fakhata spec v1.0
  * ``builder``          — domain ``Invoice`` → ``EFakhataInvoice`` mapper
  * ``version_registry`` — supported schema versions + migration helpers
  * ``signing``          — XAdES-BES signing/verification via ``signxml``
  * ``cert_storage``     — per-tenant PKCS#12 stored in GCP Secret Manager
  * ``submission_queue`` — Firestore-backed durable queue with retry/backoff
  * ``mof_client``       — HTTP client for the Iraq MoF submission API
  * ``submission_worker``— APScheduler job polling the queue
  * ``auditor_export``   — ZIP bundle of signed XML + PDF + manifest

All MoF wire-format details that are not yet published are marked
``# TODO: verify against published spec (R7.X)`` so the field shape can be
flipped to the real one in one place when the contract is confirmed.
"""
from __future__ import annotations

from app.efakhata.schema import (
    EFakhataAddress,
    EFakhataInvoice,
    EFakhataInvoiceLine,
    EFakhataParty,
    EFakhataTotals,
)
from app.efakhata.version_registry import current_version, is_supported, supported_versions

__all__ = [
    "EFakhataAddress",
    "EFakhataInvoice",
    "EFakhataInvoiceLine",
    "EFakhataParty",
    "EFakhataTotals",
    "current_version",
    "is_supported",
    "supported_versions",
]
