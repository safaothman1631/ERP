from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib import error, request


DEFAULT_BASE_URL = "http://127.0.0.1:8000"
REPO_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_ROOT = REPO_ROOT / "frontend" / "src"
CALL_PATTERN = re.compile(
    r"\bapi\.(get|post|put|patch|delete)\(\s*(?P<quote>`|'|\")(?P<path>/api[^`'\"\n]+?)(?P=quote)",
    re.MULTILINE,
)


def make_request(url: str, timeout: int = 15) -> dict[str, Any]:
    req = request.Request(url=url, headers={"Accept": "application/json"}, method="GET")
    try:
        with request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8", errors="replace"))
    except error.HTTPError as exc:
        payload = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GET {url} failed with status {exc.code}: {payload[:300]}") from exc


def normalize_path(path: str) -> str:
    normalized = path.split("?", 1)[0]
    normalized = re.sub(r"\$\{[^}]+\}", "{}", normalized)
    normalized = re.sub(r"\{[^}/]+\}", "{}", normalized)
    normalized = re.sub(r"/+", "/", normalized)
    normalized = normalized.rstrip("/")
    return normalized or "/"


def extract_frontend_calls() -> dict[tuple[str, str], list[str]]:
    matches: dict[tuple[str, str], list[str]] = defaultdict(list)
    for file_path in FRONTEND_ROOT.rglob("*.ts*"):
        content = file_path.read_text(encoding="utf-8", errors="replace")
        for match in CALL_PATTERN.finditer(content):
            method = match.group(1).upper()
            raw_path = match.group("path")
            normalized_path = normalize_path(raw_path)
            location = f"{file_path.relative_to(REPO_ROOT)}:{content.count(chr(10), 0, match.start()) + 1}"
            matches[(method, normalized_path)].append(location)
    return matches


def extract_backend_routes(schema: dict[str, Any]) -> set[tuple[str, str]]:
    routes: set[tuple[str, str]] = set()
    for path, methods in schema.get("paths", {}).items():
        for method in methods:
            method_name = method.upper()
            if method_name in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
                routes.add((method_name, normalize_path(path)))
    return routes


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare frontend API calls with backend OpenAPI routes")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    schema = make_request(f"{args.base_url}/openapi.json")
    frontend_calls = extract_frontend_calls()
    backend_routes = extract_backend_routes(schema)

    missing_in_backend = []
    for key, locations in sorted(frontend_calls.items()):
        if key not in backend_routes:
            missing_in_backend.append({
                "method": key[0],
                "path": key[1],
                "locations": locations,
            })

    unused_backend = [
        {"method": method, "path": path}
        for method, path in sorted(backend_routes)
        if (method, path) not in frontend_calls
    ]

    report = {
        "frontend_call_count": len(frontend_calls),
        "backend_route_count": len(backend_routes),
        "missing_in_backend": missing_in_backend,
        "unused_backend": unused_backend,
    }

    print(json.dumps(
        {
            "frontend_call_count": report["frontend_call_count"],
            "backend_route_count": report["backend_route_count"],
            "missing_in_backend_count": len(missing_in_backend),
            "unused_backend_count": len(unused_backend),
        },
        ensure_ascii=False,
        indent=2,
    ))

    if missing_in_backend:
        print("\nMissing in backend:")
        for item in missing_in_backend[:25]:
            print(f"- {item['method']} {item['path']} @ {item['locations'][0]}")
    else:
        print("\nNo frontend calls are missing in backend OpenAPI.")

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nSaved report to {args.output}")

    return 1 if missing_in_backend else 0


if __name__ == "__main__":
    sys.exit(main())