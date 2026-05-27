#!/usr/bin/env python3
"""Orphan FK scanner (Wave R)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.firebase_client import init_firebase, get_db
from app.firestore.references import REFERENCES


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--org-id", required=True)
    p.add_argument("--report", default=None)
    args = p.parse_args()

    init_firebase()
    db = get_db()
    orphans: list[str] = []

    for source, fks in REFERENCES.items():
        for doc in db.collection(source).where("org_id", "==", args.org_id).limit(2000).stream():
            data = doc.to_dict() or {}
            if data.get("deleted_at"):
                continue
            for fk in fks:
                ref_id = data.get(fk.field)
                if not ref_id:
                    continue
                target = db.collection(fk.target).document(ref_id).get()
                if not target.exists:
                    line = f"- {source}/{doc.id}.{fk.field} -> missing {fk.target}/{ref_id}"
                    orphans.append(line)

    report_path = args.report or f"audit/ORPHANS_{args.org_id}.md"
    Path(report_path).parent.mkdir(parents=True, exist_ok=True)
    body = f"# Orphans org {args.org_id}\n\n" + ("\n".join(orphans) if orphans else "No orphans found.\n")
    Path(report_path).write_text(body, encoding="utf-8")
    print(f"Wrote {report_path} ({len(orphans)} orphans)")
    return 1 if orphans else 0


if __name__ == "__main__":
    raise SystemExit(main())
