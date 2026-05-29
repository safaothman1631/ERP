"""Built-in migrations for production collections.

Add new migrations here; they are auto-registered on import.
"""
from __future__ import annotations

from . import register


def _contacts_v1_to_v2(doc: dict) -> dict:
    if "display_name_lower" not in doc:
        name = (doc.get("display_name") or doc.get("name") or "").strip().lower()
        if name:
            doc["display_name_lower"] = name
    return doc


def _invoices_v1_to_v2(doc: dict) -> dict:
    doc.setdefault("currency_code", "IQD")
    if "balance_due" not in doc and doc.get("total") is not None and doc.get("status") in (None, "draft"):
        doc["balance_due"] = float(doc["total"])
    return doc


def _bills_v1_to_v2(doc: dict) -> dict:
    doc.setdefault("currency_code", "IQD")
    return doc


register("contacts", 2, _contacts_v1_to_v2)
register("invoices", 2, _invoices_v1_to_v2)
register("bills", 2, _bills_v1_to_v2)
