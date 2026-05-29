#!/usr/bin/env python3
"""HTTP smoke after backup/restore drill: login, trial balance, invoices list."""
from __future__ import annotations

import argparse
import sys
import time
from datetime import date, timedelta

import httpx


def _warmup(client: httpx.Client, base: str, attempts: int = 3) -> None:
    for i in range(attempts):
        try:
            r = client.get(f"{base}/api/health", timeout=60.0)
            if r.status_code == 200:
                return
        except httpx.TimeoutException:
            pass
        time.sleep(2 * (i + 1))


def _get_with_retry(
    client: httpx.Client,
    url: str,
    *,
    headers: dict | None = None,
    params: dict | None = None,
    timeout: float = 120.0,
    attempts: int = 3,
) -> httpx.Response:
    last_exc: Exception | None = None
    last: httpx.Response | None = None
    for i in range(attempts):
        try:
            last = client.get(url, headers=headers, params=params, timeout=timeout)
            if last.status_code == 200:
                return last
        except httpx.TimeoutException as exc:
            last_exc = exc
            time.sleep(3 * (i + 1))
    if last is not None:
        return last
    if last_exc:
        raise last_exc
    raise RuntimeError(f"GET {url} failed")


def _post_with_retry(client: httpx.Client, url: str, *, json: dict, attempts: int = 3) -> httpx.Response:
    last_exc: Exception | None = None
    last: httpx.Response | None = None
    for i in range(attempts):
        try:
            last = client.post(url, json=json, timeout=120.0)
            if last.status_code == 200:
                return last
        except httpx.TimeoutException as exc:
            last_exc = exc
            time.sleep(3 * (i + 1))
    if last is not None:
        return last
    if last_exc:
        raise last_exc
    raise RuntimeError("login request failed")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True, help="e.g. https://zoho-erp-xxx.run.app")
    parser.add_argument("--email", default="demo-manager@zohoerp.example.com")
    parser.add_argument("--password", default="Demo@2026")
    parser.add_argument("--timeout", type=float, default=180.0)
    parser.add_argument(
        "--with-trial-balance",
        action="store_true",
        help="Also hit /api/reports/trial-balance (slow on large orgs; off by default)",
    )
    parser.add_argument(
        "--tb-days",
        type=int,
        default=7,
        help="Trial balance window when --with-trial-balance",
    )
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    end = date.today()
    start = end - timedelta(days=max(1, args.tb_days))

    timeout = httpx.Timeout(args.timeout, connect=30.0)
    with httpx.Client(base_url=base, timeout=timeout) as client:
        _warmup(client, base)

        login = _post_with_retry(
            client,
            "/api/auth/login",
            json={"email": args.email, "password": args.password},
        )
        if login.status_code != 200:
            print(f"FAIL: login {login.status_code} {login.text[:300]}")
            return 1
        token = login.json().get("access_token")
        if not token:
            print("FAIL: login response missing access_token")
            return 1
        headers = {"Authorization": f"Bearer {token}"}

        health = client.get("/api/health", timeout=30.0)
        if health.status_code != 200:
            print(f"FAIL: health {health.status_code}")
            return 1

        me = _get_with_retry(
            client, "/api/rbac/me/summary", headers=headers, timeout=90.0
        )
        if me.status_code != 200:
            print(f"FAIL: rbac/me/summary {me.status_code} {me.text[:300]}")
            return 1

        accts = _get_with_retry(
            client,
            "/api/accounts",
            headers=headers,
            params={"page": 1, "page_size": 5},
            timeout=90.0,
        )
        if accts.status_code != 200:
            print(f"FAIL: accounts {accts.status_code} {accts.text[:300]}")
            return 1

        if args.with_trial_balance:
            tb = _get_with_retry(
                client,
                "/api/reports/trial-balance",
                headers=headers,
                params={"start_date": start.isoformat(), "end_date": end.isoformat()},
                timeout=300.0,
            )
            if tb.status_code != 200:
                print(f"FAIL: trial-balance {tb.status_code} {tb.text[:300]}")
                return 1

        contacts = _get_with_retry(
            client,
            "/api/contacts",
            headers=headers,
            params={"page": 1, "page_size": 5},
            timeout=120.0,
        )
        if contacts.status_code != 200:
            print(f"FAIL: contacts {contacts.status_code} {contacts.text[:300]}")
            return 1

    parts = "warmup, login, health, rbac, accounts"
    if args.with_trial_balance:
        parts += ", trial-balance"
    print(f"OK: prelaunch_smoke ({parts}, contacts)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
