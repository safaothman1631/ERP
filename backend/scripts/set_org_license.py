#!/usr/bin/env python3
"""Set organization license bundle or custom module pool.

Usage:
  python scripts/set_org_license.py --org-id ORG123 --bundle pos_only
  python scripts/set_org_license.py --org-id ORG123 --modules sales,inventory,pos
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.firebase_client import init_firebase
from app.services.org_license import BUNDLES, set_org_license


def main() -> int:
    parser = argparse.ArgumentParser(description="Set org license")
    parser.add_argument("--org-id", required=True)
    parser.add_argument("--bundle", choices=list(BUNDLES.keys()))
    parser.add_argument("--modules", help="Comma-separated module keys (custom bundle)")
    parser.add_argument("--expires-at", dest="expires_at")
    args = parser.parse_args()

    init_firebase()
    payload: dict = {}
    if args.bundle:
        payload["bundle_id"] = args.bundle
    if args.modules:
        payload["bundle_id"] = "custom"
        payload["allowed_modules"] = [m.strip() for m in args.modules.split(",") if m.strip()]
    if args.expires_at:
        payload["expires_at"] = args.expires_at

    if not payload.get("bundle_id") and not payload.get("allowed_modules"):
        parser.error("Provide --bundle or --modules")

    result = set_org_license(args.org_id, payload)
    print(f"License updated for {args.org_id}: {result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
