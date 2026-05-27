"""Parse If-Match / expected_version for optimistic concurrency (Wave C)."""
from __future__ import annotations

import re
from typing import Optional

from fastapi import Header


def parse_version_header(if_match: Optional[str]) -> Optional[int]:
    if not if_match:
        return None
    raw = if_match.strip()
    m = re.match(r'^W/?"(\d+)"$', raw) or re.match(r'^"(\d+)"$', raw) or re.match(r"^(\d+)$", raw)
    if not m:
        return None
    return int(m.group(1))


def get_expected_version(
    if_match: Optional[str] = Header(None, alias="If-Match"),
) -> Optional[int]:
    return parse_version_header(if_match)
