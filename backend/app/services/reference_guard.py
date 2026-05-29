"""Check live references before delete (Wave R)."""
from __future__ import annotations

from app.firestore.references import REVERSED


def find_blocking_references(org_id: str, target_collection: str, target_id: str) -> list[dict]:
    """Return list of {collection, id, field} for restrict FKs still pointing at target."""
    from app.firebase_client import get_db

    db = get_db()
    blockers: list[dict] = []
    for source_coll, field, on_delete in REVERSED.get(target_collection, []):
        if on_delete != "restrict":
            continue
        query = (
            db.collection(source_coll)
            .where("org_id", "==", org_id)
            .where(field, "==", target_id)
            .limit(5)
        )
        for doc in query.stream():
            data = doc.to_dict() or {}
            if data.get("deleted_at"):
                continue
            blockers.append({"collection": source_coll, "id": doc.id, "field": field})
    return blockers


def find_soft_delete_blockers(org_id: str, target_collection: str, target_id: str) -> list[dict]:
    """Block soft-delete/deactivate when restrict FKs still reference the document."""
    return find_blocking_references(org_id, target_collection, target_id)


def _item_in_line_subcollections(
    db,
    org_id: str,
    parent_collection: str,
    item_id: str,
    *,
    scan_limit: int = 100,
) -> list[dict]:
    blockers: list[dict] = []
    try:
        for parent in db.collection(parent_collection).where("org_id", "==", org_id).limit(scan_limit).stream():
            if (parent.to_dict() or {}).get("deleted_at"):
                continue
            for _line in parent.reference.collection("lines").where("item_id", "==", item_id).limit(1).stream():
                blockers.append({
                    "collection": parent_collection,
                    "id": parent.id,
                    "field": "lines.item_id",
                })
                return blockers
    except Exception:
        pass
    return blockers


def find_item_usage_blockers(org_id: str, item_id: str, *, invoice_scan_limit: int = 100) -> list[dict]:
    """Extend item checks to line sub-collections on invoices and bills (Wave R)."""
    blockers = find_blocking_references(org_id, "items", item_id)
    if blockers:
        return blockers
    from app.firebase_client import get_db

    db = get_db()
    for coll in ("invoices", "bills", "quotes", "sales_orders", "purchase_orders"):
        blockers = _item_in_line_subcollections(
            db, org_id, coll, item_id, scan_limit=invoice_scan_limit
        )
        if blockers:
            return blockers
    return blockers
