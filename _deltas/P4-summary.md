# P4 — Backend Latency, Caching & Cloud Run Hardening — Delivery Summary

Phase scope: Redis cache facade, async-safety linter, Redis-backed rate
limiter, Firestore index audit, blue/green deploy, scheduler jobs, admin
PII export/delete, observability metrics surface, richer /api/health.

All files below are **new** — no existing files were modified per the P4
constraint (no edits to `main.py`, `requirements.txt`, or existing
`backend/app/api/*.py` endpoints).

## Files created

| # | Path | One-liner |
|---|------|-----------|
| 1 | `backend/app/services/cache.py` | Redis async cache facade — `Cache` class with `get_or_set` + SCAN-based `invalidate`, `make_key()` for `{tenant}:{resource}:{params_hash}:v{schema}`, singleton via `get_cache()`. |
| 2 | `backend/tests/test_cache.py` | pytest suite using `fakeredis.aioredis.FakeRedis` — covers keys, get/set, TTL, get_or_set, invalidate (asserts SCAN never falls back to KEYS), singleton. |
| 3 | `backend/app/services/cache_decorators.py` | `@cached(resource, ttl_s, schema_version, key_fn)` decorator for FastAPI handlers. Reads tenant from `request.state.tenant_id`, honors `Cache-Control: no-cache`, logs hit/miss as structured fields, bypasses when tenant unresolved. |
| 4 | `backend/app/middleware/rate_limit_redis.py` | slowapi `Limiter` backed by Redis via `REDIS_URL` (falls back to `memory://`). Key: `{tenant_id}:{remote_addr}`. Exports `limiter` and `register_rate_limit_middleware(app)`. Default 600/min authed, 60/min anon. |
| 5 | `backend/app/middleware/tenant.py` | `TenantMiddleware` — reads JWT, sets `request.state.tenant_id`, 401s for non-allowlisted routes when tenant missing. Allowlist: `/api/health`, `/api/version`, `/api/auth/*`, `/api/rum/vitals`, plus docs/openapi/metrics. |
| 6 | `backend/app/firestore/client.py` | Async Firestore wrapper — `get_async_client()`, `traced_get/query/set/delete` with OTel spans + slow-op (>1s) logging, `run_threadpool(fn)` for legacy sync calls. |
| 7 | `tools/lint/async_safety.py` | AST-based linter — flags unawaited sync Firestore calls (`get/stream/set/update/delete/add/create`) inside `async def`. CLI: `python -m tools.lint.async_safety [paths] [--check]`. Handles `async for` properly (no false-positives on `async for x in ....stream()`). |
| 8 | `tools/lint/test_async_safety.py` | pytest suite — flags sync `.get()`, ignores awaited & sync defs & unrelated `.get()`, recurses dirs, skips venv, CLI exit codes, GNU formatting. |
| 9 | `scripts/audit-firestore-queries.py` | AST walks `backend/app/api/`, extracts `(collection, where[], order_by)` chains, diffs against `firestore.indexes.json`, writes markdown to stdout + JSON to `audit/firestore-query-audit.json`. `--check` for CI. **Found 2 missing indexes on first run** (org_memberships, withholding_taxes). |
| 10 | `scripts/deploy-bluegreen.sh` | Cloud Run blue/green: `--no-traffic --tag candidate` → shift 1% → poll 5xx via `gcloud monitoring time-series list` every 30s → promote 100% or rollback. Defensive: validates env, captures prev revision, emits timestamped logs at every step. |
| 11 | `backend/app/api/admin/__init__.py` | Package marker. |
| 12 | `backend/app/api/admin/exports.py` | `POST /api/admin/tenants/{tid}/export` — admin-only. Iterates tenant subcollections, zips JSON, uploads to GCS, returns 1h signed URL. Audits to `audit_logs`. |
| 13 | `backend/app/api/admin/pii_delete.py` | `POST /api/admin/tenants/{tid}/delete` — admin-only, requires confirm phrase `DELETE-<tid>`. Soft-deletes (sets `deleted_at`) on root + all subdocs. Hard-delete happens via scheduler after 30 days. |
| 14 | `backend/app/services/scheduler_jobs.py` | APScheduler job definitions: `hard_delete_expired_tenants` (24h), `verify_backup_freshness` (6h, raises `BackupFreshnessError`), `cleanup_old_audit_logs` (monthly, 18-month retention). `register_jobs(scheduler)` wires them. |
| 15 | `backend/app/observability/metrics.py` | Prometheus surface — counters (`http_requests_total`, `firestore_operations_total`, `redis_cache_hits/misses_total`), histograms (`http_request_duration_ms`, `firestore_op_duration_ms`), gauges (`pos_orders_offline_queued`). Exports `router` with `/metrics`. No-op fallback if `prometheus_client` not installed. |
| 16 | `backend/app/api/health_check.py` | `GET /api/health` — unauthenticated, 1-second probe per dep, returns `{status, version, firestore, redis, scheduler, timestamp}`. Aggregate status: any "down" → down, any "degraded" → degraded, else ok. |
| 17 | `_deltas/P4-deps.md` | Lists 12 deps to add to `requirements.txt` (runtime + dev). |
| 18 | `_deltas/P4-summary.md` | This file. |

