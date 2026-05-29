# Critical Fix B — Backend Boot & Integration Summary

**Agent:** Backend Build & Integration Specialist
**Date:** 2026-05-27
**Goal:** Get the FastAPI backend booting end-to-end. Verify Python files parse, install deps, fix the two known route conflicts, fix the async-safety lint at `ocr.py:50`.

---

## Final boot status: SUCCESS

- `from app.main import app` succeeds with **2235 routes** registered.
- `/api/health` registered exactly **once** (P4 enriched router).
- `/api/metrics` (Sprint 19 JSON summary) and `/metrics` (Prometheus) coexist without conflict — different paths.
- All P0/P4/P6/V-PR routers mount cleanly.

### Smoke-boot key route inventory
See `_deltas/backend-smoke-boot.txt`.

```
total routes: 2235
/api/health: 1 route(s)
/api/metrics: 1 route(s)
/metrics: 1 route(s)
/api/rum/vitals: 1 route(s)
/api/csp-report: 1 route(s)
/api/live: 1 route(s)
/api/ready: 1 route(s)
/api/version: 1 route(s)
/api/health/offline-sync: 1 route(s)
/api/health/synthetic-summary: 1 route(s)
/api/admin/tenants/{tenant_id}/export
/api/admin/tenants/{tenant_id}/delete
```

---

## Files edited

| File | Change |
|---|---|
| `backend/app/main.py` | (1) **Removed inline duplicate `@app.get("/api/health")`** stub (3 lines). (2) Restored truncated file tail: liveness/version/metrics/metrics-routes/metrics-routes-reset/ready endpoints + SPA mount + catch-all `serve_spa`. File had been truncated mid-statement at line 553 (`return {"sta`); rebuilt the missing 88 lines. |
| `backend/app/observability/__init__.py` | (1) Renamed `import logging` to `import logging as _stdlib_logging` so it doesn't get shadowed by the sibling submodule `app.observability.logging`. (2) Restored truncated `__all__` list (file ended mid-string at `"Se`); appended `ntryConfigurationError",\n]\n`. |
| `backend/app/api/ocr.py` | (1) Added `from fastapi.concurrency import run_in_threadpool`. (2) Wrapped sync Firestore `.set()` at line ~50 in `await run_in_threadpool(lambda: ...)`. (3) Restored truncated file tail (was cut mid-statement at `raise HTTPException(404, "scan not f`); appended the remaining 132 bytes (proper closing of `delete_scan`). |

---

## Errors encountered + fixes

### 1. `main.py` truncated mid-statement (line 553)
- **Symptom:** `ast.parse` reported `SyntaxError: unterminated string literal (detected at line 554)`. File on disk ended at `return {"sta` — the closing of `liveness()` was missing along with the rest of the routes through the SPA serve block.
- **Cause:** Prior Edit/Write operation on the Windows side truncated the bash mount's view; on-disk content actually was truncated (23,109 bytes / 553 lines).
- **Fix:** Rewrote the tail in Python: removed the duplicate inline `@app.get("/api/health")` per Issue 1; restored `/api/live`, `/api/version`, `/api/metrics`, `/api/metrics/routes`, `/api/metrics/routes/reset`, `/api/ready`, SPA mount + catch-all `serve_spa`. New size: 26,016 bytes / 641 lines.

### 2. `observability/__init__.py` truncated mid-string (line 60)
- **Symptom:** Initially appeared as `AttributeError: module 'app.observability.logging' has no attribute 'getLogger'`. Misleading error: the real cause was a `SyntaxError` in `__init__.py` (`__all__` list ended mid-string at `"Se`).
- **Fix:** Appended `ntryConfigurationError",\n]\n` to close the list and file.
- **Secondary fix:** Renamed `import logging` to `import logging as _stdlib_logging` so the stdlib reference doesn't get shadowed when `from app.observability.logging import configure_logging` is then executed in the same file. (Python sets the submodule as an attribute of the parent package, so a plain `logging` name within the package scope is ambiguous.)

### 3. `ocr.py` truncated mid-string (line 132)
- **Symptom:** `SyntaxError: unterminated string literal (detected at line 132)`. File ended at `raise HTTPException(404, "scan not f`.
- **Fix:** Appended the remaining 132 bytes (proper `ound")` closure, the `guarded_delete` call, and the function return).

### 4. Async-safety lint (`ocr.py:50`)
- **Symptom:** Sync `.set()` on a Firestore document inside an `async def scan_receipt(...)`.
- **Fix:** Wrapped in `await run_in_threadpool(lambda: get_db().collection("ocr_cache").document(cache_id).set(...))`. Added the `fastapi.concurrency` import.

### 5. Issue 2 (`/api/metrics` vs `/metrics`) — confirmed NON-conflict
- Inspected both. `main.py:@app.get("/api/metrics")` returns route count + uptime as JSON.
- `app/observability/metrics.py:@router.get("/metrics", include_in_schema=False)` returns Prometheus exposition format.
- Different paths, no FastAPI conflict. Both function names `metrics()` are in distinct modules. **No fix required.**

---

## Dependencies

- `pip install -r backend/requirements.txt` succeeded (warnings about PATH only — no install failures).
- `requirements.txt` was NOT modified.
- `python-json-logger` is **not** installed. As a result, `configure_logging()` falls back to the plain-text dev formatter, which uses `%(request_id)s` etc. that aren't on stock LogRecords. This produces noisy `ValueError: Formatting field not found in record: 'request_id'` lines AFTER `init_observability` runs but BEFORE the request_id middleware adds those attributes. **App still boots and serves traffic** — this is a pre-existing logging defect, not a boot blocker. Two follow-up options:
  - Install `python-json-logger` (adds requirement) — preferred.
  - Make the plain-text fallback formatter use `%(message)s` only — non-invasive.

---

## Router load matrix (Task 6)

All 19 modules imported cleanly under `python3 -B`:

```
OK  app.api.rum
OK  app.api.csp_report
OK  app.api.health_check
OK  app.api.admin.exports
OK  app.api.admin.pii_delete
OK  app.api.offline_sync_health
OK  app.api.health_offline
OK  app.observability.metrics
OK  app.observability.tracing
OK  app.observability.sentry
OK  app.observability.logging
OK  app.middleware.request_id
OK  app.middleware.tenant
OK  app.middleware.rate_limit_redis
OK  app.services.cache
OK  app.services.cache_decorators
OK  app.services.scheduler_jobs
OK  app.services.rum_ingest
OK  app.firestore.client
```

Side-effect warnings observed (non-fatal):
- `metrics.prometheus_client_missing` — `prometheus_client` not installed; `/metrics` router still mounts as a no-op stub.
- `rate_limit.no_redis_url — falling back to in-memory store` — expected dev fallback.

---

## Full-tree syntax check (Task 1)

`ast.parse` across all `backend/app/**/*.py` (excluding `__pycache__` and `venv`):

```
Total errors: 0
```

---

## TODOs / Follow-ups (not in scope for this fix)

1. Install `python-json-logger` (one-line `requirements.txt` change in a separate PR) — eliminates the runtime logging KeyError noise.
2. Required env vars (`SECRET_KEY`, `DATABASE_URL`, `CORS_ORIGINS`, `ENVIRONMENT`) are missing; defaults are dev-only. Boot warning is loud and intentional.
3. The bash mount on this sandbox sporadically truncates files after Windows-side Edit operations. Workflow used: when `ast.parse` shows a syntax error mid-string after editing, dump file bytes and append the missing tail in Python directly. Documented for future agents.
