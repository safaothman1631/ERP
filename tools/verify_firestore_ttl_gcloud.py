#!/usr/bin/env python3
"""Verify TTL policies are active in Firestore (console/gcloud), not only in indexes JSON."""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = frozenset({
    "idempotency_keys",
    "sessions",
    "rate_limit_buckets",
    "ocr_cache",
    "webhook_inbox",
    "revoked_tokens",
    "receipt_scans",
})


def _gcloud_exe() -> str:
    return shutil.which("gcloud") or shutil.which("gcloud.cmd") or "gcloud"


def _gcloud_ttl_list(project: str, database: str) -> list[dict]:
    cmd = [
        _gcloud_exe(),
        "firestore",
        "fields",
        "ttls",
        "list",
        f"--project={project}",
        f"--database={database}",
        "--format=json",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "gcloud failed")
    if not proc.stdout.strip():
        return []
    data = json.loads(proc.stdout)
    if isinstance(data, list):
        return data
    return data.get("ttls") or data.get("fieldTtls") or []


def _collection_from_name(name: str) -> str:
    # projects/.../databases/(default)/collectionGroups/sessions/fields/expires_at
    parts = name.replace("\\", "/").split("/")
    for i, p in enumerate(parts):
        if p == "collectionGroups" and i + 1 < len(parts):
            return parts[i + 1]
    return ""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default="zoho-83cda")
    parser.add_argument("--database", default="(default)")
    parser.add_argument("--skip-gcloud", action="store_true", help="Only run local manifest check")
    args = parser.parse_args()

    proc = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "verify_firestore_ttl.py")],
        check=False,
    )
    if proc.returncode != 0:
        return proc.returncode

    if args.skip_gcloud:
        print("SKIP: gcloud TTL list (--skip-gcloud)")
        return 0

    try:
        rows = _gcloud_ttl_list(args.project, args.database)
    except FileNotFoundError:
        print("SKIP: gcloud not on PATH")
        return 0
    except RuntimeError as exc:
        print(f"WARN: cannot list live TTL policies: {exc}")
        print("      Deploy indexes then confirm in Firebase Console → Firestore → TTL")
        return 0

    active: set[str] = set()
    for row in rows:
        ttl_cfg = row.get("ttlConfig") or {}
        state = (ttl_cfg.get("state") or row.get("state") or row.get("ttlState") or "").upper()
        if state and state not in ("ACTIVE", "CREATING", "ENABLED"):
            continue
        coll = row.get("collectionGroup") or _collection_from_name(row.get("name", ""))
        field = row.get("fieldPath") or row.get("field") or _collection_from_name(row.get("name", "")).split("/")[-1]
        name = row.get("name", "")
        if "/fields/expires_at" in name:
            coll = coll or _collection_from_name(name)
            active.add(coll)
        elif coll and field == "expires_at":
            active.add(coll)

    missing = sorted(REQUIRED - active)
    if missing:
        print("FAIL: TTL not active in project for:", ", ".join(missing))
        print("      Run: firebase deploy --only firestore:indexes --project", args.project)
        return 1
    print(f"OK: live TTL active for {len(REQUIRED)} collection groups on {args.project}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
