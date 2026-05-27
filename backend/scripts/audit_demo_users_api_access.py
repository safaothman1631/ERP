#!/usr/bin/env python3
"""Audit backend API access for shared-org demo role users."""
from __future__ import annotations

import base64
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

BASE_URL = "http://127.0.0.1:8000"
PASSWORD = "Demo@2026"
TIMEOUT = 60

ENDPOINTS: list[tuple[str, str]] = [
    ("GET", "/api/auth/me"),
    ("GET", "/api/system/public-config"),
    ("GET", "/api/onboarding/preferences"),
    ("GET", "/api/onboarding/license"),
    ("GET", "/api/rbac/me/permissions"),
    ("GET", "/api/rbac/roles"),
    ("GET", "/api/dashboard"),
]

DEMO_USERS: list[dict[str, Any]] = [
    {"email": "demo-owner@zohoerp.example.com", "role": "owner", "requires_2fa": True},
    {"email": "demo-admin@zohoerp.example.com", "role": "admin", "requires_2fa": True},
    {"email": "demo-manager@zohoerp.example.com", "role": "manager", "requires_2fa": False},
    {"email": "demo-accountant@zohoerp.example.com", "role": "accountant", "requires_2fa": False},
    {"email": "demo-sales@zohoerp.example.com", "role": "sales_rep", "requires_2fa": False},
    {"email": "demo-purchaser@zohoerp.example.com", "role": "purchaser", "requires_2fa": False},
    {"email": "demo-inventory@zohoerp.example.com", "role": "inventory_manager", "requires_2fa": False},
    {"email": "demo-cashier@zohoerp.example.com", "role": "cashier", "requires_2fa": False},
    {"email": "demo-hr@zohoerp.example.com", "role": "hr", "requires_2fa": False},
    {"email": "demo-projects@zohoerp.example.com", "role": "project_manager", "requires_2fa": False},
    {"email": "demo-viewer@zohoerp.example.com", "role": "viewer", "requires_2fa": False},
    {"email": "demo-user@zohoerp.example.com", "role": "user", "requires_2fa": False},
]


@dataclass
class EndpointResult:
    status: int | str
    detail: str = ""


@dataclass
class UserAudit:
    email: str
    role: str
    firestore_org_id: str | None = None
    login_status: int | str = ""
    login_detail: str = ""
    skipped_2fa: bool = False
    token_org_id: str | None = None
    jwt_org_id: str | None = None
    me_org_id: str | None = None
    endpoints: dict[str, EndpointResult] = field(default_factory=dict)


def decode_jwt_org_id(token: str) -> str | None:
    try:
        payload_b64 = token.split(".")[1]
        padding = "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + padding))
        org = payload.get("org_id")
        return str(org) if org else None
    except Exception as exc:  # noqa: BLE001
        return f"decode_error:{exc}"


def error_detail(resp: requests.Response) -> str:
    try:
        body = resp.json()
    except Exception:
        text = (resp.text or "").strip()
        return text[:240] if text else resp.reason or ""
    if isinstance(body, dict):
        detail = body.get("detail", body)
        if isinstance(detail, (dict, list)):
            return json.dumps(detail, ensure_ascii=False)[:240]
        return str(detail)[:240]
    return str(body)[:240]


def fetch_firestore_org_ids() -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    try:
        from app.firebase_client import get_db, init_firebase

        init_firebase()
        db = get_db()
        for u in DEMO_USERS:
            email = u["email"]
            org_id = None
            docs = list(db.collection("users").where("email", "==", email).limit(1).stream())
            if docs:
                org_id = (docs[0].to_dict() or {}).get("org_id")
            out[email] = org_id
    except Exception as exc:  # noqa: BLE001
        for u in DEMO_USERS:
            out[u["email"]] = None
        out["__firestore_error__"] = str(exc)
    return out


def login(session: requests.Session, email: str) -> tuple[int, str, str | None, str | None]:
    url = f"{BASE_URL}/api/auth/login"
    resp = session.post(url, json={"email": email, "password": PASSWORD}, timeout=TIMEOUT)
    if resp.status_code != 200:
        return resp.status_code, error_detail(resp), None, None
    data = resp.json()
    token = data.get("access_token")
    org_id = data.get("org_id")
    return 200, "", token, org_id


def call_endpoint(session: requests.Session, method: str, path: str, token: str) -> EndpointResult:
    url = f"{BASE_URL}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        resp = session.request(method, url, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as exc:
        return EndpointResult(status="ERR", detail=str(exc)[:240])
    if resp.status_code >= 400:
        return EndpointResult(status=resp.status_code, detail=error_detail(resp))
    return EndpointResult(status=resp.status_code, detail="")


