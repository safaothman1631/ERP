"""Phase 3 — Pydantic Schema Extractor.

Dumps every BaseModel subclass in app.schemas.schemas as JSON:
{ class_name: { fields: [{name, type, required}], ... }, ... }

Usage:
    venv\\Scripts\\python.exe scripts\\schema_extract.py > schemas.json
"""
from __future__ import annotations

import inspect
import json
import sys
from pathlib import Path

# Allow running from backend/ root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pydantic import BaseModel  # noqa: E402

from app.schemas import schemas as S  # noqa: E402


def field_info(model: type[BaseModel]) -> list[dict]:
    out: list[dict] = []
    for name, f in model.model_fields.items():
        annotation = f.annotation
        type_str = getattr(annotation, "__name__", str(annotation))
        out.append({
            "name": name,
            "type": type_str,
            "required": f.is_required(),
            "default": None if f.default is ... else repr(f.default) if f.default is not None else None,
        })
    return out


def main() -> None:
    result: dict[str, dict] = {}
    for name, obj in inspect.getmembers(S, inspect.isclass):
        if not issubclass(obj, BaseModel) or obj is BaseModel:
            continue
        if obj.__module__ != S.__name__:
            continue
        result[name] = {"fields": field_info(obj)}
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"# Extracted {len(result)} schemas", file=sys.stderr)


if __name__ == "__main__":
    main()
