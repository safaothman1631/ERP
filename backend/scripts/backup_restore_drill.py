#!/usr/bin/env python3
"""Backup/restore drill checklist (Wave B7) — run in staging with credentials."""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org-id", required=True)
    parser.add_argument("--skip-backup", action="store_true")
    parser.add_argument("--base-url", default="", help="Staging API URL for HTTP smoke")
    parser.add_argument("--email", default="")
    parser.add_argument("--password", default="")
    parser.add_argument("--skip-smoke", action="store_true")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[2]
    steps: list[tuple[str, int]] = []

    if not args.skip_backup:
        env = os.environ.copy()
        env.setdefault(
            "BACKUP_GCS_BUCKET",
            env.get("FIREBASE_STORAGE_BUCKET", "zoho-83cda-erp-backups"),
        )
        code = subprocess.call(
            [sys.executable, str(root / "backend" / "scripts" / "verify_latest_backup.py")],
            env=env,
        )
        steps.append(("verify_latest_backup", code))

    code = subprocess.call(
        [
            sys.executable,
            str(root / "backend" / "scripts" / "reconcile_org.py"),
            "--org-id",
            args.org_id,
        ],
    )
    steps.append(("reconcile_org", code))

    if not args.skip_smoke and args.base_url and args.email and args.password:
        code = subprocess.call(
            [
                sys.executable,
                str(root / "backend" / "scripts" / "prelaunch_smoke.py"),
                "--base-url",
                args.base_url,
                "--email",
                args.email,
                "--password",
                args.password,
            ],
        )
        steps.append(("prelaunch_smoke", code))
    elif not args.skip_smoke:
        print("SKIP: prelaunch_smoke (pass --base-url --email --password)")

    failed = [name for name, c in steps if c != 0]
    log_path = root / "DISASTER_RECOVERY.md"
    stamp = datetime.utcnow().strftime("%Y-%m-%d")
    line = f"| {stamp} | drill | org={args.org_id} | {'PASS' if not failed else 'FAIL: ' + ','.join(failed)} |\n"
    if log_path.exists() and "drill | org=" not in log_path.read_text(encoding="utf-8")[-500:]:
        text = log_path.read_text(encoding="utf-8")
        if "## Automated drill log" not in text:
            text += "\n## Automated drill log\n\n| Date | Operator | Result |\n|------|----------|--------|\n"
        log_path.write_text(text + line, encoding="utf-8")

    if failed:
        print("FAIL steps:", failed)
        return 1
    print("OK: backup_restore_drill passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
