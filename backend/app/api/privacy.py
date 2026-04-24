"""Sprint 18: Privacy & GDPR endpoints (FIX-251..260).

- Data export (right to data portability)
- Anonymization request (right to be forgotten — soft delete with PII scrubbing)
- Audit log integrity check (basic chain validation)
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.firestore.contacts import ContactRepository
from app.firestore.invoices import InvoiceRepository
from app.firestore.bills import BillRepository
from app.firestore.system import AuditLogRepository
from app.services.auth import get_current_user
from app.services.permissions import require_perm

router = APIRouter(prefix="/api/privacy", tags=["Privacy / GDPR"])


# ──────────────────────────── Data Export ────────────────────────────

@router.get("/data-export/contact/{contact_id}",
            dependencies=[Depends(require_perm("contacts.read"))])
def export_contact_data(contact_id: str, user: dict = Depends(get_current_user)):
    """FIX-251: GDPR-compliant export of all data linked to a contact (right to portability).

    Returns the contact record plus all related invoices and bills, JSON-serializable.
    """
    org = user["org_id"]
    contact = ContactRepository(org).get(contact_id)
    if not contact or contact.get("org_id") != org:
        raise HTTPException(404, "contact not found")
    invoices, _ = InvoiceRepository(org).list(filters=[
        {"field": "contact_id", "op": "==", "value": contact_id},
    ], limit=2000)
    bills, _ = BillRepository(org).list(filters=[
        {"field": "contact_id", "op": "==", "value": contact_id},
    ], limit=2000)
    return {
        "exported_at": datetime.utcnow().isoformat(),
        "exported_by_id": user["id"],
        "contact": contact,
        "invoices": invoices,
        "bills": bills,
        "counts": {
            "invoices": len(invoices),
            "bills": len(bills),
        },
    }


# ──────────────────────────── Anonymization (Right to be forgotten) ────────────────────────────

class AnonymizeRequest(BaseModel):
    reason: Optional[str] = None
    confirm: bool = False


@router.post("/anonymize/contact/{contact_id}",
             dependencies=[Depends(require_perm("contacts.delete"))])
def anonymize_contact(contact_id: str, data: AnonymizeRequest,
                      user: dict = Depends(get_current_user)):
    """FIX-252: Scrub PII fields on a contact (name → 'ANON-xxxx', email/phone → null) but keep
    transactional records (invoices, bills) for legal/accounting compliance.
    """
    if not data.confirm:
        raise HTTPException(400, "confirm=true پێویستە")
    org = user["org_id"]
    repo = ContactRepository(org)
    c = repo.get(contact_id)
    if not c or c.get("org_id") != org:
        raise HTTPException(404, "contact not found")
    anon_id = f"ANON-{contact_id[:8].upper()}"
    return repo.update(contact_id, {
        "name": anon_id,
        "display_name": anon_id,
        "email": None,
        "phone": None,
        "mobile": None,
        "address": None,
        "tax_id": None,
        "anonymized": True,
        "anonymized_at": datetime.utcnow().isoformat(),
        "anonymized_by_id": user["id"],
        "anonymization_reason": data.reason,
    })


# ──────────────────────────── Audit log integrity ────────────────────────────

@router.get("/audit-integrity",
            dependencies=[Depends(require_perm("audit.read"))])
def audit_integrity_check(limit: int = 1000, user: dict = Depends(get_current_user)):
    """FIX-253: Basic audit-log integrity check — verifies count, time-monotonic order, and
    surfaces gaps where created_at is null or out-of-order (an indicator of tampering).
    """
    org = user["org_id"]
    repo = AuditLogRepository(org)
    items, total = repo.list(limit=limit, order_by="created_at", order_dir="DESCENDING")
    issues = []
    last_ts = None
    null_ts_count = 0
    for it in items:
        ts = it.get("created_at") or it.get("timestamp")
        if not ts:
            null_ts_count += 1
            issues.append({"id": it.get("id"), "issue": "missing timestamp"})
            continue
        if last_ts is not None and str(ts) > str(last_ts):
            issues.append({"id": it.get("id"), "issue": "out-of-order"})
        last_ts = ts
    return {
        "checked_at": datetime.utcnow().isoformat(),
        "scanned": len(items),
        "total_in_db": total,
        "issues_found": len(issues),
        "null_timestamp_count": null_ts_count,
        "issues": issues[:50],
        "ok": len(issues) == 0,
    }


@router.get("/data-export/me")
def export_my_data(user: dict = Depends(get_current_user)):
    """FIX-254: Self-service data export for the currently authenticated user."""
    return {
        "exported_at": datetime.utcnow().isoformat(),
        "user_id": user["id"],
        "user": {k: v for k, v in user.items() if k not in ("password", "password_hash")},
        "org_id": user["org_id"],
        "scope": "self",
    }
