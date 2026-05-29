"""Tenant hardware registry API.

Stores per-tenant paired hardware (printers, scanners, drawers, displays)
in Firestore under `tenants/{tid}/hardware/{type}/{id}`.

Spec: growth-to-100/requirements.md R3.3 (per-printer command profiles),
      R3.15 (reset to defaults).

Endpoints:
    GET    /api/tenants/{tid}/hardware/printers
    PUT    /api/tenants/{tid}/hardware/printers/{id}
    DELETE /api/tenants/{tid}/hardware/printers/{id}
    (same for scanners, drawers, displays)
    POST   /api/tenants/{tid}/hardware/reset-defaults
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.services.auth import get_current_user

router = APIRouter(prefix="/api/tenants", tags=["Tenant Hardware"])


# ──────────────────────────── Schemas ──────────────────────────────────

DialectId = Literal[
    "escpos-epson",
    "escpos-xprinter",
    "escpos-bixolon",
    "escpos-generic-58",
    "escpos-generic-80",
    "escpos-unknown",
]

ConnectionMethod = Literal["bluetooth", "usb", "serial", "wifi", "native-ble"]


class PrinterEntry(BaseModel):
    """Paired printer record."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    dialect_id: DialectId
    connection: ConnectionMethod
    transport_id: str  # BLE MAC, USB vendor:product:serial, IP, COM port
    paper_width_mm: Literal[58, 80] = 80
    is_default: bool = False
    drawer_pin: Optional[Literal[2, 5]] = None
    drawer_pulse_on_ms: Optional[int] = None
    drawer_pulse_off_ms: Optional[int] = None
    code_page: Optional[str] = None
    notes: Optional[str] = None
    last_test_print_at: Optional[str] = None


class ScannerEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    category: Literal["hid-usb", "hid-bluetooth", "camera"]
    is_default: bool = False
    min_length: int = 6
    max_inter_key_ms: int = 60
    notes: Optional[str] = None


class DrawerEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    pin: Literal[2, 5]
    pulse_on_ms: int = 50
    pulse_off_ms: int = 150
    fires_via_printer_id: Optional[str] = None  # foreign key to PrinterEntry.id
    notes: Optional[str] = None


class DisplayEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    connection: Literal["serial", "bluetooth", "wifi"]
    endpoint: Optional[str] = None
    cols: Optional[int] = None
    rows: Optional[int] = None
    terminal_id: Optional[str] = None
    notes: Optional[str] = None


class HardwareBundle(BaseModel):
    printers: list[PrinterEntry] = Field(default_factory=list)
    scanners: list[ScannerEntry] = Field(default_factory=list)
    drawers: list[DrawerEntry] = Field(default_factory=list)
    displays: list[DisplayEntry] = Field(default_factory=list)


# ──────────────────────────── Storage layer ────────────────────────────
#
# We try Firestore first; if unavailable (no Firebase in dev env), we fall
# back to an in-process dict keyed by tenant_id. The fallback ensures the
# endpoint can be exercised in unit tests without Firebase credentials.

_MEMORY: dict[str, dict[str, list[dict[str, Any]]]] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _firestore_doc(tenant_id: str, kind: str, doc_id: str):
    try:
        from app.firebase_client import get_db

        db = get_db()
        if db is None:
            return None
        return db.collection("tenants").document(tenant_id).collection("hardware").document(kind).collection("items").document(doc_id)
    except Exception:
        return None


def _firestore_collection(tenant_id: str, kind: str):
    try:
        from app.firebase_client import get_db

        db = get_db()
        if db is None:
            return None
        return db.collection("tenants").document(tenant_id).collection("hardware").document(kind).collection("items")
    except Exception:
        return None


def _list_kind(tenant_id: str, kind: str) -> list[dict[str, Any]]:
    coll = _firestore_collection(tenant_id, kind)
    if coll is not None:
        try:
            return [doc.to_dict() | {"id": doc.id} for doc in coll.stream()]
        except Exception:
            pass
    return list(_MEMORY.get(tenant_id, {}).get(kind, []))


def _put_kind(tenant_id: str, kind: str, entry: dict[str, Any]) -> dict[str, Any]:
    entry = {**entry, "updated_at": _now_iso()}
    doc = _firestore_doc(tenant_id, kind, entry["id"])
    if doc is not None:
        try:
            doc.set(entry)
            return entry
        except Exception:
            pass
    bucket = _MEMORY.setdefault(tenant_id, {}).setdefault(kind, [])
    # Replace in place if exists; else append.
    for i, existing in enumerate(bucket):
        if existing.get("id") == entry["id"]:
            bucket[i] = entry
            return entry
    bucket.append(entry)
    return entry


def _delete_kind(tenant_id: str, kind: str, doc_id: str) -> bool:
    doc = _firestore_doc(tenant_id, kind, doc_id)
    if doc is not None:
        try:
            doc.delete()
            # Also evict in-memory in case both layers are populated.
        except Exception:
            pass
    bucket = _MEMORY.get(tenant_id, {}).get(kind, [])
    before = len(bucket)
    _MEMORY.setdefault(tenant_id, {})[kind] = [b for b in bucket if b.get("id") != doc_id]
    return len(_MEMORY.get(tenant_id, {}).get(kind, [])) != before or doc is not None


def _check_tenant_access(user: dict, tid: str) -> None:
    """Ensure the caller belongs to the tenant they're operating on."""
    if user.get("org_id") and user["org_id"] != tid:
        raise HTTPException(status_code=403, detail="cross_tenant_access_denied")


