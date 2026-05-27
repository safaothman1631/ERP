#!/usr/bin/env python3
"""Hard-delete soft-deleted docs older than retention days (uses stream_org_docs)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.firebase_client import init_firebase
from app.services.soft_delete_purge import purge_org, run_scheduled_purge


def main() -> int:
    init_firebase()
    p = argparse.ArgumentParser()
    p.add_argument("--org-id", default="")
    p.add_argument("--days", type=int, default=30)
    p.add_argument("--apply", action="store_true")
    p.add_argument("--all-orgs", action="store_true")
    args = p.parse_args()
    if args.all_orgs:
        n = run_scheduled_purge(days=args.days)
        print(f"all_orgs removed={n} apply={args.apply}")
        return 0
    if not args.org_id:
        p.error("--org-id required unless --all-orgs")
    n = purge_org(args.org_id, days=args.days, apply=args.apply)
    print(f"org={args.org_id} candidates={n} apply={args.apply}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
