"""Wave K5 — builder for large org fixtures (in-memory)."""
from __future__ import annotations


def build_large_org_fixture(n: int = 1000) -> list[dict]:
    return [
        {"id": f"inv-{i}", "org_id": "org-large", "total": float(i), "status": "sent"}
        for i in range(n)
    ]
