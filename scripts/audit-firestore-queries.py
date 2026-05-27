#!/usr/bin/env python3
"""Audit Firestore query usage vs the deployed composite-index manifest (P4 / R5.2).

Walks Python sources under ``backend/app/api/`` (configurable), extracts every
``.where(...).order_by(...).limit(...)`` chain via AST, normalises it into a
``(collection, [field…], order_field, order_dir)`` tuple, then compares it to
the indexes declared in ``firestore.indexes.json``.

Outputs
-------
- Markdown report on stdout (human-readable).
- ``audit/firestore-query-audit.json`` (machine-readable) — JSON list of
  ``{collection, where_fields, order_by, matched, source}`` objects.

Exit codes
----------
- ``0`` — every multi-field query has a matching composite index.
- ``1`` — one or more queries lack a matching index (CI gate).

Use
---
::

    python scripts/audit-firestore-queries.py
    python scripts/audit-firestore-queries.py --check  # CI mode
    python scripts/audit-firestore-queries.py --root backend/app/api --indexes firestore.indexes.json
"""
from __future__ import annotations

import argparse
import ast
import json
import os
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Iterator, Optional


# ── Data classes ────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class QueryUsage:
    """A normalised Firestore query as found in code."""

    collection: str
    where_fields: tuple[str, ...]
    order_by: Optional[str]
    order_dir: Optional[str]  # 'asc' | 'desc' | None
    source: str  # "path:line"

    def to_dict(self) -> dict:
        return {
            "collection": self.collection,
            "where_fields": list(self.where_fields),
            "order_by": self.order_by,
            "order_dir": self.order_dir,
            "source": self.source,
        }


@dataclass
class IndexEntry:
    """One composite index from firestore.indexes.json."""

    collection: str
    fields: list[tuple[str, str]]  # (field_path, direction lower)
    query_scope: str = "COLLECTION"


@dataclass
class AuditReport:
    usages: list[QueryUsage] = field(default_factory=list)
    indexes: list[IndexEntry] = field(default_factory=list)
    matched: list[QueryUsage] = field(default_factory=list)
    unmatched: list[QueryUsage] = field(default_factory=list)
    skipped_single_field: int = 0


# ── AST extraction ──────────────────────────────────────────────────────────


