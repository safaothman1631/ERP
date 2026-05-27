#!/usr/bin/env python3
"""Naming convention lint (Wave N)."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIRESTORE = ROOT / "app" / "firestore"

FORBIDDEN = ("tenant_id", "organization_id", "companyId")
AUDIT_FIELDS = {
    "created_at", "created_by", "updated_at", "updated_by",
    "deleted_at", "deleted_by", "_version", "schema_version",
}


def scan() -> list[str]:
    errors: list[str] = []
    for path in FIRESTORE.glob("*.py"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for bad in FORBIDDEN:
            if bad in text:
                errors.append(f"{path.name}: forbidden identifier {bad}")
        for m in re.finditer(r'collection_name\s*=\s*["\']([a-z_0-9]+)["\']', text):
            name = m.group(1)
            if not re.match(r"^[a-z][a-z0-9_]*$", name):
                errors.append(f"{path.name}: collection_name not snake_case: {name}")
        for drift in ("createdAt", "modified_at", "updated_on"):
            if drift in text:
                errors.append(f"{path.name}: audit field drift {drift}")
    return errors


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--baseline", default=None)
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    errors = scan()
    if args.baseline:
        baseline = set(json.loads(Path(args.baseline).read_text(encoding="utf-8")))
        errors = [e for e in errors if e not in baseline]

    if args.json:
        print(json.dumps(errors, indent=2))
    else:
        for e in errors:
            print("ERROR:", e, file=sys.stderr)
    if errors:
        return 1
    print(f"OK: naming lint ({len(list(FIRESTORE.glob('*.py')))} files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
