#!/usr/bin/env python3
"""Generate demo org dataset (Wave M5)."""
from __future__ import annotations

import argparse
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org-id", default=None)
    parser.add_argument("--months", type=int, default=12)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    org_id = args.org_id or f"demo-{uuid.uuid4().hex[:8]}"
    if args.dry_run:
        print(f"DRY RUN: seed {args.months} months for org {org_id}")
        return 0
    from app.firestore.contacts import ContactRepository
    from app.firestore.invoices import InvoiceRepository

    contact_repo = ContactRepository(org_id)
    inv_repo = InvoiceRepository(org_id)
    contact = contact_repo.create({
        "display_name": "Demo Customer",
        "contact_type": "customer",
        "email": "demo@example.com",
    })
    base = datetime.utcnow()
    for m in range(args.months):
        d = (base - timedelta(days=30 * m)).date().isoformat()
        inv_repo.create({
            "contact_id": contact["id"],
            "date": d,
            "due_date": d,
            "status": "sent",
            "total": 100.0 + m,
            "balance_due": 100.0 + m,
            "currency_code": "IQD",
        })
    print(f"Seeded demo org {org_id} ({args.months} invoices)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
