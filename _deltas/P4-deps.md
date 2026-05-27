# P4 — Python Dependencies to Add

These packages are required by the modules created in phase P4. Add them to
`backend/requirements.txt` in a separate PR (P4 forbids modifying requirements.txt directly).

## Runtime (production)

| Package | Min version | Used by |
|---------|-------------|---------|
| `redis[hiredis]` | `>=5.0` | `app/services/cache.py`, `app/middleware/rate_limit_redis.py` |
| `slowapi` | `>=0.1.9` | `app/middleware/rate_limit_redis.py` (already present — confirm) |
| `python-json-logger` | `>=2.0` | structured logs (`app/observability/`) |
| `opentelemetry-api` | `>=1.24` | `app/observability/tracing.py`, `app/firestore/client.py` |
| `opentelemetry-sdk` | `>=1.24` | `app/observability/tracing.py` |
| `opentelemetry-instrumentation-fastapi` | `>=0.45b0` | `app/observability/tracing.py` |
| `opentelemetry-exporter-gcp-trace` | `>=1.6` | Cloud Trace exporter (production only) |
| `apscheduler` | `>=3.10` | `app/services/scheduler_jobs.py` (likely present — confirm) |
| `google-cloud-firestore` | `>=2.16` | `app/firestore/client.py` async client |
| `google-cloud-storage` | `>=2.16` | `app/api/admin/exports.py` GCS upload (likely present — confirm) |
| `prometheus-client` | `>=0.20` | `app/observability/metrics.py` (optional — code degrades to no-op without it) |
| `google-cloud-monitoring` | `>=2.20` | `scripts/deploy-bluegreen.sh` (5xx polling via `gcloud monitoring time-series list`) |

## Dev / test only

| Package | Min version | Used by |
|---------|-------------|---------|
| `fakeredis` | `>=2.20` | `backend/tests/test_cache.py` |
| `pytest-asyncio` | `>=0.23` | async test cases (likely present — confirm via pytest.ini `asyncio_mode = auto`) |

## Notes

- `redis[hiredis]` pulls in the C parser for ~5x faster serialisation. Falls back to pure-Python if hiredis fails to build.
- `opentelemetry-exporter-gcp-trace` is optional in dev — `app/observability/tracing.py` already degrades to ConsoleSpanExporter when missing.
- `prometheus-client` is optional — `app/observability/metrics.py` exports no-op shims when absent so the `/metrics` route still resolves.
- If `google-cloud-storage` is missing, exports fall back to status="pending" with a clear log warning rather than 500-ing.
