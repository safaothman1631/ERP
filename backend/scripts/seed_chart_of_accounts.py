#!/usr/bin/env python3
"""Idempotent chart-of-accounts seed (Wave M)."""
from __future__ import annotations

import argparse
import sys

DEFAULT_ACCOUNTS = [
    {"code": "1000", "name": "Cash", "account_type": "asset"},
    {"code": "1100", "name": "Accounts Receivable", "account_type": "asset"},
    {"code": "2000", "name": "Accounts Payable", "account_type": "liability"},
    {"code": "3000", "name": "Equity", "account_type": "equity"},
    {"code": "4000", "name": "Revenue", "account_type": "income"},
    {"code": "5000", "name": "Expenses", "account_type": "expense"},
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org-id", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.dry_run:
        print(f"DRY RUN: would seed {len(DEFAULT_ACCOUNTS)} accounts for {args.org_id}")
        return 0
    from app.firestore.accounts import AccountRepository

    repo = AccountRepository(args.org_id)
    created = 0
    for acct in DEFAULT_ACCOUNTS:
        existing, _ = repo.list(filters=[{"field": "code", "op": "==", "value": acct["code"]}], limit=1)
        if existing:
            continue
        repo.create({**acct, "is_active": True})
        created += 1
    print(f"Seeded {created} accounts for org {args.org_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
