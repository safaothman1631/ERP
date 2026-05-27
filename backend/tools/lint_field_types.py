#!/usr/bin/env python3
"""Heuristic lint for legacy Firestore field type drift (Wave V9)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT / "backend" / "app" / "firestore"

LEGACY_PATTERNS = (
    (re.compile(r"created_at_iso"), "created_at_iso legacy field"),
    (re.compile(r"tenant_id"), "tenant_id instead of org_id"),
    (re.compile(r"organization_id"), "organization_id instead of org_id"),
)


def main() -> int:
    issues: list[str] = []
    for path in sorted(REPO.rglob("*.py")):
        if path.name in {"references.py", "pii_registry.py"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for pattern, msg in LEGACY_PATTERNS:
            if pattern.search(text):
                issues.append(f"{path.relative_to(ROOT)}: {msg}")
    if issues:
        print("FAIL: field type / naming drift:")
        for line in issues:
            print(f"  - {line}")
        return 1
    print(f"OK: field types lint ({len(list(REPO.rglob('*.py')))} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