def _flip_default(tenant_id: str, kind: str, new_default_id: str) -> None:
    """When a record is marked is_default=True, demote the previous default."""
    bucket = _list_kind(tenant_id, kind)
    for entry in bucket:
        if entry.get("is_default") and entry.get("id") != new_default_id:
            entry["is_default"] = False
            _put_kind(tenant_id, kind, entry)


# ──────────────────────────── Printers ─────────────────────────────────


@router.get("/{tid}/hardware/printers")
def list_printers(tid: str, user: dict = Depends(get_current_user)) -> list[dict[str, Any]]:
    _check_tenant_access(user, tid)
    return _list_kind(tid, "printers")


@router.put("/{tid}/hardware/printers/{printer_id}")
def upsert_printer(
    tid: str,
    printer_id: str,
    body: PrinterEntry,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    _check_tenant_access(user, tid)
    entry = body.model_dump()
    entry["id"] = printer_id
    saved = _put_kind(tid, "printers", entry)
    if entry.get("is_default"):
        _flip_default(tid, "printers", printer_id)
    return saved


@router.delete("/{tid}/hardware/printers/{printer_id}")
def delete_printer(tid: str, printer_id: str, user: dict = Depends(get_current_user)) -> dict[str, str]:
    _check_tenant_access(user, tid)
    _delete_kind(tid, "printers", printer_id)
    return {"status": "deleted"}


# ──────────────────────────── Scanners ─────────────────────────────────


@router.get("/{tid}/hardware/scanners")
def list_scanners(tid: str, user: dict = Depends(get_current_user)) -> list[dict[str, Any]]:
    _check_tenant_access(user, tid)
    return _list_kind(tid, "scanners")


@router.put("/{tid}/hardware/scanners/{scanner_id}")
def upsert_scanner(
    tid: str,
    scanner_id: str,
    body: ScannerEntry,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    _check_tenant_access(user, tid)
    entry = body.model_dump()
    entry["id"] = scanner_id
    saved = _put_kind(tid, "scanners", entry)
    if entry.get("is_default"):
        _flip_default(tid, "scanners", scanner_id)
    return saved


@router.delete("/{tid}/hardware/scanners/{scanner_id}")
def delete_scanner(tid: str, scanner_id: str, user: dict = Depends(get_current_user)) -> dict[str, str]:
    _check_tenant_access(user, tid)
    _delete_kind(tid, "scanners", scanner_id)
    return {"status": "deleted"}


# ──────────────────────────── Drawers ──────────────────────────────────


@router.get("/{tid}/hardware/drawers")
def list_drawers(tid: str, user: dict = Depends(get_current_user)) -> list[dict[str, Any]]:
    _check_tenant_access(user, tid)
    return _list_kind(tid, "drawers")


@router.put("/{tid}/hardware/drawers/{drawer_id}")
def upsert_drawer(
    tid: str,
    drawer_id: str,
    body: DrawerEntry,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    _check_tenant_access(user, tid)
    entry = body.model_dump()
    entry["id"] = drawer_id
    return _put_kind(tid, "drawers", entry)


@router.delete("/{tid}/hardware/drawers/{drawer_id}")
def delete_drawer(tid: str, drawer_id: str, user: dict = Depends(get_current_user)) -> dict[str, str]:
    _check_tenant_access(user, tid)
    _delete_kind(tid, "drawers", drawer_id)
    return {"status": "deleted"}


# ──────────────────────────── Displays ─────────────────────────────────


@router.get("/{tid}/hardware/displays")
def list_displays(tid: str, user: dict = Depends(get_current_user)) -> list[dict[str, Any]]:
    _check_tenant_access(user, tid)
    return _list_kind(tid, "displays")


@router.put("/{tid}/hardware/displays/{display_id}")
def upsert_display(
    tid: str,
    display_id: str,
    body: DisplayEntry,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    _check_tenant_access(user, tid)
    entry = body.model_dump()
    entry["id"] = display_id
    return _put_kind(tid, "displays", entry)


@router.delete("/{tid}/hardware/displays/{display_id}")
def delete_display(tid: str, display_id: str, user: dict = Depends(get_current_user)) -> dict[str, str]:
    _check_tenant_access(user, tid)
    _delete_kind(tid, "displays", display_id)
    return {"status": "deleted"}


# ──────────────────────────── Bundle + reset ───────────────────────────


@router.get("/{tid}/hardware")
def get_full_bundle(tid: str, user: dict = Depends(get_current_user)) -> dict[str, list[dict[str, Any]]]:
    _check_tenant_access(user, tid)
    return {
        "printers": _list_kind(tid, "printers"),
        "scanners": _list_kind(tid, "scanners"),
        "drawers": _list_kind(tid, "drawers"),
        "displays": _list_kind(tid, "displays"),
    }


@router.post("/{tid}/hardware/reset-defaults")
def reset_defaults(tid: str, user: dict = Depends(get_current_user)) -> dict[str, int]:
    """R3.15 — wipe all paired hardware for the tenant, return counts removed."""
    _check_tenant_access(user, tid)
    counts: dict[str, int] = {}
    for kind in ("printers", "scanners", "drawers", "displays"):
        entries = _list_kind(tid, kind)
        for e in entries:
            _delete_kind(tid, kind, e["id"])
        counts[kind] = len(entries)
    return counts


# Expose all routers for main.py registration (matches launch-readiness convention).
ALL_ROUTERS = [router]
