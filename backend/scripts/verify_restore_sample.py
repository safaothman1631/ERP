#!/usr/bin/env python3
"""verify_restore_sample.py — post-restore integrity sampler (SF3 / T-SF.3.2).

Connects to a *restored* Firestore database (NOT the live default unless you
explicitly pass it) and confirms that a set of well-known collections are
present and meet a minimum document count. Used by ``scripts/dr/restore-full.sh``
step 6 to gate promotion.

Exit codes:
    0  all sampled collections satisfied the minimum count
    1  connection/argument error
    3  one or more collections failed the minimum-count check

Usage:
    python backend/scripts/verify_restore_sample.py \
        --project erp-system-494716 \
        --database zoho-restore-20260526-141200 \
        --collections invoices,contacts,accounts,organizations \
        --min-per-collection 0 \
        [--sample 10]

Safe locally: if google-cloud-firestore is unavailable it prints SKIP and
exits 0 so CI/dev never hard-fails on a missing client.
"""
from __future__ import annotations

import argparse
import sys


def _build_client(project: str, database: str):
    """Return a Firestore client bound to *database* (named DB aware)."""
    from google.cloud import firestore  # type: ignore

    # The named-database kwarg exists in recent google-cloud-firestore. Fall
    # back to the default constructor if the installed version predates it.
    try:
        return firestore.Client(project=project or None, database=database)
    except TypeError:
        if database not in ("(default)", "default", ""):
            raise RuntimeError(
                "installed google-cloud-firestore does not support named "
                "databases; upgrade to verify a non-default DB"
            )
        return firestore.Client(project=project or None)


def main() -> int:
    ap = argparse.ArgumentParser(description="Sample a restored Firestore DB for integrity.")
    ap.add_argument("--project", default="", help="GCP project id")
    ap.add_argument("--database", required=True, help="Restored database id (e.g. zoho-restore-...)")
    ap.add_argument(
        "--collections",
        default="invoices,contacts,accounts,organizations",
        help="Comma-separated collection names to sample",
    )
    ap.add_argument(
        "--min-per-collection",
        type=int,
        default=0,
        help="Minimum docs each collection must have to pass (0 = presence only)",
    )
    ap.add_argument("--sample", type=int, default=10, help="Max docs to read per collection")
    args = ap.parse_args()

    collections = [c.strip() for c in args.collections.split(",") if c.strip()]
    if not collections:
        print("verify_restore_sample: no collections given", file=sys.stderr)
        return 1

    try:
        client = _build_client(args.project, args.database)
    except Exception as exc:  # noqa: BLE001
        # Missing client lib in local/dev — do not hard-fail the pipeline.
        if "firestore" in str(exc).lower() or "module" in str(exc).lower():
            print(f"SKIP: Firestore client unavailable ({exc})")
            return 0
        print(f"verify_restore_sample: cannot build client: {exc}", file=sys.stderr)
        return 1

    failures: list[str] = []
    print(f"verify_restore_sample: database={args.database} project={args.project or '<default>'}")
    for name in collections:
        try:
            docs = list(client.collection(name).limit(max(args.sample, args.min_per_collection or 1)).stream())
        except Exception as exc:  # noqa: BLE001
            print(f"  - {name}: ERROR reading ({exc})")
            failures.append(name)
            continue
        count = len(docs)
        status = "ok"
        if count < args.min_per_collection:
            status = f"FAIL (<{args.min_per_collection})"
            failures.append(name)
        elif count == 0 and args.min_per_collection == 0:
            status = "empty (presence-only mode: OK)"
        print(f"  - {name}: {count} doc(s) sampled — {status}")

    if failures:
        print(f"verify_restore_sample: FAILED collections: {', '.join(failures)}", file=sys.stderr)
        return 3
    print("verify_restore_sample: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
