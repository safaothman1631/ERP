"""Tax-auditor ZIP export for offline reconciliation.

A request body is just ``{start_date, end_date}``; this module assembles
every signed e-Fakhata invoice (acknowledged or pending) for the range
into a single ZIP with the following layout::

    invoices/
        INV-001.xml      ← signed XAdES-BES envelope
        INV-001.pdf      ← human-readable Arabic-rendered PDF
        INV-002.xml
        INV-002.pdf
    manifest.csv         ← invoice list with key fields
    signature_chain.pem  ← cert chain used by the tenant
    README.md            ← auditor instructions (Arabic + English)

The ZIP is uploaded to Cloud Storage at:

    tenant-exports/{tenant_id}/efakhata/{YYYY-MM-DD}-{batch}.zip

and a 7-day signed URL is returned. The batch document is stored at
``efakhata_export_batches/{batch_id}`` for status polling.
"""
from __future__ import annotations

import csv
import io
import logging
import uuid
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

from app.firestore.base import BaseRepository

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Batch repository
# ─────────────────────────────────────────────────────────────────────────────


class AuditorExportBatchRepository(BaseRepository):
    """Tracks a single ZIP export job."""

    collection_name = "efakhata_export_batches"


# ─────────────────────────────────────────────────────────────────────────────
# Builders
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class _ManifestRow:
    invoice_id: str
    invoice_number: str
    issue_date: str
    customer_name: str
    grand_total: str
    currency: str
    status: str
    mof_ack_number: str


def build_zip(
    *,
    tenant_id: str,
    start_date: date,
    end_date: date,
    submissions: list[dict],
    invoice_lookup,
    pdf_renderer=None,
    signature_chain_pem: Optional[bytes] = None,
) -> bytes:
    """Build the ZIP in-memory.

    Args:
        submissions       — queue records for the range
        invoice_lookup    — callable(invoice_id) → invoice dict
        pdf_renderer      — callable(invoice_dict) → bytes (optional)
        signature_chain_pem — bytes for the cert chain file (optional)
    """
    buf = io.BytesIO()
    manifest: list[_ManifestRow] = []

    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for sub in submissions:
            invoice_id = sub.get("invoice_id") or ""
            invoice = invoice_lookup(invoice_id) or {}

            # signed XML
            xml = sub.get("xml_signed") or ""
            if isinstance(xml, str):
                xml_bytes = xml.encode("utf-8")
            else:
                xml_bytes = xml
            number = invoice.get("invoice_number") or invoice_id
            zf.writestr(f"invoices/{_safe(number)}.xml", xml_bytes)

            # PDF (best-effort — never blocks the bundle)
            if pdf_renderer is not None:
                try:
                    pdf_bytes = pdf_renderer(invoice)
                    if pdf_bytes:
                        zf.writestr(f"invoices/{_safe(number)}.pdf", pdf_bytes)
                except Exception:
                    logger.exception("efakhata_export_pdf_failed",
                                     extra={"invoice_id": invoice_id})

            manifest.append(
                _ManifestRow(
                    invoice_id=invoice_id,
                    invoice_number=str(number),
                    issue_date=str(invoice.get("date") or invoice.get("issue_date") or ""),
                    customer_name=str(invoice.get("contact_name") or ""),
                    grand_total=str(invoice.get("total") or invoice.get("grand_total") or "0"),
                    currency=str(invoice.get("currency_code") or "IQD"),
                    status=str(sub.get("status") or ""),
                    mof_ack_number=str(sub.get("mof_ack_number") or ""),
                )
            )

        # manifest.csv
        csv_buf = io.StringIO()
        writer = csv.writer(csv_buf)
        writer.writerow([
            "invoice_id", "invoice_number", "issue_date", "customer_name",
            "grand_total", "currency", "status", "mof_ack_number",
        ])
        for row in manifest:
            writer.writerow([
                row.invoice_id, row.invoice_number, row.issue_date,
                row.customer_name, row.grand_total, row.currency,
                row.status, row.mof_ack_number,
            ])
        zf.writestr("manifest.csv", csv_buf.getvalue())

        # signature_chain.pem
        if signature_chain_pem:
            zf.writestr("signature_chain.pem", signature_chain_pem)

        # README.md (Arabic + English)
        zf.writestr("README.md", _README_TEMPLATE.format(
            tenant_id=tenant_id,
            start=start_date.isoformat(),
            end=end_date.isoformat(),
            count=len(manifest),
            generated=datetime.utcnow().isoformat(timespec="seconds"),
        ))

    return buf.getvalue()


