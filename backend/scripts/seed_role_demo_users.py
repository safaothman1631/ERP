#!/usr/bin/env python3
"""Seed one demo user per tenant role in a shared org (Role UX testing).

Keeps safaothman1631@gmail.com as the only super_admin / platform vendor account.

Usage (PowerShell):
  cd backend
  .\\venv\\Scripts\\python.exe scripts\\seed_role_demo_users.py [--apply]
  .\\venv\\Scripts\\python.exe scripts\\seed_role_demo_users.py --apply --ensure-vendor

Default is dry-run; pass --apply to write to Firestore.
"""
from __future__ import annotations

import argparse
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.api.auth import _seed_org  # noqa: E402
from app.api.rbac import UserRoleRepository  # noqa: E402
from app.firebase_client import get_db, init_firebase  # noqa: E402
from app.firestore.users import UserRepository  # noqa: E402
from app.services.auth import hash_password  # noqa: E402
from app.services.permissions import DEFAULT_ROLES  # noqa: E402

DEMO_PASSWORD = "Demo@2026"
DEMO_ORG_NAME = "ڕێکخراوی دیمۆ — هەموو رۆڵەکان"
DEMO_ORG_SLUG = "role-demo-all-roles"
VENDOR_EMAIL = "safaothman1631@gmail.com"

# (legacy role, email, display name)
DEMO_ROLE_USERS: list[tuple[str, str, str]] = [
    ("owner", "demo-owner@zohoerp.example.com", "خاوەنی دیمۆ"),
    ("admin", "demo-admin@zohoerp.example.com", "ئادمینی دیمۆ"),
    ("manager", "demo-manager@zohoerp.example.com", "بەڕێوەبەری دیمۆ"),
    ("accountant", "demo-accountant@zohoerp.example.com", "ژمێریاری دیمۆ"),
    ("sales_rep", "demo-sales@zohoerp.example.com", "فرۆشیاری دیمۆ"),
    ("purchaser", "demo-purchaser@zohoerp.example.com", "کڕیاری دیمۆ"),
    ("inventory_manager", "demo-inventory@zohoerp.example.com", "مەخزەنی دیمۆ"),
    ("cashier", "demo-cashier@zohoerp.example.com", "خەزنەداری دیمۆ"),
    ("hr", "demo-hr@zohoerp.example.com", "HR دیمۆ"),
    ("project_manager", "demo-projects@zohoerp.example.com", "پرۆژەی دیمۆ"),
    ("viewer", "demo-viewer@zohoerp.example.com", "بینەری دیمۆ"),
    ("user", "demo-user@zohoerp.example.com", "کارمەندی دیمۆ"),
]

# Map legacy role → RBAC default role id (when available in DEFAULT_ROLES)
_RBAC_ALIASES: dict[str, str] = {
    "owner": "owner",
    "admin": "admin",
    "accountant": "accountant",
    "sales_rep": "sales",
    "purchaser": "purchaser",
    "inventory_manager": "inventory",
    "cashier": "cashier",
    "hr": "hr_manager",
    "project_manager": "project_manager",
    "viewer": "viewer",
    "user": "hr_employee",
}


def _rbac_role_id(legacy_role: str) -> str | None:
    code = _RBAC_ALIASES.get(legacy_role, legacy_role)
    if code in DEFAULT_ROLES:
        return f"default:{code}"
    return None


def _find_demo_org_id(db) -> str | None:
    marker = DEMO_ROLE_USERS[0][1].lower()
    docs = list(db.collection("users").where("email", "==", marker).limit(1).stream())
    if docs:
        return (docs[0].to_dict() or {}).get("org_id")
    return None


def _ensure_demo_org(db, apply: bool) -> str:
    existing = _find_demo_org_id(db)
    if existing:
        print(f"[seed] using existing demo org: {existing}")
        if apply:
            _ensure_demo_onboarding(db, existing)
        return existing

    org_id = str(uuid.uuid4())
    print(f"[seed] would create demo org: {org_id} ({DEMO_ORG_SLUG})")
    if apply:
        _seed_org(org_id, DEMO_ORG_NAME, "IQD", "ku")
        _ensure_demo_onboarding(db, org_id)
        print(f"[seed] created demo org: {org_id}")
    return org_id


def _ensure_demo_onboarding(db, org_id: str) -> None:
    """Mark demo org onboarding complete so role UX testing skips the wizard."""
    from app.services.onboarding_prefs import (
        OnboardingPreferencesRepository,
        fetch_prefs,
        merge_enabled_modules,
    )
    from app.services.org_license import BUNDLES, PRODUCTION_CORE_MODULES

    db.collection("organizations").document(org_id).set({
        "is_demo_org": True,
        "demo_purpose": "role_ux",
        "license": {
            "bundle_id": "full_core",
            "allowed_modules": BUNDLES["full_core"],
            "tier": "demo",
        },
    }, merge=True)

    merge_enabled_modules(org_id, list(PRODUCTION_CORE_MODULES), industry_id="retail_trading")

    repo = OnboardingPreferencesRepository(org_id)
    doc = fetch_prefs(repo, org_id)
    if doc:
        repo.update(doc["id"], {
            "require_module_approval": False,
            "completed": True,
        })
        print(f"[seed] demo onboarding complete for org {org_id}")


def _clear_user_roles(ur_repo: UserRoleRepository, user_id: str, apply: bool) -> int:
    existing, _ = ur_repo.list(
        filters=[{"field": "user_id", "op": "==", "value": user_id}],
        limit=1000,
    )
    if apply:
        for item in existing:
            ur_repo.delete(item["id"])
    return len(existing)


