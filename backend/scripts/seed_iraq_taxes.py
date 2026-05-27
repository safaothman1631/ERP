#!/usr/bin/env python3
"""Idempotent Iraq tax rate seed (Wave M)."""
from __future__ import annotations

import argparse
import sys

DEFAULT_RATES = [
    {"name": "VAT 0%", "rate": 0.0, "tax_type": "vat"},
    {"name": "VAT 10%", "rate": 10.0, "tax_type": "vat"},
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org-id", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.dry_run:
        print(f"DRY RUN: would seed {len(DEFAULT_RATES)} tax rates for {args.org_id}")
        return 0
    from app.firestore.taxes import TaxRateRepository

    repo = TaxRateRepository(args.org_id)
    created = 0
    for rate in DEFAULT_RATES:
        existing, _ = repo.list(filters=[{"field": "name", "op": "==", "value": rate["name"]}], limit=1)
        if existing:
            continue
        repo.create({**rate, "is_active": True})
        created += 1
    print(f"Seeded {created} tax rates for org {args.org_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