def upload_zip_to_gcs(
    *,
    tenant_id: str,
    zip_bytes: bytes,
    batch_id: str,
    signed_url_days: int = 7,
) -> tuple[str, str]:
    """Upload ZIP and return (gcs_path, signed_url)."""
    from app.firebase_client import get_bucket

    bucket = get_bucket()
    today = datetime.utcnow().strftime("%Y-%m-%d")
    path = f"tenant-exports/{tenant_id}/efakhata/{today}-{batch_id}.zip"
    blob = bucket.blob(path)
    blob.upload_from_string(zip_bytes, content_type="application/zip")
    signed_url = blob.generate_signed_url(expiration=timedelta(days=signed_url_days))
    return path, signed_url


# ─────────────────────────────────────────────────────────────────────────────
# High-level orchestrator
# ─────────────────────────────────────────────────────────────────────────────


def create_export_batch(
    *,
    tenant_id: str,
    start_date: date,
    end_date: date,
    requested_by: str,
) -> dict:
    """Create the batch record in ``pending`` state. The actual building
    is performed by ``run_export_batch`` (intended to be called from a
    background task / Cloud Task)."""
    repo = AuditorExportBatchRepository(tenant_id)
    batch_id = str(uuid.uuid4())
    record = repo.create({
        "id": batch_id,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "status": "pending",
        "requested_by": requested_by,
        "gcs_path": None,
        "signed_url": None,
        "signed_url_expires_at": None,
        "invoice_count": 0,
    })
    return record


def run_export_batch(*, tenant_id: str, batch_id: str, invoice_lookup,
                     pdf_renderer=None, signature_chain_pem: Optional[bytes] = None) -> dict:
    """Build the ZIP, upload it, and flip the batch to ``ready``."""
    from app.efakhata.submission_queue import SubmissionQueueRepository

    batch_repo = AuditorExportBatchRepository(tenant_id)
    batch = batch_repo.get(batch_id)
    if not batch:
        raise ValueError(f"batch_not_found:{batch_id}")

    start = date.fromisoformat(batch["start_date"])
    end = date.fromisoformat(batch["end_date"])

    q_repo = SubmissionQueueRepository(tenant_id)
    # Pull all submissions in the date range — we keep this simple and
    # filter in-memory because the typical month-end batch is < 10k rows.
    all_subs, _ = q_repo.list(limit=10_000)
    in_range = []
    for s in all_subs:
        created = s.get("created_at")
        if isinstance(created, str):
            try:
                created = datetime.fromisoformat(created).date()
            except Exception:
                created = None
        elif isinstance(created, datetime):
            created = created.date()
        if created is None or start <= created <= end:
            in_range.append(s)

    zip_bytes = build_zip(
        tenant_id=tenant_id,
        start_date=start,
        end_date=end,
        submissions=in_range,
        invoice_lookup=invoice_lookup,
        pdf_renderer=pdf_renderer,
        signature_chain_pem=signature_chain_pem,
    )

    gcs_path, signed_url = upload_zip_to_gcs(
        tenant_id=tenant_id, zip_bytes=zip_bytes, batch_id=batch_id,
    )

    expires = datetime.utcnow() + timedelta(days=7)
    return batch_repo.update(batch_id, {
        "status": "ready",
        "gcs_path": gcs_path,
        "signed_url": signed_url,
        "signed_url_expires_at": expires.isoformat(),
        "invoice_count": len(in_range),
        "completed_at": datetime.utcnow().isoformat(),
    })


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _safe(name: str) -> str:
    """Filename-safe slug — no path separators, no parent-dir traversal.

    Slashes/backslashes become ``_`` and any run of dots is collapsed so a
    crafted invoice number like ``../etc/passwd`` cannot escape the
    ``invoices/`` prefix inside the ZIP.
    """
    slug = "".join(c if c.isalnum() or c in "-_." else "_" for c in str(name))
    while ".." in slug:
        slug = slug.replace("..", "_")
    return slug.strip("._")[:80] or "unnamed"


_README_TEMPLATE = """# Iraq e-Fakhata Auditor Export

**Tenant:** {tenant_id}
**Range:** {start} → {end}
**Invoices:** {count}
**Generated:** {generated} UTC

## Contents

- `invoices/*.xml` — signed XAdES-BES e-Fakhata XML envelopes
- `invoices/*.pdf` — human-readable PDF renderings (Arabic)
- `manifest.csv` — flat invoice index for spreadsheet reconciliation
- `signature_chain.pem` — certificate chain used for signing

## Verification

Each XML file is a XAdES-BES signed envelope. To verify a signature
offline, use any compliant XML-DSig verifier with `signature_chain.pem`
as the trust anchor.

## ناوەڕۆکی فایلەکان (کوردی)

ئەم زیپە بریتیە لە هەموو فاکتورە ئەلیکترۆنیەکانی پشتڕاستکراو لە
ماوەی {start} بۆ {end}.
"""
