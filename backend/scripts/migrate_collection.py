#!/usr/bin/env python3
"""Bulk schema migration CLI (Wave S)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.firebase_client import init_firebase, get_db
from app.firestore.migrations import run_migrations, list_migrations, registered_collections


def _repo_for(collection: str, org_id: str):
    from app.firestore.base import BaseRepository

    class _R(BaseRepository):
        collection_name = collection

    return _R(org_id)


def main() -> int:
    p = argparse.ArgumentParser(description="Migrate Firestore collection schema versions")
    p.add_argument("--collection", required=True)
    p.add_argument("--target", type=int, required=True)
    p.add_argument("--org-id", default="all")
    p.add_argument("--apply", action="store_true")
    p.add_argument("--resume-from", default=None)
    p.add_argument("--batch-size", type=int, default=500)
    args = p.parse_args()

    if args.collection not in registered_collections():
        print(f"WARN: no registered migrations for {args.collection}; versions: {list_migrations(args.collection)}")

    init_firebase()
    db = get_db()
    orgs: list[str]
    if args.org_id == "all":
        orgs = [d.id for d in db.collection("organizations").limit(500).stream()]
    else:
        orgs = [args.org_id]

    total_migrated = 0
    total_seen = 0
    for org in orgs:
        repo = _repo_for(args.collection, org)
        skipping = bool(args.resume_from)
        for doc in repo.stream_org_docs(batch_size=args.batch_size):
            total_seen += 1
            if skipping:
                if doc["id"] == args.resume_from:
                    skipping = False
                continue
            current = int(doc.get("schema_version") or 1)
            if current >= args.target:
                continue
            upgraded = run_migrations(args.collection, doc, current, args.target)
            if args.apply:
                repo.collection.document(doc["id"]).update(
                    {k: v for k, v in upgraded.items() if k != "id"}
                )
            total_migrated += 1
            if total_migrated % args.batch_size == 0:
                print(f"  org={org} migrated={total_migrated} last_id={doc['id']}")

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"{mode}: collection={args.collection} target={args.target} seen={total_seen} to_migrate={total_migrated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
