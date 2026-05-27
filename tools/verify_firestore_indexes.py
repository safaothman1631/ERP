#!/usr/bin/env python3
"""Verify firestore.indexes.json collectionGroup names match BaseRepository collections."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIRESTORE_DIR = ROOT / "backend" / "app" / "firestore"
INDEXES_FILE = ROOT / "firestore.indexes.json"

KNOWN_ALIASES = {"stock_moves": "stock_movements"}


def repo_collections() -> set[str]:
    names: set[str] = set()
    for path in FIRESTORE_DIR.glob("*.py"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r'collection_name\s*=\s*["\']([a-z_0-9]+)["\']', text):
            names.add(m.group(1))
    return names


def index_collections() -> set[str]:
    data = json.loads(INDEXES_FILE.read_text(encoding="utf-8"))
    return {idx["collectionGroup"] for idx in data.get("indexes", [])}


def index_order_shapes() -> list[tuple[str, tuple[str, ...]]]:
    """(collectionGroup, field names in index order)."""
    data = json.loads(INDEXES_FILE.read_text(encoding="utf-8"))
    shapes: list[tuple[str, tuple[str, ...]]] = []
    for idx in data.get("indexes", []):
        cg = idx.get("collectionGroup", "")
        fields = tuple(f.get("fieldPath", "") for f in idx.get("fields", []) if f.get("fieldPath"))
        if cg and fields:
            shapes.append((cg, fields))
    return shapes


def main() -> int:
    repos = repo_collections()
    indexes = index_collections()
    errors: list[str] = []
    for ig in sorted(indexes):
        if ig in repos or ig in KNOWN_ALIASES or ig in KNOWN_ALIASES.values():
            continue
        if ig.startswith("crm_") or ig == "journal_entries":
            continue
        errors.append(f"index collectionGroup '{ig}' has no matching BaseRepository")
    for alias, canonical in KNOWN_ALIASES.items():
        if alias in indexes and canonical in repos:
            errors.append(f"deprecated index name '{alias}' — use '{canonical}'")
    shapes = index_order_shapes()
    dup_shapes: list[str] = []
    seen: set[tuple[str, tuple[str, ...]]] = set()
    for cg, fields in shapes:
        key = (cg, fields)
        if key in seen:
            dup_shapes.append(f"{cg}:{'+'.join(fields)}")
        seen.add(key)

    if dup_shapes:
        for d in dup_shapes[:5]:
            errors.append(f"duplicate index shape {d}")

    if errors:
        for e in errors:
            print("ERROR:", e, file=sys.stderr)
        return 1
    print(
        f"OK: {len(indexes)} index groups, {len(shapes)} order shapes "
        f"checked against {len(repos)} repositories"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