## Integration notes for `main.py` (to be done in a later PR)

These are the wiring steps needed to activate the new modules — none of
this happens automatically.

### Middleware registration (order matters)

```python
from app.middleware.tenant import TenantMiddleware
from app.middleware.rate_limit_redis import register_rate_limit_middleware

# Tenant must be set BEFORE rate limit so the limiter can partition by tenant.
app.add_middleware(TenantMiddleware)
register_rate_limit_middleware(app)
```

### Router includes

```python
from app.api.admin.exports import router as admin_exports_router
from app.api.admin.pii_delete import router as admin_pii_delete_router
from app.api.health_check import router as health_check_router
from app.observability.metrics import router as metrics_router

app.include_router(admin_exports_router)
app.include_router(admin_pii_delete_router)
app.include_router(health_check_router)
app.include_router(metrics_router)
```

### Scheduler wiring (in lifespan startup)

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.scheduler_jobs import register_jobs

@asynccontextmanager
async def lifespan(app):
    scheduler = AsyncIOScheduler()
    register_jobs(scheduler)
    scheduler.start()
    app.state.scheduler = scheduler
    yield
    scheduler.shutdown(wait=False)
```

### Env vars needed in production

| Var | Purpose | Default |
|-----|---------|---------|
| `REDIS_URL` | Memorystore / Upstash URL for cache + rate limit | falls back to memory:// in dev |
| `RATE_LIMIT_REDIS_URL` | Optional override just for limiter | uses `REDIS_URL` |
| `CACHE_NAMESPACE` | Cache key prefix | `zoho` |
| `EXPORT_BUCKET` | GCS bucket for tenant exports | falls back to `FIREBASE_STORAGE_BUCKET` |
| `APP_VERSION` / `GIT_SHA` / `K_REVISION` | Reported by `/api/health` | `dev` |
| `OTEL_SERVICE_NAME` | OTel resource name | `zoho-backend` |

### CI / scripts wiring

Add to a CI workflow (likely `.github/workflows/quality.yml`):

```yaml
- name: Lint — async safety
  run: python -m tools.lint.async_safety --check

- name: Audit — Firestore indexes
  run: python scripts/audit-firestore-queries.py --check

- name: Test — backend cache
  run: cd backend && pytest tests/test_cache.py -q

- name: Test — async safety linter
  run: pytest tools/lint/test_async_safety.py -q
```

Deploy workflow:

```yaml
- name: Blue/green deploy
  env:
    SERVICE_NAME: zoho-backend
    NEW_IMAGE: ${{ steps.build.outputs.image }}
    PROJECT: ${{ secrets.GCP_PROJECT }}
    REGION: me-central1
  run: bash scripts/deploy-bluegreen.sh
```

## Findings produced on first runs

- `scripts/audit-firestore-queries.py` flagged 2 collections missing
  composite indexes: `org_memberships` (`user_id`, `org_id`) and
  `withholding_taxes` (`org_id`, `is_active`). Add to
  `firestore.indexes.json` and deploy.
- `python -m tools.lint.async_safety` flagged `backend/app/api/ocr.py:50`
  (sync `.set()` inside async def). Pre-existing issue worth fixing in
  a follow-up.

## Tests passing

- Manual smoke of `tools/lint/async_safety.py` — all 5 fixture cases pass
  (flags sync .get(), ignores awaited .get(), ignores sync def, ignores
  unrelated `.headers.get()`, flags chained `.stream()` correctly).
- `py_compile` clean on all 14 new Python modules.
- Shell syntax clean on `scripts/deploy-bluegreen.sh` (`bash -n`).
- `scripts/audit-firestore-queries.py` runs end-to-end against the real
  codebase, finds the 2 documented missing-index queries.

## Out of scope (deferred)

- Wiring `main.py` itself (constraint forbids modification).
- Adding to `requirements.txt` directly (see `_deltas/P4-deps.md`).
- Migrating the 1 pre-existing sync-Firestore-in-async finding in
  `backend/app/api/ocr.py:50` — that's a separate change.
