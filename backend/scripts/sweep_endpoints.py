from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from urllib import error, request


DEFAULT_BASE_URL = "http://127.0.0.1:8000"
DEFAULT_EMAIL = "admin@test.com"
DEFAULT_PASSWORD = "123456"
SKIP_PATHS = {"/", "/api/health"}


@dataclass
class SweepResult:
    method: str
    path: str
    status: int
    duration_ms: int
    category: str
    detail: str = ""


def make_request(
    method: str,
    url: str,
    *,
    data: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 15,
) -> tuple[int, str, int]:
    body = None
    req_headers = {"Accept": "application/json"}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    if headers:
        req_headers.update(headers)

    req = request.Request(url=url, data=body, headers=req_headers, method=method)
    started_at = time.perf_counter()
    try:
        with request.urlopen(req, timeout=timeout) as response:
            payload = response.read().decode("utf-8", errors="replace")
            duration_ms = int((time.perf_counter() - started_at) * 1000)
            return response.status, payload, duration_ms
    except error.HTTPError as exc:
        payload = exc.read().decode("utf-8", errors="replace")
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        return exc.code, payload, duration_ms
    except error.URLError as exc:
        duration_ms = int((time.perf_counter() - started_at) * 1000)
        return 0, str(exc.reason), duration_ms


def authenticate(base_url: str, email: str, password: str) -> str:
    status, payload, _ = make_request(
        "POST",
        f"{base_url}/api/auth/login",
        data={"email": email, "password": password},
    )
    if status != 200:
        raise RuntimeError(f"Login failed with status {status}: {payload[:300]}")
    token = json.loads(payload).get("access_token")
    if not token:
        raise RuntimeError("Login response did not include access_token")
    return token


def fetch_openapi(base_url: str) -> dict[str, Any]:
    status, payload, _ = make_request("GET", f"{base_url}/openapi.json")
    if status != 200:
        raise RuntimeError(f"OpenAPI fetch failed with status {status}: {payload[:300]}")
    return json.loads(payload)


def has_required_runtime_params(operation: dict[str, Any]) -> bool:
    for parameter in operation.get("parameters", []):
        if parameter.get("required") and parameter.get("in") in {"query", "header", "cookie"}:
            return True
    return False


def build_results(schema: dict[str, Any], base_url: str, token: str) -> list[SweepResult]:
    results: list[SweepResult] = []
    headers = {"Authorization": f"Bearer {token}"}

    for path, methods in schema.get("paths", {}).items():
        if path in SKIP_PATHS or "{" in path:
            continue

        operation = methods.get("get")
        if not operation or has_required_runtime_params(operation):
            continue

        status, payload, duration_ms = make_request("GET", f"{base_url}{path}", headers=headers)
        if status == 0:
            category = "network_error"
        elif status >= 500:
            category = "server_error"
        elif status >= 400:
            category = "client_error"
        else:
            category = "ok"

        results.append(
            SweepResult(
                method="GET",
                path=path,
                status=status,
                duration_ms=duration_ms,
                category=category,
                detail=payload[:200],
            )
        )

    return results


def summarize(results: list[SweepResult]) -> dict[str, Any]:
    counts = {
        "total": len(results),
        "ok": sum(item.category == "ok" for item in results),
        "client_error": sum(item.category == "client_error" for item in results),
        "server_error": sum(item.category == "server_error" for item in results),
        "network_error": sum(item.category == "network_error" for item in results),
    }
    slowest = sorted(results, key=lambda item: item.duration_ms, reverse=True)[:10]
    return {
        "summary": counts,
        "slowest": [asdict(item) for item in slowest],
        "issues": [asdict(item) for item in results if item.category != "ok"],
        "results": [asdict(item) for item in results],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke-test GET endpoints from OpenAPI")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--email", default=DEFAULT_EMAIL)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    token = authenticate(args.base_url, args.email, args.password)
    schema = fetch_openapi(args.base_url)
    results = build_results(schema, args.base_url, token)
    report = summarize(results)

    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    if report["issues"]:
        print("\nIssues:")
        for item in report["issues"][:25]:
            print(f"- {item['status']} {item['method']} {item['path']} [{item['category']}]")
    else:
        print("\nNo GET endpoint issues found.")

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nSaved report to {args.output}")

    return 1 if report["summary"]["server_error"] or report["summary"]["network_error"] else 0


if __name__ == "__main__":
    sys.exit(main())