def _assign_rbac_role(
    ur_repo: UserRoleRepository,
    user_id: str,
    legacy_role: str,
    actor: str,
    apply: bool,
) -> str | None:
    role_id = _rbac_role_id(legacy_role)
    if not role_id:
        return None
    if apply:
        ur_repo.create({
            "user_id": user_id,
            "role_id": role_id,
            "assigned_by": actor,
            "assigned_at": datetime.utcnow().isoformat(),
        })
    return role_id


def _upsert_demo_user(
    db,
    org_id: str,
    legacy_role: str,
    email: str,
    name: str,
    apply: bool,
) -> dict:
    email = email.strip().lower()
    user_repo = UserRepository(org_id)
    ur_repo = UserRoleRepository(org_id)

    existing = user_repo.find_by_email(email)
    if existing and existing.get("org_id") != org_id:
        raise RuntimeError(f"{email} belongs to another org ({existing.get('org_id')})")

    payload = {
        "name": name,
        "email": email,
        "role": legacy_role,
        "is_active": True,
        "auth_provider": "email",
        "is_platform_admin": False,
        "is_super_admin": False,
        "demo_user": True,
        "demo_role": legacy_role,
    }

    if existing:
        user_id = existing["id"]
        action = "update"
        if apply:
            if not existing.get("password_hash"):
                payload["password_hash"] = hash_password(DEMO_PASSWORD)
            db.collection("users").document(user_id).set(payload, merge=True)
    else:
        user_id = str(uuid.uuid4())
        action = "create"
        payload.update({
            "id": user_id,
            "org_id": org_id,
            "password_hash": hash_password(DEMO_PASSWORD),
            "created_at": datetime.utcnow(),
        })
        if apply:
            user_repo.create(payload)

    removed = _clear_user_roles(ur_repo, user_id, apply)
    assigned = _assign_rbac_role(ur_repo, user_id, legacy_role, "system:seed_role_demo_users", apply)

    return {
        "action": action,
        "user_id": user_id,
        "email": email,
        "role": legacy_role,
        "rbac_role_id": assigned,
        "rbac_cleared": removed,
    }


def ensure_vendor_super_admin_only(db, apply: bool) -> list[dict]:
    """Ensure vendor account is super_admin only (no tenant demo roles)."""
    email = VENDOR_EMAIL.strip().lower()
    results: list[dict] = []
    docs = list(db.collection("users").where("email", "==", email).stream())
    if not docs:
        print(f"[vendor] user not found: {email} (skip — run promote_super_admin.py after register)")
        return results

    for doc in docs:
        data = doc.to_dict() or {}
        uid = doc.id
        org_id = data.get("org_id")
        updates = {
            "role": "super_admin",
            "is_platform_admin": True,
            "is_super_admin": True,
            "is_active": True,
            "demo_user": False,
        }
        if apply:
            db.collection("users").document(uid).update(updates)

        cleared = 0
        assigned_platform = False
        if org_id:
            ur_repo = UserRoleRepository(org_id)
            cleared = _clear_user_roles(ur_repo, uid, apply)
            if apply:
                ur_repo.create({
                    "user_id": uid,
                    "role_id": "default:platform_admin",
                    "assigned_by": "system:seed_role_demo_users",
                    "assigned_at": datetime.utcnow().isoformat(),
                })
            assigned_platform = True
            if apply:
                db.collection("organizations").document(org_id).set({
                    "is_platform_org": True,
                    "platform_tier": "vendor",
                }, merge=True)

        results.append({
            "user_id": uid,
            "email": email,
            "org_id": org_id,
            "rbac_cleared": cleared,
            "platform_admin_assigned": assigned_platform,
        })
        print(f"[vendor] {email} -> super_admin only (cleared {cleared} RBAC rows)")

    return results


def seed_demo_users(apply: bool, ensure_vendor: bool) -> int:
    db = get_db()
    org_id = _ensure_demo_org(db, apply)

    print(f"\n[seed] demo org_id: {org_id}")
    print(f"[seed] shared password: {DEMO_PASSWORD}\n")

    rows: list[dict] = []
    for legacy_role, email, name in DEMO_ROLE_USERS:
        if email.lower() == VENDOR_EMAIL.lower():
            continue
        row = _upsert_demo_user(db, org_id, legacy_role, email, name, apply)
        rows.append(row)
        rbac = row["rbac_role_id"] or "(legacy role only)"
        print(f"  [{row['action']}] {email:40} role={legacy_role:18} rbac={rbac}")

    if ensure_vendor:
        print()
        ensure_vendor_super_admin_only(db, apply)

    print(f"\n[seed] users planned/updated: {len(rows)}")
    if not apply:
        print("[seed] dry-run only. Re-run with --apply to write.")
    else:
        print("[seed] done. Log out and log in again to refresh JWT role claims.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed demo users for each tenant role")
    parser.add_argument("--apply", action="store_true", help="Write changes (default: dry-run)")
    parser.add_argument(
        "--ensure-vendor",
        action="store_true",
        help=f"Reset {VENDOR_EMAIL} to super_admin only",
    )
    args = parser.parse_args()

    cred = ROOT / "serviceAccountKey.json"
    if cred.exists():
        os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", str(cred))

    init_firebase()
    return seed_demo_users(apply=args.apply, ensure_vendor=args.ensure_vendor or args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
