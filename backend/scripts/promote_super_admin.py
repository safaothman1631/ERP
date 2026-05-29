#!/usr/bin/env python3
"""Promote a user to super_admin / platform administrator.

Usage:
  python scripts/promote_super_admin.py --email safaothman1631@gmail.com
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.firebase_client import init_firebase, get_db


def promote(email: str) -> None:
    init_firebase()
    db = get_db()
    email = email.strip().lower()
    users = list(db.collection("users").where("email", "==", email).stream())
    if not users:
        raise SystemExit(f"User not found: {email}")

    for doc in users:
        data = doc.to_dict()
        org_id = data.get("org_id")
        updates = {
            "role": "super_admin",
            "is_platform_admin": True,
            "is_super_admin": True,
            "is_active": True,
            "failed_login_attempts": 0,
            "locked_until": None,
            "promoted_at": datetime.utcnow().isoformat(),
            "promoted_to": "super_admin",
        }
        db.collection("users").document(doc.id).update(updates)
        print(f"Promoted user {doc.id} ({email}) -> super_admin (org={org_id})")

        if org_id:
            db.collection("organizations").document(org_id).set({
                "is_platform_org": True,
                "platform_tier": "vendor",
            }, merge=True)
            print(f"Marked org {org_id} as platform vendor org")

            prefs = list(
                db.collection("onboarding_preferences").where("org_id", "==", org_id).limit(1).stream()
            )
            if prefs:
                db.collection("onboarding_preferences").document(prefs[0].id).set({
                    "require_module_approval": False,
                }, merge=True)
                print("Disabled require_module_approval for org onboarding")

            db.collection("user_roles").add({
                "org_id": org_id,
                "user_id": doc.id,
                "role_id": "default:platform_admin",
                "assigned_at": datetime.utcnow().isoformat(),
                "assigned_by": "system:promote_super_admin",
            })
            print("Assigned RBAC role default:platform_admin")

    print("\nDone. User must log out and log in again to refresh session.")
    print(f"Add to backend .env (production): PLATFORM_ADMIN_USER_IDS={users[0].id}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    promote(args.email)
