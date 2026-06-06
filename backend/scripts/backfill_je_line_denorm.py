#!/usr/bin/env python3
"""Backfill ``org_id`` + ``je_date`` onto existing journal-entry line docs.

These two fields let accounting reports aggregate JE lines with ONE
``collection_group('lines')`` range query instead of the legacy 1 + N scan
(one subcollection read per entry). New entries get the fields at write time
(``journal_entry_atomic``); this script populates lines written before that.

Idempotent: uses ``set(..., merge=True)`` so re-running only refreshes the two
fields and never disturbs other line data. Safe to run repeatedly.

Usage (from backend/):
    venv\\Scripts\\python.exe scripts\\backfill_je_line_denorm.py [ORG_ID]

With no ORG_ID it backfills every org's journal entries.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.firebase_client import init_firebase, get_db  # noqa: E402
from app.services.journal_entry_atomic import _normalize_je_date  # noqa: E402

_BATCH_LIMIT = 400  # Firestore hard cap is 500 ops/batch; stay well under.


def backfill(org_id: str | None = None) -> tuple[int, int]:
    """Returns (entries_scanned, lines_updated)."""
    db = get_db()
    headers_q = db.collection("journal_entries")
    if org_id:
        headers_q = headers_q.where("org_id", "==", org_id)

    entries = 0
    lines_updated = 0
    batch = db.batch()
    pending = 0

    for header in headers_q.stream():
        data = header.to_dict() or {}
        h_org = data.get("org_id")
        if not h_org:
            continue
        je_date = _normalize_je_date(data.get("date"))
        entries += 1
        for line in header.reference.collection("lines").stream():
            batch.set(
                line.reference,
                {"org_id": h_org, "je_date": je_date},
                merge=True,
            )
            pending += 1
            lines_updated += 1
            if pending >= _BATCH_LIMIT:
                batch.commit()
                batch = db.batch()
                pending = 0

    if pending:
        batch.commit()
    return entries, lines_updated


def main() -> int:
    init_firebase()
    org_id = sys.argv[1] if len(sys.argv) > 1 else None
    scope = f"org={org_id}" if org_id else "ALL orgs"
    print(f"Backfilling JE line denorm (org_id + je_date) for {scope} ...")
    entries, lines = backfill(org_id)
    print(f"done: entries_scanned={entries} lines_updated={lines}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
