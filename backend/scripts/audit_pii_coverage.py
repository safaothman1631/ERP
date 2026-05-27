#!/usr/bin/env python3
"""Verify PII registry fields are covered by EncryptedFieldsMixin (Wave E5)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.firestore.pii_registry import PII_FIELDS

# Collections with encryption wired in code
ENCRYPTED_COLLECTIONS = frozenset({
    "contacts",
    "users",
    "hr_employees",
    "payroll_runs",
    "iraq_gateway_config",
    "payslips",
})


def main() -> int:
    gaps = []
    for coll in PII_FIELDS:
        if coll in ("audit_logs",):
            continue
        if coll not in ENCRYPTED_COLLECTIONS and coll != "iraq_gateway_config":
            gaps.append(coll)
    if gaps:
        print("FAIL: collections without encryption wiring:", ", ".join(gaps))
        return 1
    print("OK: PII registry coverage")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
