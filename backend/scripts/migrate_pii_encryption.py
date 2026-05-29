#!/usr/bin/env python3
"""Re-encrypt legacy plaintext PII fields. Run from backend/: python scripts/migrate_pii_encryption.py [--dry-run]"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.firebase_client import get_db, init_firebase
from app.services.crypto import PREFIX, encrypt_field

COLLECTIONS = {
    "hr_employees": ("national_id", "bank_account", "social_security_number"),
    "hr_contracts": ("wage",),
    "payslips": ("gross", "net", "net_salary", "basic_salary"),
    "users": ("totp_secret", "backup_codes"),
    "iraq_gateway_configs": ("api_key",),
}


def _needs_encrypt(value) -> bool:
    if value in (None, ""):
        return False
    return not str(value).startswith(PREFIX)


def migrate(dry_run: bool = True) -> dict:
    init_firebase()
    db = get_db()
    stats = {"scanned": 0, "updated": 0, "by_collection": {}}

    for collection, fields in COLLECTIONS.items():
        coll_stats = {"scanned": 0, "updated": 0}
        for doc in db.collection(collection).limit(5000).stream():
            data = doc.to_dict() or {}
            coll_stats["scanned"] += 1
            stats["scanned"] += 1
            updates = {}
            for field in fields:
                if _needs_encrypt(data.get(field)):
                    updates[field] = encrypt_field(str(data[field]))
            if updates:
                coll_stats["updated"] += 1
                stats["updated"] += 1
                if not dry_run:
                    doc.reference.update(updates)
        stats["by_collection"][collection] = coll_stats

    return stats


def main():
    parser = argparse.ArgumentParser(description="Migrate plaintext PII to encrypted fields")
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--apply", action="store_true", help="Actually write changes")
    args = parser.parse_args()
    dry_run = not args.apply
    stats = migrate(dry_run=dry_run)
    mode = "DRY-RUN" if dry_run else "APPLIED"
    print(f"[{mode}] scanned={stats['scanned']} updated={stats['updated']}")
    for coll, s in stats["by_collection"].items():
        print(f"  {coll}: scanned={s['scanned']} updated={s['updated']}")


if __name__ == "__main__":
    main()
