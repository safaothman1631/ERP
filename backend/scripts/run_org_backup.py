#!/usr/bin/env python3
"""Run one org backup to GCS (pre-launch ops phase 2)."""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.firebase_client import init_firebase  # noqa: E402
from app.services.backup_service import BackupService  # noqa: E402


async def _run(org_id: str) -> int:
    init_firebase()
    bucket = os.environ.get("FIREBASE_STORAGE_BUCKET") or os.environ.get("BACKUP_GCS_BUCKET", "")
    if not bucket:
        print("FAIL: set FIREBASE_STORAGE_BUCKET or BACKUP_GCS_BUCKET")
        return 1
    os.environ.setdefault("FIREBASE_STORAGE_BUCKET", bucket)
    svc = BackupService(org_id)
    record = await svc.run_backup()
    print(f"OK: backup {record.id} -> {record.storage_path} ({record.total_documents} docs)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org-id", required=True)
    args = parser.parse_args()
    return asyncio.run(_run(args.org_id))


if __name__ == "__main__":
    raise SystemExit(main())
