#!/usr/bin/env python3
"""Detect (and optionally fix) denormalized field drift for one org."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.reconciliation import run_reconcile_for_org  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Reconcile denormalized ERP fields")
    parser.add_argument("--org-id", required=True)
    parser.add_argument("--fix", action="store_true", help="Write computed values to stored fields")
    parser.add_argument("--reconciled-only", action="store_true", help="Bank drift uses reconciled txns only")
    parser.add_argument("--json", dest="json_out", action="store_true")
    args = parser.parse_args()

    summary = run_reconcile_for_org(
        args.org_id,
        fix=args.fix,
        reconciled_only=args.reconciled_only,
    )

    import subprocess

    orphan_proc = subprocess.run(
        [sys.executable, str(Path(__file__).resolve().parent / "check_orphans.py"), "--org-id", args.org_id],
        capture_output=True,
        text=True,
    )
    summary["orphan_scan_exit"] = orphan_proc.returncode
    if orphan_proc.returncode != 0:
        print(orphan_proc.stdout or orphan_proc.stderr)

    if args.json_out:
        print(json.dumps(summary, indent=2))
    else:
        print(f"org={summary['org_id']} drifts={summary['drift_count']} fix={summary['fixed']}")
        for d in summary["drifts"]:
            print(
                f"  [{d['kind']}] {d['entity_id']} {d['field']}: "
                f"stored={d['stored']:.2f} computed={d['computed']:.2f} delta={d['delta']:.2f}"
            )

    if summary.get("orphan_scan_exit", 0) != 0:
        return 1
    return 1 if summary["drift_count"] > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
