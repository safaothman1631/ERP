"""MDM golden-record engine (Pool 3.6) — pure dedup + merge.

Greenfield + pure: group master records that match on key fields, then merge a
group into one golden record (most-recent non-empty value wins per field).
"""
from __future__ import annotations


def _norm(v) -> str:
    return str(v if v is not None else "").strip().lower()


def match_score(a: dict, b: dict, keys: list[str]) -> float:
    """Fraction of key fields where both records have an equal, non-empty value.
    1.0 = every key matches; 0.0 = none."""
    if not keys:
        return 0.0
    matches = 0
    for k in keys:
        av = _norm(a.get(k))
        if av and av == _norm(b.get(k)):
            matches += 1
    return matches / len(keys)


def find_duplicate_groups(records: list[dict], keys: list[str], threshold: float = 1.0) -> list[list[dict]]:
    """Greedily group records whose match_score against a group's representative
    is >= threshold. Returns ALL groups (singletons included); a group with >1
    member is a duplicate set."""
    groups: list[list[int]] = []
    for i, r in enumerate(records):
        placed = False
        for g in groups:
            if match_score(r, records[g[0]], keys) >= threshold:
                g.append(i)
                placed = True
                break
        if not placed:
            groups.append([i])
    return [[records[i] for i in g] for g in groups]


def merge_golden(records: list[dict], *, recency_field: str = "updated_at") -> dict:
    """Merge duplicate records into one golden record: per field, the value from
    the most-recent record that has a non-empty value wins."""
    if not records:
        return {}
    ordered = sorted(records, key=lambda r: str(r.get(recency_field) or ""), reverse=True)
    golden: dict = {}
    all_keys: set = set()
    for r in records:
        all_keys.update(r.keys())
    for k in all_keys:
        for r in ordered:  # most-recent first
            v = r.get(k)
            if v not in (None, "", [], {}):
                golden[k] = v
                break
    golden["_merged_from"] = [r.get("id") for r in records if r.get("id")]
    return golden
