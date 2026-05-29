"""Bump document _version inside atomic transaction payloads (Wave C3)."""
from __future__ import annotations


def next_version(current: dict | None) -> int:
    return int((current or {}).get("_version") or 1) + 1


def with_version_bump(payload: dict, current: dict | None) -> dict:
    return {**payload, "_version": next_version(current)}
