"""Dump all FastAPI routes (path + methods) from app.main to JSON.

Usage:
  venv\\Scripts\\python.exe scripts\\api_routes.py > scripts\\_api_routes.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.routing import APIRoute  # noqa: E402

from app.main import app  # noqa: E402


def main() -> None:
    rows = []
    for route in app.routes:
        if isinstance(route, APIRoute):
            rows.append({
                "path": route.path,
                "methods": sorted(m for m in route.methods if m != "HEAD"),
                "name": route.name,
            })
    rows.sort(key=lambda r: r["path"])
    json.dump(rows, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
