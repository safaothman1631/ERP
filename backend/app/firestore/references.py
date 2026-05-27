"""Foreign-key catalogue for referential integrity (Wave R)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

OnDelete = Literal["restrict", "set_null", "cascade", "soft_cascade"]


@dataclass(frozen=True)
class FK:
    field: str
    target: str
    on_delete: OnDelete = "restrict"


REFERENCES: dict[str, list[FK]] = {
    "invoices": [FK("contact_id", "contacts")],
    "bills": [FK("vendor_id", "contacts"), FK("contact_id", "contacts", "set_null")],
    "credit_notes": [
        FK("contact_id", "contacts"),
        FK("invoice_id", "invoices", "set_null"),
    ],
    "payments_received": [
        FK("contact_id", "contacts"),
        FK("invoice_id", "invoices", "set_null"),
    ],
    "payments_made": [
        FK("vendor_id", "contacts", "set_null"),
        FK("bill_id", "bills", "set_null"),
    ],
    "expenses": [FK("contact_id", "contacts", "set_null")],
    "quotes": [FK("contact_id", "contacts")],
    "sales_orders": [FK("contact_id", "contacts")],
    "purchase_orders": [FK("vendor_id", "contacts", "set_null")],
    "items": [],
    "accounts": [FK("parent_id", "accounts", "set_null")],
    "stock_movements": [FK("item_id", "items")],
}


def build_reversed() -> dict[str, list[tuple[str, str, OnDelete]]]:
    rev: dict[str, list[tuple[str, str, OnDelete]]] = {}
    for source, fks in REFERENCES.items():
        for fk in fks:
            rev.setdefault(fk.target, []).append((source, fk.field, fk.on_delete))
    return rev


REVERSED: dict[str, list[tuple[str, str, OnDelete]]] = build_reversed()


class ReferenceConflict(Exception):
    def __init__(self, target: str, doc_id: str, referenced_by: list[dict]):
        self.target = target
        self.doc_id = doc_id
        self.referenced_by = referenced_by
        super().__init__(f"reference_conflict:{target}:{doc_id}")
