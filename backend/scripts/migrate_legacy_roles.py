"""Migrate legacy `user.role` values into the RBAC `user_roles` collection.

Idempotent and safe to re-run. Defaults to dry-run; pass --apply to write.

Usage (PowerShell):
  c:\\Users\\SAFA\\zoho\\backend\\venv\\Scripts\\python.exe `
    c:\\Users\\SAFA\\zoho\\backend\\scripts\\migrate_legacy_roles.py [--apply] [--org <org_id>]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Ensure backend root on path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.firebase_client import get_db, init_firebase  # noqa: E402
from app.firestore.users import UserRepository  # noqa: E402
from app.api.rbac import UserRoleRepository  # noqa: E402
from app.services.permissions import DEFAULT_ROLES  # noqa: E402


def _legacy_to_role_id(role: str) -> str | None:
    if not role:
        return None
    if role == "admin":
        return "default:admin"
    if role in DEFAULT_ROLES:
        return f"default:{role}"
    return None


def _backup(payload: dict[str, Any]) -> Path:
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    out = ROOT / "backups" / f"legacy_roles_{ts}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    return out


def collect_orgs(only_org: str | None) -> list[str]:
    db = get_db()
    org_ids: set[str] = set()
    for doc in db.collection("orgs").stream():
        org_ids.add(doc.id)
    # Fallback: scan users collection (orgs may not exist as a top-level collection)
    for doc in db.collection("users").stream():
        oid = (doc.to_dict() or {}).get("org_id")
        if oid:
            org_ids.add(oid)
    if only_org:
        return [only_org] if only_org in org_ids else []
    return sorted(org_ids)


def migrate(apply: bool, only_org: str | None) -> int:
    org_ids = collect_orgs(only_org)
    print(f"[migrate] orgs: {len(org_ids)}")

    summary: dict[str, Any] = {
        "started_at": datetime.utcnow().isoformat() + "Z",
        "apply": apply,
        "orgs": {},
    }
    total_planned = 0
    total_applied = 0
    total_skipped = 0

    for org_id in org_ids:
        users_repo = UserRepository(org_id)
        ur_repo = UserRoleRepository(org_id)

        users, _ = users_repo.list(limit=1000)
        org_actions: list[dict[str, Any]] = []

        for u in users:
            legacy = (u.get("role") or "").strip()
            role_id = _legacy_to_role_id(legacy)
            if not role_id:
                continue

            existing, _ = ur_repo.list(
                filters=[
                    {"field": "user_id", "op": "==", "value": u["id"]},
                    {"field": "role_id", "op": "==", "value": role_id},
                ],
                limit=1,
            )
            if existing:
                total_skipped += 1
                continue

            action = {
                "user_id": u["id"],
                "email": u.get("email"),
                "legacy_role": legacy,
                "role_id": role_id,
            }
            org_actions.append(action)
            total_planned += 1

            if apply:
                ur_repo.create({
                    "user_id": u["id"],
                    "role_id": role_id,
                    "assigned_by": "migration:legacy_roles",
                    "assigned_at": datetime.utcnow(),
                })
                total_applied += 1

        if org_actions:
            summary["orgs"][org_id] = org_actions

    summary["totals"] = {
        "planned": total_planned,
        "applied": total_applied if apply else 0,
        "skipped_existing": total_skipped,
    }

    backup_path = _backup(summary)
    print(f"[migrate] report -> {backup_path}")
    print(f"[migrate] planned={total_planned} applied={total_applied if apply else 0} skipped={total_skipped}")
    if not apply:
        print("[migrate] dry-run only. Re-run with --apply to write.")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Migrate legacy user.role to RBAC user_roles")
    p.add_argument("--apply", action="store_true", help="Write changes (default: dry-run)")
    p.add_argument("--org", default=None, help="Limit to a single org_id")
    args = p.parse_args()
    # Ensure Firebase creds are set
    cred = os.path.join(str(ROOT), "serviceAccountKey.json")
    if os.path.exists(cred):
        os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", cred)
    init_firebase()
    return migrate(apply=args.apply, only_org=args.org)


if __name__ == "__main__":
    raise SystemExit(main())
