"""Prefix search spike (P3) — Firestore range queries, no external index."""
from __future__ import annotations

from typing import Any

from app.firebase_client import get_db


def _prefix_end(term: str) -> str:
    return term + "\uf8ff"


def _prefix_query(
    collection: str,
    org_id: str,
    field: str,
    term: str,
    *,
    limit: int = 25,
) -> list[dict]:
    if not term or len(term) < 2:
        return []
    db = get_db()
    q = (
        db.collection(collection)
        .where("org_id", "==", org_id)
        .where(field, ">=", term)
        .where(field, "<=", _prefix_end(term))
        .limit(limit)
    )
    return [{"id": d.id, **d.to_dict()} for d in q.stream()]


def search_items(org_id: str, term: str, *, limit: int = 25) -> list[dict]:
    """Search items by name prefix; fallback SKU prefix merge."""
    term_l = term.strip().lower()
    by_id: dict[str, dict] = {}
    for field in ("name", "sku"):
        for doc in _prefix_query("items", org_id, field, term_l, limit=limit):
            if doc.get("deleted_at"):
                continue
            if doc.get("is_active") is False:
                continue
            by_id[doc["id"]] = doc
            if len(by_id) >= limit:
                break
        if len(by_id) >= limit:
            break
    return list(by_id.values())[:limit]


def search_contacts(org_id: str, term: str, *, limit: int = 25) -> list[dict]:
    term_l = term.strip().lower()
    results: list[dict] = []
    for field in ("name", "email"):
        for doc in _prefix_query("contacts", org_id, field, term_l, limit=limit):
            if doc.get("deleted_at"):
                continue
            results.append(doc)
            if len(results) >= limit:
                return results[:limit]
    return results[:limit]


def unified_search(
    org_id: str,
    term: str,
    *,
    types: list[str] | None = None,
    limit: int = 25,
) -> dict[str, Any]:
    wanted = {t.strip().lower() for t in (types or ["items", "contacts"])}
    out: dict[str, Any] = {"query": term, "results": {}}
    if "items" in wanted:
        out["results"]["items"] = search_items(org_id, term, limit=limit)
    if "contacts" in wanted:
        out["results"]["contacts"] = search_contacts(org_id, term, limit=limit)
    return out
