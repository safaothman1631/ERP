"""Smoke test for Phase 12 Performance utilities."""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(__file__))

from app.firebase_client import init_firebase
from app.services.perf import (
    cached_static, invalidate_static, paginate,
    encode_cursor, decode_cursor, BatchLoader, QueryCounter,
)
from app.cache import cache as global_cache

init_firebase()
results = []


def _assert(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((status, name, detail))
    print(f"  [{status}] {name}{(' - ' + detail) if detail else ''}")


def t1_cached_static_decorator():
    print("\nT1 - cached_static caches result")
    global_cache.clear()
    calls = {"n": 0}

    @cached_static("test_org_settings")
    def get_settings(org_id):
        calls["n"] += 1
        return {"org_id": org_id, "tz": "Asia/Baghdad"}

    a = get_settings("ORG1")
    b = get_settings("ORG1")
    c = get_settings("ORG2")
    _assert("first call hits", calls["n"] == 2, f"expected 2 (ORG1+ORG2), got {calls['n']}")
    _assert("returns dict", a["org_id"] == "ORG1")
    _assert("ORG2 differs", c["org_id"] == "ORG2")


def t2_invalidate_static():
    print("\nT2 - invalidate_static clears prefix")
    global_cache.clear()
    calls = {"n": 0}

    @cached_static("test_coa")
    def get_coa(org_id):
        calls["n"] += 1
        return [{"code": "1010"}]

    get_coa("X")
    get_coa("X")
    n_before = calls["n"]
    invalidated = invalidate_static("test_coa")
    get_coa("X")
    _assert("invalidated >= 1", invalidated >= 1, str(invalidated))
    _assert("re-fetched after invalidate",
            calls["n"] == n_before + 1, f"{calls['n']} vs {n_before}")


def t3_paginate_basic():
    print("\nT3 - paginate basic")
    items = list(range(125))
    page1 = paginate(items, cursor=None, limit=50)
    _assert("page1 size 50", len(page1["items"]) == 50)
    _assert("page1 first 0", page1["items"][0] == 0)
    _assert("has_more true", page1["has_more"])
    _assert("total 125", page1["total"] == 125)


def t4_paginate_walk():
    print("\nT4 - paginate walk to end")
    items = list(range(125))
    cur = None
    seen = []
    pages = 0
    while True:
        p = paginate(items, cur, limit=50)
        seen.extend(p["items"])
        pages += 1
        if not p["has_more"]:
            break
        cur = p["next_cursor"]
        if pages > 10:
            break
    _assert("walked 3 pages", pages == 3, str(pages))
    _assert("collected all", seen == items)


def t5_paginate_limit_clamp():
    print("\nT5 - paginate clamps limit")
    items = list(range(2000))
    p = paginate(items, None, limit=10000)
    _assert("limit clamped to 500", len(p["items"]) == 500)


def t6_cursor_round_trip():
    print("\nT6 - cursor encode/decode")
    c = encode_cursor(123)
    _assert("decode roundtrip", decode_cursor(c) == 123)
    _assert("invalid cursor -> 0", decode_cursor("not-base64") == 0)
    _assert("None cursor -> 0", decode_cursor(None) == 0)


def t7_batch_loader_dedup():
    print("\nT7 - BatchLoader deduplicates fetches")
    fetches = {"n": 0}

    def fake_fetch(key):
        fetches["n"] += 1
        return {"id": key, "name": f"Item-{key}"}

    loader = BatchLoader(fake_fetch)
    keys = ["A", "B", "A", "C", "B", "A"]  # 3 unique
    out = loader.get_many(keys)
    _assert("returned 6 items", len(out) == 6)
    _assert("only 3 fetches", fetches["n"] == 3, str(fetches["n"]))
    _assert("stats unique=3", loader.stats()["unique_keys"] == 3)


def t8_query_counter_detects_n_plus_1():
    print("\nT8 - QueryCounter raises on threshold breach")
    def fake_db_get(_id):
        return {"id": _id}

    counter = QueryCounter(fake_db_get)
    for i in range(15):
        counter(i)
    _assert("count = 15", counter.count == 15)
    raised = False
    try:
        counter.assert_under(10)
    except AssertionError:
        raised = True
    _assert("raises N+1 alarm", raised)


def t9_query_counter_passes_below_threshold():
    print("\nT9 - QueryCounter passes when low")
    def fake(_id):
        return None
    qc = QueryCounter(fake)
    for i in range(3):
        qc(i)
    raised = False
    try:
        qc.assert_under(10)
    except AssertionError:
        raised = True
    _assert("no raise", not raised)


def t10_cache_speedup():
    """Smoke: cached call should be ~order of magnitude faster than uncached."""
    print("\nT10 - cache provides speedup")
    global_cache.clear()

    @cached_static("speedup_test")
    def slow(arg):
        time.sleep(0.01)
        return arg * 2

    t0 = time.perf_counter()
    slow(5)  # cold
    cold = time.perf_counter() - t0

    t0 = time.perf_counter()
    for _ in range(50):
        slow(5)  # warm
    warm_avg = (time.perf_counter() - t0) / 50

    _assert("warm < cold", warm_avg < cold,
            f"cold={cold:.4f}s warm_avg={warm_avg:.6f}s")


def main():
    print("=" * 70)
    print("PHASE 12 SMOKE TEST - Performance (cache, paginate, batch, N+1)")
    print("=" * 70)
    t1_cached_static_decorator()
    t2_invalidate_static()
    t3_paginate_basic()
    t4_paginate_walk()
    t5_paginate_limit_clamp()
    t6_cursor_round_trip()
    t7_batch_loader_dedup()
    t8_query_counter_detects_n_plus_1()
    t9_query_counter_passes_below_threshold()
    t10_cache_speedup()

    print("\n" + "=" * 70)
    p = sum(1 for r in results if r[0] == "PASS")
    f = sum(1 for r in results if r[0] == "FAIL")
    print(f"RESULT: {p} PASS, {f} FAIL")
    print("=" * 70)
    if f:
        for s, n, d in results:
            if s == "FAIL":
                print(f"  FAIL: {n} - {d}")
    return 0 if f == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