def _const_str(node: ast.AST) -> Optional[str]:
    """Return a constant string from an AST node, or None."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _collection_name_from_chain(node: ast.AST) -> Optional[str]:
    """Return the collection name from a chain like ``db.collection('x').where(...)``.

    Walks back through ``.where`` / ``.order_by`` / ``.limit`` calls to find
    the ``.collection('name')`` call.
    """
    cur: ast.AST = node
    while isinstance(cur, ast.Call):
        func = cur.func
        if isinstance(func, ast.Attribute):
            if func.attr == "collection" and cur.args:
                name = _const_str(cur.args[0])
                if name:
                    return name
            cur = func.value
        else:
            break
    return None


def _extract_query_from_call(call: ast.Call, path: str) -> Optional[QueryUsage]:
    """If ``call`` is a Firestore query chain, normalise it."""
    where_fields: list[str] = []
    order_field: Optional[str] = None
    order_dir: Optional[str] = None
    collection: Optional[str] = None

    cur: ast.AST = call
    while isinstance(cur, ast.Call):
        func = cur.func
        if not isinstance(func, ast.Attribute):
            break
        if func.attr == "where" and cur.args:
            f = _const_str(cur.args[0])
            if f:
                where_fields.append(f)
        elif func.attr == "order_by" and cur.args:
            order_field = _const_str(cur.args[0]) or order_field
            # Default to ASC if no kwarg given; "DESCENDING"/Query.DESCENDING means desc.
            for kw in cur.keywords or ():
                if kw.arg == "direction":
                    val = ast.unparse(kw.value) if hasattr(ast, "unparse") else ""
                    if "DESCENDING" in val or "'desc" in val.lower():
                        order_dir = "desc"
                    else:
                        order_dir = "asc"
        elif func.attr == "limit":
            pass  # limit doesn't affect index requirements
        elif func.attr == "collection":
            if cur.args:
                collection = _const_str(cur.args[0]) or collection
            break
        cur = func.value

    if collection is None:
        # Try the chain head separately (sometimes the chain is built differently)
        collection = _collection_name_from_chain(call)

    if collection is None or not where_fields:
        return None  # not a query we can analyse

    return QueryUsage(
        collection=collection,
        where_fields=tuple(reversed(where_fields)),  # left-to-right call order
        order_by=order_field,
        order_dir=order_dir or ("asc" if order_field else None),
        source=path,
    )


def _walk_calls(tree: ast.AST) -> Iterator[ast.Call]:
    """Yield Call nodes that have a `where`, `order_by`, or `limit` method in chain."""
    interest = {"where", "order_by", "limit"}
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr in interest:
                yield node


def scan_file(path: Path) -> list[QueryUsage]:
    """Extract every analysable query from a single Python file."""
    try:
        src = path.read_text(encoding="utf-8")
        tree = ast.parse(src)
    except (OSError, SyntaxError):
        return []
    out: list[QueryUsage] = []
    seen: set[tuple] = set()
    for call in _walk_calls(tree):
        qu = _extract_query_from_call(call, f"{path}:{call.lineno}")
        if qu is None:
            continue
        # Deduplicate by (collection, where_fields, order_by) so a chain
        # doesn't get reported once per intermediate Call.
        key = (qu.collection, qu.where_fields, qu.order_by, qu.order_dir)
        if key in seen:
            continue
        seen.add(key)
        out.append(qu)
    return out


def iter_python_files(root: Path) -> Iterator[Path]:
    skip = {"venv", ".venv", "__pycache__", "node_modules", ".git"}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip]
        for fn in filenames:
            if fn.endswith(".py"):
                yield Path(dirpath) / fn


# ── Index manifest ─────────────────────────────────────────────────────────


def load_indexes(indexes_path: Path) -> list[IndexEntry]:
    """Parse ``firestore.indexes.json`` into IndexEntry objects."""
    if not indexes_path.exists():
        return []
    raw = json.loads(indexes_path.read_text(encoding="utf-8"))
    out: list[IndexEntry] = []
    for entry in raw.get("indexes", []):
        coll = entry.get("collectionGroup") or entry.get("collection") or ""
        fields = []
        for f in entry.get("fields", []):
            order = (f.get("order") or "ASCENDING").lower()
            fields.append((f["fieldPath"], "asc" if order.startswith("asc") else "desc"))
        out.append(IndexEntry(
            collection=coll,
            fields=fields,
            query_scope=entry.get("queryScope", "COLLECTION"),
        ))
    return out


def index_supports(usage: QueryUsage, idx: IndexEntry) -> bool:
    """True if ``idx`` covers ``usage`` (collection + ordered where fields + order_by)."""
    if idx.collection != usage.collection:
        return False
    idx_fields = [f for (f, _) in idx.fields]

    # Need every where field, in any order; followed by the order_by field last.
    # Firestore composite index rule: equality-where fields followed by
    # range-where / order_by field. We do a structural check: all where fields
    # appear in the index, and if there's an order_by, it's the LAST field.
    for wf in usage.where_fields:
        if wf not in idx_fields:
            return False
    if usage.order_by:
        if not idx_fields:
            return False
        if idx_fields[-1] != usage.order_by:
            return False
    return True


# ── Audit ──────────────────────────────────────────────────────────────────


def audit(root: Path, indexes_path: Path) -> AuditReport:
    report = AuditReport(indexes=load_indexes(indexes_path))
    for f in iter_python_files(root):
        report.usages.extend(scan_file(f))

    for u in report.usages:
        # Skip queries with a single where field and no order_by — Firestore
        # serves these from automatic single-field indexes.
        if len(u.where_fields) <= 1 and not u.order_by:
            report.skipped_single_field += 1
            report.matched.append(u)
            continue
        if any(index_supports(u, idx) for idx in report.indexes):
            report.matched.append(u)
        else:
            report.unmatched.append(u)
    return report


# ── Reporting ──────────────────────────────────────────────────────────────


def render_markdown(report: AuditReport) -> str:
    lines: list[str] = []
    lines.append("# Firestore Query Index Audit")
    lines.append("")
    lines.append(f"- **Queries discovered:** {len(report.usages)}")
    lines.append(f"- **Auto-served (single-field):** {report.skipped_single_field}")
    lines.append(f"- **Matched composite index:** "
                 f"{len(report.matched) - report.skipped_single_field}")
    lines.append(f"- **Missing index:** {len(report.unmatched)}")
    lines.append("")

    if report.unmatched:
        lines.append("## ❌ Queries without a matching composite index")
        lines.append("")
        lines.append("| Collection | Where fields | Order by | Source |")
        lines.append("|------------|--------------|----------|--------|")
        for u in report.unmatched:
            wf = ", ".join(u.where_fields) or "—"
            ob = f"{u.order_by} {u.order_dir or ''}".strip() if u.order_by else "—"
            lines.append(f"| `{u.collection}` | `{wf}` | `{ob}` | `{u.source}` |")
        lines.append("")
        lines.append("### Suggested index entries (paste into firestore.indexes.json)")
        lines.append("")
        lines.append("```json")
        suggestions = []
        for u in report.unmatched:
            fields = [{"fieldPath": f, "order": "ASCENDING"} for f in u.where_fields]
            if u.order_by:
                fields.append({
                    "fieldPath": u.order_by,
                    "order": "DESCENDING" if u.order_dir == "desc" else "ASCENDING",
                })
            suggestions.append({
                "collectionGroup": u.collection,
                "queryScope": "COLLECTION",
                "fields": fields,
            })
        lines.append(json.dumps(suggestions, indent=2, ensure_ascii=False))
        lines.append("```")
    else:
        lines.append("All multi-field queries have matching composite indexes. ✅")

    return "\n".join(lines) + "\n"


def write_json(report: AuditReport, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "total_queries": len(report.usages),
        "matched": [u.to_dict() for u in report.matched],
        "unmatched": [u.to_dict() for u in report.unmatched],
        "indexes_count": len(report.indexes),
    }
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


# ── CLI ─────────────────────────────────────────────────────────────────────


def main(argv: Optional[list[str]] = None) -> int:
    here = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(
        description="Audit Firestore queries against firestore.indexes.json"
    )
    parser.add_argument("--root", type=Path, default=here / "backend" / "app" / "api")
    parser.add_argument("--indexes", type=Path, default=here / "firestore.indexes.json")
    parser.add_argument(
        "--out-json",
        type=Path,
        default=here / "audit" / "firestore-query-audit.json",
    )
    parser.add_argument("--check", action="store_true",
                        help="Exit non-zero if any unmatched query is found.")
    args = parser.parse_args(argv)

    report = audit(args.root, args.indexes)
    print(render_markdown(report))
    write_json(report, args.out_json)

    if args.check and report.unmatched:
        print(f"\nCI gate failed: {len(report.unmatched)} unmatched queries.",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
