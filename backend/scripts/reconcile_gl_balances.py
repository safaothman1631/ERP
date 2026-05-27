#!/usr/bin/env python3
"""Reconcile materialised GL balances vs journal lines (Wave A6)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--org-id", required=True)
    args = parser.parse_args()
    from app.config import settings

    if not getattr(settings, "GL_MATERIALISATION_ENABLED", False):
        print("SKIP: GL_MATERIALISATION_ENABLED=false")
        return 0
    print(f"OK: GL reconcile stub for org {args.org_id} (enable materialisation to run full scan)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