def print_table(rows: list[list[str]]) -> None:
    widths = [max(len(row[i]) for row in rows) for i in range(len(rows[0]))]
    for ri, row in enumerate(rows):
        line = " | ".join(cell.ljust(widths[i]) for i, cell in enumerate(row))
        print(line)
        if ri == 0:
            print("-+-".join("-" * w for w in widths))


def main() -> int:
    firestore_orgs = fetch_firestore_org_ids()
    firestore_err = firestore_orgs.pop("__firestore_error__", None)

    audits: list[UserAudit] = []
    session = requests.Session()

    org_ids_firestore = {v for k, v in firestore_orgs.items() if v}
    shared_org_ok = len(org_ids_firestore) <= 1 and len(org_ids_firestore) == 1

    print("=== Demo user org_id (Firestore) ===")
    if firestore_err:
        print(f"Firestore lookup error: {firestore_err}")
    for u in DEMO_USERS:
        print(f"  {u['email']}: {firestore_orgs.get(u['email'])}")
    print(f"All share one org_id (Firestore): {shared_org_ok}")
    if org_ids_firestore:
        print(f"Canonical org_id: {next(iter(org_ids_firestore))}")
    print()

    jwt_org_ids: set[str] = set()
    failures: list[str] = []

    for u in DEMO_USERS:
        audit = UserAudit(email=u["email"], role=u["role"], firestore_org_id=firestore_orgs.get(u["email"]))
        status, detail, token, token_org = login(session, u["email"])
        audit.login_status = status
        audit.login_detail = detail

        if status == 401 and "2fa_code_required" in detail:
            audit.skipped_2fa = True
            audit.login_detail = "SKIPPED: TOTP required (2FA enabled)"
            failures.append(f"{u['email']}: login skipped (2FA/TOTP required)")
            audits.append(audit)
            continue

        if status != 200 or not token:
            failures.append(f"{u['email']}: login failed ({status}) {detail}")
            audits.append(audit)
            continue

        audit.token_org_id = token_org
        jwt_org = decode_jwt_org_id(token)
        if jwt_org and not str(jwt_org).startswith("decode_error"):
            audit.jwt_org_id = jwt_org
            jwt_org_ids.add(jwt_org)
        else:
            audit.jwt_org_id = jwt_org
            failures.append(f"{u['email']}: JWT org_id decode failed: {jwt_org}")

        if token_org and jwt_org and token_org != jwt_org:
            failures.append(f"{u['email']}: login org_id != JWT org_id ({token_org} vs {jwt_org})")

        for method, path in ENDPOINTS:
            er = call_endpoint(session, method, path, token)
            audit.endpoints[path] = er
            if isinstance(er.status, int) and er.status >= 400:
                failures.append(f"{u['email']} {path}: HTTP {er.status} {er.detail}")
            elif er.status == "ERR":
                failures.append(f"{u['email']} {path}: request error {er.detail}")

        me_path = "/api/auth/me"
        if me_path in audit.endpoints and isinstance(audit.endpoints[me_path].status, int) and audit.endpoints[me_path].status == 200:
            me_resp = session.get(f"{BASE_URL}{me_path}", headers={"Authorization": f"Bearer {token}"}, timeout=TIMEOUT)
            try:
                audit.me_org_id = me_resp.json().get("org_id")
            except Exception:
                audit.me_org_id = None
            if audit.me_org_id and audit.jwt_org_id and audit.me_org_id != audit.jwt_org_id:
                failures.append(f"{u['email']}: /me org_id != JWT org_id")

        audits.append(audit)

    print("=== JWT org_id consistency (logged-in users) ===")
    print(f"Distinct JWT org_id values: {sorted(jwt_org_ids)}")
    jwt_match_ok = len(jwt_org_ids) <= 1
    print(f"All JWT org_id match: {jwt_match_ok}")
    print()

    header = ["role", "email", "login", "jwt_org_id", "skipped_2fa"]
    for _, path in ENDPOINTS:
        header.append(path.replace("/api/", ""))
    table_rows: list[list[str]] = [header]

    for a in audits:
        row = [
            a.role,
            a.email,
            str(a.login_status) if not a.skipped_2fa else "2FA_SKIP",
            a.jwt_org_id or "",
            "yes" if a.skipped_2fa else "no",
        ]
        for _, path in ENDPOINTS:
            er = a.endpoints.get(path)
            if er is None:
                row.append("-")
            elif er.detail:
                row.append(f"{er.status} ({er.detail[:80]})")
            else:
                row.append(str(er.status))
        table_rows.append(row)

    print("=== Full results table ===")
    print_table(table_rows)
    print()

    print("=== Failures / errors ===")
    if not failures:
        print("(none)")
    else:
        for f in failures:
            print(f"  - {f}")

    return 0 if shared_org_ok and jwt_match_ok and not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
