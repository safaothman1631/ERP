#!/usr/bin/env python3
"""Phase 0: Verify no unbalanced journal entries in Firestore (sample scan)."""
from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.firebase_client import init_firebase, get_db
from app.services.je_validation import validate_je_balance


def main() -> int:
    init_firebase()
    db = get_db()
    unbalanced = []
    scanned = 0
    for doc in db.collection("journal_entries").limit(2000).stream():
        data = doc.to_dict() or {}
        scanned += 1
        lines = data.get("lines") or []
        if len(lines) < 2:
            continue
        try:
            validate_je_balance(lines, data.get("currency_code", "IQD"))
        except Exception:
            unbalanced.append(doc.id)
    print(f"scanned={scanned} unbalanced={len(unbalanced)}")
    if unbalanced:
        print("ids:", unbalanced[:20])
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
