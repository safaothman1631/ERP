#!/usr/bin/env python3
"""Mark closed fiscal-year documents for cold archive (Wave B5)."""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org-id", required=True)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    from app.firestore.invoices import InvoiceRepository

    repo = InvoiceRepository(args.org_id)
    items, _ = repo.list(limit=5000)
    tagged = 0
    for inv in items:
        date = str(inv.get("date") or "")[:4]
        if date != str(args.year):
            continue
        if inv.get("status") not in ("paid", "void"):
            continue
        tagged += 1
        if not args.dry_run:
            repo.update(inv["id"], {"archived_fiscal_year": args.year, "archived_at": datetime.utcnow().isoformat()})
    print(f"{'DRY RUN: ' if args.dry_run else ''}archived {tagged} invoices for FY{args.year}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
