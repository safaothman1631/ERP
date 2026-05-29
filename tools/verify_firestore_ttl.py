#!/usr/bin/env python3
"""Verify TTL fieldOverrides exist in firestore.indexes.json (Wave T4)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "firestore.indexes.json"

REQUIRED = frozenset({
    "idempotency_keys",
    "sessions",
    "rate_limit_buckets",
    "ocr_cache",
    "webhook_inbox",
    "revoked_tokens",
    "receipt_scans",
})


def main() -> int:
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    overrides = data.get("fieldOverrides") or []
    found = {
        o.get("collectionGroup")
        for o in overrides
        if o.get("fieldPath") == "expires_at" and o.get("ttl")
    }
    missing = sorted(REQUIRED - found)
    if missing:
        print("FAIL: missing TTL overrides for:", ", ".join(missing))
        return 1
    print(f"OK: TTL configured for {len(REQUIRED)} collection groups")
    return 0


if __name__ == "__main__":
    sys.exit(main())
