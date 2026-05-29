#!/usr/bin/env python3
"""extract_tenant_from_db.py — filter a (scratch) Firestore DB to one org_id
and write a per-tenant patch (SF3 / T-SF.3.3).

Part of the per-tenant restore pipeline driven by
``scripts/dr/restore-tenant.sh``:

    full export --import--> scratch DB --THIS SCRIPT--> per-collection JSON patch

The patch directory layout::

    <out-dir>/
      _manifest.json          # {collection: count, ...} + metadata
      <collection>.json       # [{"id": <doc_id>, ...doc fields...}, ...]

Only documents whose ``org_id`` equals the requested value are kept (mirrors the
app's BaseRepository org-scoping). The full collection list is auto-discovered
from the scratch DB unless ``--collections`` restricts it.

Exit codes:
    0  wrote at least one matching document
    1  connection/argument error
    3  zero documents matched the org_id (likely wrong org or wrong export)

Usage:
    python backend/scripts/extract_tenant_from_db.py \
        --project erp-system-494716 \
        --database zoho-tenant-restore-064a4a1a-153000 \
        --org-id 064a4a1a-487b-4835-a42a-4806ba8add72 \
        --out-dir ./_dr/tenant-restore/064a4a1a-... \
        [--collections invoices,invoice_lines,contacts]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone


def _build_client(project: str, database: str):
    from google.cloud import firestore  # type: ignore

    try:
        return firestore.Client(project=project or None, database=database)
    except TypeError:
        if database not in ("(default)", "default", ""):
            raise RuntimeError(
                "installed google-cloud-firestore lacks named-database support; "
                "upgrade to extract from a scratch DB"
            )
        return firestore.Client(project=project or None)


def _discover_collections(client) -> list[str]:
    """List top-level collection ids in the database."""
    try:
        return sorted(c.id for c in client.collections())
    except Exception:  # noqa: BLE001
        return []


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract one org_id from a scratch Firestore DB.")
    ap.add_argument("--project", default="")
    ap.add_argument("--database", required=True)
    ap.add_argument("--org-id", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument(
        "--collections",
        default="",
        help="Comma-separated subset; default = auto-discover all top-level collections",
    )
    ap.add_argument(
        "--org-field",
        default="org_id",
        help="Field name used for tenant scoping (default: org_id)",
    )
    args = ap.parse_args()

    try:
        client = _build_client(args.project, args.database)
    except Exception as exc:  # noqa: BLE001
        print(f"extract_tenant: cannot build client: {exc}", file=sys.stderr)
        return 1

    if args.collections.strip():
        collections = [c.strip() for c in args.collections.split(",") if c.strip()]
    else:
        collections = _discover_collections(client)
        if not collections:
            print("extract_tenant: could not discover collections (none found)", file=sys.stderr)
            return 1

    os.makedirs(args.out_dir, exist_ok=True)

    manifest: dict[str, object] = {
        "org_id": args.org_id,
        "database": args.database,
        "project": args.project,
        "extracted_at": datetime.now(timezone.utc).isoformat(),
        "org_field": args.org_field,
        "collections": {},
    }
    total = 0

    for name in collections:
        rows: list[dict] = []
        try:
            query = client.collection(name).where(args.org_field, "==", args.org_id)
            for snap in query.stream():
                data = snap.to_dict() or {}
                rows.append({"id": snap.id, **data})
        except Exception as exc:  # noqa: BLE001
            # A collection without the org field, or an index gap, must not abort
            # the whole extraction — record it and move on.
            print(f"  - {name}: WARN read failed ({exc})", file=sys.stderr)
            manifest["collections"][name] = {"count": 0, "error": str(exc)}  # type: ignore[index]
            continue

        out_path = os.path.join(args.out_dir, f"{name}.json")
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(rows, fh, ensure_ascii=False, default=str, indent=2)
        manifest["collections"][name] = {"count": len(rows)}  # type: ignore[index]
        total += len(rows)
        print(f"  - {name}: {len(rows)} doc(s)")

    with open(os.path.join(args.out_dir, "_manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, default=str, indent=2)

    print(f"extract_tenant: total {total} doc(s) for org_id={args.org_id} -> {args.out_dir}")
    if total == 0:
        print("extract_tenant: NO documents matched — aborting (rc=3)", file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
