#!/usr/bin/env python3
"""Verify latest GCS backup exists (Wave B). Exit 0 when OK or skipped locally."""
from __future__ import annotations

import os
import sys


def main() -> int:
    bucket = os.environ.get("BACKUP_GCS_BUCKET", "")
    if not bucket:
        print("SKIP: BACKUP_GCS_BUCKET not set (local dev)")
        return 0
    try:
        from google.cloud import storage

        client = storage.Client()
        blobs = list(client.list_blobs(bucket, prefix="backups/", max_results=5))
        if not blobs:
            print(f"FAIL: no objects under gs://{bucket}/backups/")
            return 1
        latest = max(blobs, key=lambda b: b.time_created or b.updated)
        import hashlib

        digest = hashlib.sha256(latest.download_as_bytes()).hexdigest()
        print(f"OK: latest backup gs://{bucket}/{latest.name} ({latest.size} bytes) sha256={digest[:16]}...")
        return 0
    except Exception as exc:
        print(f"FAIL: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
