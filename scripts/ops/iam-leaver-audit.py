#!/usr/bin/env python3
"""IAM leaver audit (scale-foundation SF1 / T-SF.1.17).

Compares the live GCP project IAM policy against a checked-in allowlist and
reports any principal that is bound to a role but NOT on the allowlist — the
signal of an un-revoked leaver, a stale service account, or an unauthorized
grant. Designed to run weekly from Cloud Scheduler (or CI) and post to Slack.

Why this exists
---------------
The Tier-3 success metric "time-to-revoke leaver <= 24h" cannot be proven
without a recurring, automated diff. Humans forget to revoke; this does not.

Usage
-----
    python scripts/ops/iam-leaver-audit.py \
        --project zoho-83cda \
        --allowlist scripts/ops/iam-allowlist.yml \
        [--dry-run] [--json]

Auth: relies on an already-authenticated `gcloud` (the runner's service
account needs `resourcemanager.projects.getIamPolicy`). Set SLACK_WEBHOOK_URL
to post a report; otherwise it prints to stdout.

Exit codes
----------
    0  no unexpected principals
    2  unexpected principals found (gates CI / pages on-call)
    3  configuration / execution error (gcloud missing, bad allowlist)

Dependency-light by design: stdlib + `gcloud` subprocess. YAML is parsed with
PyYAML if available, else a minimal built-in line parser (so it runs on a bare
Cloud Function image too).
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.request
from typing import Iterable


def _load_allowlist(path: str) -> dict:
    """Load the allowlist YAML. Schema:

        # iam-allowlist.yml
        members:                       # exact principals always allowed
          - user:safa@zoho-kurd.iq
          - serviceAccount:ci@zoho-83cda.iam.gserviceaccount.com
        domains:                       # whole domains allowed (e.g. workspace)
          - zoho-kurd.iq
        service_account_suffixes:      # GCP-managed SA suffixes to ignore
          - .gserviceaccount.com
    """
    try:
        with open(path, "r", encoding="utf-8") as fh:
            text = fh.read()
    except OSError as exc:
        print(f"ERROR: cannot read allowlist {path}: {exc}", file=sys.stderr)
        sys.exit(3)
    try:
        import yaml  # type: ignore

        data = yaml.safe_load(text) or {}
    except ImportError:
        data = _minimal_yaml(text)
    if not isinstance(data, dict):
        print("ERROR: allowlist must be a mapping", file=sys.stderr)
        sys.exit(3)
    data.setdefault("members", [])
    data.setdefault("domains", [])
    data.setdefault("service_account_suffixes", [])
    return data


def _minimal_yaml(text: str) -> dict:
    """Tiny fallback parser for the flat list-of-strings schema above."""
    out: dict[str, list[str]] = {}
    key: str | None = None
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        if not line.startswith((" ", "-", "\t")) and line.endswith(":"):
            key = line[:-1].strip()
            out[key] = []
        elif key and line.lstrip().startswith("- "):
            out[key].append(line.lstrip()[2:].strip())
    return out


def _get_iam_members(project: str) -> set[str]:
    """Return the flat set of all principals bound to any role on the project."""
    try:
        proc = subprocess.run(
            [
                "gcloud", "projects", "get-iam-policy", project,
                "--format=json",
            ],
            capture_output=True, text=True, timeout=120,
        )
    except FileNotFoundError:
        print("ERROR: gcloud not found on PATH", file=sys.stderr)
        sys.exit(3)
    if proc.returncode != 0:
        print(f"ERROR: gcloud get-iam-policy failed: {proc.stderr.strip()}", file=sys.stderr)
        sys.exit(3)
    policy = json.loads(proc.stdout or "{}")
    members: set[str] = set()
    for binding in policy.get("bindings", []):
        members.update(binding.get("members", []))
    return members


def _is_allowed(member: str, allow: dict) -> bool:
    if member in set(allow["members"]):
        return True
    # member format is "<type>:<identity>"
    _, _, identity = member.partition(":")
    domain = identity.rsplit("@", 1)[-1] if "@" in identity else ""
    if domain and domain in set(allow["domains"]):
        return True
    if member.startswith(("deleted:",)):
        return False  # deleted principals are exactly what we want to flag
    for suffix in allow["service_account_suffixes"]:
        if member.startswith("serviceAccount:") and identity.endswith(suffix):
            # Only auto-allow GCP-managed agents, not arbitrary SAs
            if "gcp-sa-" in identity or identity.startswith("service-"):
                return True
    return False


def _post_slack(webhook: str, text: str) -> None:
    payload = json.dumps({"text": text}).encode("utf-8")
    req = urllib.request.Request(webhook, data=payload, headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=15)  # noqa: S310 - fixed trusted webhook
    except Exception as exc:  # pragma: no cover - best-effort notify
        print(f"WARN: Slack post failed: {exc}", file=sys.stderr)


def _format_report(project: str, unexpected: Iterable[str]) -> str:
    rows = sorted(unexpected)
    if not rows:
        return f":white_check_mark: IAM audit clean for `{project}` — every principal is on the allowlist."
    lines = [f":rotating_light: IAM audit for `{project}` found {len(rows)} unexpected principal(s):"]
    lines += [f"  - `{m}`" for m in rows]
    lines.append("Revoke leavers / stale grants, or add to scripts/ops/iam-allowlist.yml if intentional.")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="Audit GCP IAM members against an allowlist.")
    ap.add_argument("--project", default=os.getenv("GCP_PROJECT_ID", "zoho-83cda"))
    ap.add_argument("--allowlist", default="scripts/ops/iam-allowlist.yml")
    ap.add_argument("--dry-run", action="store_true", help="Print only; never post to Slack.")
    ap.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    args = ap.parse_args()

    allow = _load_allowlist(args.allowlist)
    members = _get_iam_members(args.project)
    unexpected = sorted(m for m in members if not _is_allowed(m, allow))

    if args.json:
        print(json.dumps({"project": args.project, "total": len(members), "unexpected": unexpected}, indent=2))
    else:
        print(_format_report(args.project, unexpected))

    webhook = os.getenv("SLACK_WEBHOOK_URL")
    if webhook and not args.dry_run:
        _post_slack(webhook, _format_report(args.project, unexpected))

    return 2 if unexpected else 0


if __name__ == "__main__":
    sys.exit(main())
