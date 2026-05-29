"""Shared Firestore transaction helpers."""
from __future__ import annotations


class TenantMismatchError(ValueError):
    pass


def assert_org_doc(data: dict | None, org_id: str, *, label: str = "document") -> dict:
    if not data:
        raise TenantMismatchError(f"{label}_not_found")
    if data.get("org_id") != org_id:
        raise TenantMismatchError(f"{label}_org_mismatch")
    return data
