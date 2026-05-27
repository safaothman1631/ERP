# Implementation Plan: System Health Check + Auto Backup

## Overview

Implement the System Health Dashboard and Auto Backup feature in two layers:

- **Backend**: Two new services (`health_checker.py`, `backup_service.py`), two new API routers (`health.py`, `backup.py`), a 7th scheduler job in `scheduler.py`, removal of stub backup endpoints from `system.py`, and router registration in `main.py`.
- **Frontend**: A new `SystemHealthPage.tsx` at `/settings/system-health`, a `useHealthNotification.ts` post-login hook, and route registration in `App.routes.tsx`.
- **Tests**: Property-based tests (Hypothesis) for all 20 correctness properties, plus Vitest + React Testing Library frontend tests.

---

## Tasks

- [x] 1. Create `HealthChecker` service
  - [x] 1.1 Create `backend/app/services/health_checker.py` with `HealthCheckResult` and `FullHealthReport` dataclasses
    - Define `HealthCheckResult(component, status, response_time_ms, message, checked_at)` and `FullHealthReport(overall_status, checked_at, components, recommendations)` as Python dataclasses with `Literal` type annotations
    - Implement `HealthChecker` class skeleton with all 8 async check method stubs: `_check_firestore`, `_check_auth`, `_check_storage`, `_check_scheduler`, `_check_api_self`, `_check_memory`, `_check_cpu`, `_check_recent_errors`
    - _Requirements: 1.1, 1.6_

  - [x] 1.2 Implement `_classify_result` and status classification logic
    - Implement `_classify_result(component, response_time_ms, exception, extra)` applying rules: exception → `"unhealthy"` with sanitized message (no `Traceback`, `File "`, `line `, `raise ` substrings); `response_time_ms >= 500` → `"degraded"`; otherwise → `"healthy"`
    - Apply memory thresholds in `extra`: `>= 95%` → `"unhealthy"`, `> 85%` → `"degraded"`; CPU: `> 80%` → `"degraded"`; error count: `>= 200` → `"unhealthy"`, `>= 50` → `"degraded"`
    - _Requirements: 1.3, 1.4, 1.5, 1.7, 1.8, 1.9, 1.10, 1.11, 10.5_

  - [x] 1.3 Implement `_compute_overall` and `_build_recommendations`
    - `_compute_overall(results)`: return `"unhealthy"` if any component is `"unhealthy"`, `"degraded"` if any is `"degraded"` and none are `"unhealthy"`, `"healthy"` only when all are `"healthy"`
    - `_build_recommendations(results)`: return at least one actionable string per non-healthy component
    - _Requirements: 1.13, 1.14_

  - [x] 1.4 Implement all 8 async component check methods
    - `_check_firestore`: ping `_healthcheck/ping` document; measure round-trip ms
    - `_check_auth`: call Firebase Auth admin SDK `list_users(max_results=1)`; measure ms
    - `_check_storage`: call `get_bucket().exists()` or list a single blob; measure ms
    - `_check_scheduler`: call `get_scheduler()` from `scheduler.py`; check if not None and running
    - `_check_api_self`: HTTP GET to `/api/health` via `httpx.AsyncClient`; measure ms
    - `_check_memory`: use `psutil.virtual_memory().percent`; pass to `_classify_result` via `extra`
    - `_check_cpu`: use `psutil.cpu_percent(interval=5)`; pass to `_classify_result` via `extra`
    - `_check_recent_errors`: query `audit_logs` collection for entries in last 1 hour with `action == "error"` or equivalent; count results; pass to `_classify_result` via `extra`
    - _Requirements: 1.1, 1.2, 1.7, 1.8, 1.9, 1.10, 1.11_

  - [x] 1.5 Implement `run_full_check` with `asyncio.gather`
    - Gather all 8 check coroutines with `asyncio.gather(*checks, return_exceptions=True)`
    - For each result that is an `Exception`, call `_classify_result` with that exception to produce an `"unhealthy"` result
    - Assemble `FullHealthReport` with `_compute_overall` and `_build_recommendations`
    - _Requirements: 1.2, 1.6_

  - [x] 1.6 Write property tests for `HealthChecker` classification (Properties 1–6)
    - **Property 1: Component status classification is deterministic by response time** — `@given(response_time_ms=st.floats(min_value=0, max_value=499.9))` → status must be `"healthy"`; `@given(response_time_ms=st.floats(min_value=500))` → `"degraded"`; exception input → `"unhealthy"`
    - **Property 2: Memory and CPU thresholds** — `@given(memory_pct=st.floats(0, 100), cpu_pct=st.floats(0, 100))` → verify boundary conditions at 85/95 (memory) and 80 (CPU)
    - **Property 3: Error count thresholds** — `@given(error_count=st.integers(min_value=0, max_value=500))` → verify `< 50` → healthy, `50–199` → degraded, `>= 200` → unhealthy
    - **Property 4: Overall status aggregation** — `@given(statuses=st.lists(st.sampled_from(["healthy","degraded","unhealthy"]), min_size=1, max_size=10))` → verify aggregation rules
    - **Property 5: Recommendations cover all non-healthy components** — `@given(...)` → `len(recommendations) >= k` where `k` = count of non-healthy components
    - **Property 6: Error messages are sanitized** — `@given(exc_msg=st.text())` → resulting message must not contain `"Traceback"`, `'File "'`, `"line "`, `"raise "`
    - Tag each test: `# Feature: system-health-backup, Property N`; `max_examples=200`
    - _Requirements: 1.3, 1.4, 1.5, 1.7, 1.8, 1.9, 1.10, 1.11, 1.13, 1.14, 10.5_

- [x] 2. Create `health.py` API router
  - [x] 2.1 Create `backend/app/api/health.py` with `GET /api/system/health/full`
    - Define `router = APIRouter(prefix="/api/system", tags=["Health"])`
    - Implement `get_full_health(force: bool = Query(False), user: dict = Depends(get_current_user))` — any authenticated user allowed; unauthenticated → HTTP 401 via `get_current_user`
    - Cache key: `health:full:{user["org_id"]}`; use `cache.get(key)` for non-force requests; if cached result age < 30s return it; otherwise run `HealthChecker().run_full_check()`, store in cache, return result
    - When `force=True`: bypass cache, run fresh check, update cache with new result
    - Return `FullHealthReport` serialized as JSON
    - _Requirements: 1.12, 9.1, 9.2, 9.3, 9.4, 10.1_

  - [x] 2.2 Write property test for health check cache behavior (Property 19)
    - **Property 19: Health check cache respects 30-second TTL** — mock `HealthChecker.run_full_check`; call endpoint twice within 30s without `force`; verify checker called only once; call with `force=True`; verify checker called again
    - Tag: `# Feature: system-health-backup, Property 19`; `max_examples=100`
    - _Requirements: 9.2, 9.4_

- [x] 3. Create `BackupService`
  - [x] 3.1 Create `backend/app/services/backup_service.py` with `BackupRecord` dataclass and `BackupService` skeleton
    - Define `BackupRecord` dataclass with all required fields: `id`, `org_id`, `filename`, `storage_path`, `created_at`, `status`, `integrity_status`, `total_documents`, `collections_backed_up`, `file_size_bytes`, `checksum_sha256`, `error_message`
    - Define `BackupService` class with `COLLECTIONS: ClassVar[list[str]]` containing all 40 collection names from Requirement 4.1 and `RETENTION_COUNT: ClassVar[int] = 30`
    - Implement `__init__(self, org_id: str)` storing `org_id`
    - _Requirements: 4.1, 4.5_

  - [x] 3.2 Implement pure utility methods: `_serialize_to_json`, `_compress`, `_compute_checksum`
    - `_serialize_to_json(data: dict) -> bytes`: serialize to JSON bytes with structure `{"org_id": ..., "exported_at": ..., "version": "1.0", "collections": {...}}`
    - `_compress(data: bytes) -> bytes`: gzip compress using `gzip.compress`
    - `_compute_checksum(data: bytes) -> str`: return `hashlib.sha256(data).hexdigest()`
    - _Requirements: 4.2, 4.3, 5.2_

  - [x] 3.3 Write property tests for backup utility methods (Properties 7, 8)
    - **Property 7: Backup archive round-trip preserves document set** — `@given(collections=st.dictionaries(...))` → serialize → compress → decompress → parse → verify same collection names, same document counts, same IDs
    - **Property 8: SHA-256 checksum is deterministic** — `@given(data=st.binary())` → `_compute_checksum(data) == _compute_checksum(data)` always
    - Tag: `# Feature: system-health-backup, Property 7` and `Property 8`; `max_examples=100`
    - _Requirements: 5.2, 5.6_

  - [x] 3.4 Implement `_export_collections` and `_upload`
    - `_export_collections() -> dict[str, list[dict]]`: for each collection in `COLLECTIONS`, query Firestore filtered by `org_id`; if collection missing or empty, include as `[]`; never raise on empty collection
    - `_upload(compressed: bytes, path: str) -> None`: use `StorageService` (or direct bucket blob) to upload to `backups/{org_id}/{YYYY-MM-DD}/backup_{timestamp}.json.gz`; enforce org-scoped path prefix `backups/{org_id}/`
    - _Requirements: 4.1, 4.3, 4.4, 4.8, 10.6_

  - [x] 3.5 Write property tests for org-scoped storage paths and empty collections (Properties 12, 13)
    - **Property 12: Empty collections are included in backup** — `@given(empty_collections=st.lists(st.sampled_from(BackupService.COLLECTIONS)))` → verify all listed collections appear as `[]` in archive; integrity_status = `"verified"` when exported count == verified count == 0
    - **Property 13: Org-scoped storage paths** — `@given(org_id=st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=("Lu","Ll","Nd"))))` → every generated `storage_path` starts with `f"backups/{org_id}/"`
    - Tag: `# Feature: system-health-backup, Property 12` and `Property 13`; `max_examples=100`
    - _Requirements: 4.8, 10.6_

  - [x] 3.6 Implement `_verify_integrity`
    - `_verify_integrity(path: str, expected_count: int) -> tuple[bool, int]`: download file from Cloud Storage, decompress, JSON-parse, count total documents across all collections
    - Return `(True, actual_count)` when `actual_count == expected_count` and decompression/parsing succeeded
    - Return `(False, actual_count)` when counts differ, decompression fails, or parsing fails
    - Must complete within 120 seconds (use `asyncio.wait_for` with timeout)
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

  - [x] 3.7 Write property tests for integrity verification (Properties 9, 10)
    - **Property 9: Integrity verification correctly classifies count match/mismatch** — `@given(docs=st.lists(...))` → build archive with known count; verify `integrity_status == "verified"` when counts match; mutate count → `integrity_status == "failed"`
    - **Property 10: Backup record contains all required fields** — `@given(...)` → for any completed backup run, `BackupRecord` must have non-null values for all 11 required fields
    - Tag: `# Feature: system-health-backup, Property 9` and `Property 10`; `max_examples=100`
    - _Requirements: 4.5, 5.3, 5.4_

  - [x] 3.8 Implement `_write_record`, `_enforce_retention`, and `_notify_failure`
    - `_write_record(record: BackupRecord)`: write to Firestore `backups` collection with all fields from `BackupRecord`
    - `_enforce_retention()`: query `backups` collection filtered by `org_id`, ordered by `created_at` descending; keep first 30; delete older records from both Firestore and Cloud Storage
    - `_notify_failure(record: BackupRecord)`: query all users with `role in ("admin", "owner")` for `org_id`; call `send_email` for each; on email failure log at ERROR level and retry up to 3 times; never raise to caller; do NOT call `send_email` when `status == "success"` and `integrity_status == "verified"`
    - _Requirements: 4.5, 4.7, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 3.9 Write property tests for retention and notification (Properties 11, 17, 18)
    - **Property 11: Retention policy keeps at most 30 records** — `@given(n=st.integers(min_value=31, max_value=60))` → after `_enforce_retention`, collection has exactly 30 records (most recent)
    - **Property 17: Failure notifications reach all admin/owner users** — `@given(k=st.integers(min_value=1, max_value=10))` → mock `send_email`; create `k` admin/owner users; trigger failed backup; verify `send_email` called exactly `k` times
    - **Property 18: Success runs do not trigger email notifications** — `@given(...)` → mock `send_email`; trigger successful backup with `integrity_status="verified"`; verify `send_email` never called
    - Tag: `# Feature: system-health-backup, Property 11`, `Property 17`, `Property 18`; `max_examples=100`
    - _Requirements: 4.7, 7.1, 7.3_

  - [x] 3.10 Implement `run_backup` orchestration method
    - Orchestrate: `_export_collections` → `_serialize_to_json` → `_compress` → `_compute_checksum` → `_upload` → `_verify_integrity` → `_write_record` → `_enforce_retention`
    - On upload failure: set `status="failed"`, write record, call `_notify_failure`, return record
    - On integrity failure: set `integrity_status="failed"`, `status="failed"`, write record, call `_notify_failure`, return record
    - On success: set `status="success"`, `integrity_status="verified"`, write record, return record
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4. Create `backup.py` API router
  - [x] 4.1 Create `backend/app/api/backup.py` with all three backup endpoints
    - Define `router = APIRouter(prefix="/api/system", tags=["Backup"])`
    - Implement `_require_admin(user)` helper: raise HTTP 403 if `user["role"] not in ("admin", "owner")`
    - `GET /backup/list`: require admin/owner; query `backups` collection filtered by `user["org_id"]`, ordered by `created_at` desc, limit 30; return list of `BackupRecord` dicts
    - `POST /backup/run` (status 202): require admin/owner; enqueue `BackupService(user["org_id"]).run_backup()` as `BackgroundTasks` task; return `{"status": "queued"}`
    - `GET /backup/{backup_id}/download`: require any authenticated user; fetch backup record by `backup_id`; if `record["org_id"] != user["org_id"]` raise HTTP 403 (regardless of role); generate signed URL via `StorageService.get_signed_url(path, expires_minutes=60)`; return `{"url": signed_url, "expires_in_minutes": 60}`
    - _Requirements: 4.6, 8.3, 8.4, 10.2, 10.3, 10.4_

  - [x] 4.2 Write property tests for backup API access control (Properties 14)
    - **Property 14: Cross-org download is rejected** — `@given(org_a=st.text(min_size=1), org_b=st.text(min_size=1))` where `org_a != org_b` → user with `org_id=org_a` requesting backup with `org_id=org_b` → HTTP 403 regardless of role (admin, owner, member)
    - Tag: `# Feature: system-health-backup, Property 14`; `max_examples=100`
    - _Requirements: 10.3_

- [x] 5. Update `scheduler.py` with daily backup job
  - [x] 5.1 Add `_job_daily_backup` function and register `daily_backup` CronTrigger job in `scheduler.py`
    - Add `_job_daily_backup()` function: fetch all organizations from Firestore; for each org, call `BackupService(org_id).run_backup()` in a try/except; log start time and org list before loop; log total duration, count backed up, and failures after loop; on per-org failure log error and continue to next org
    - Register job in `start_scheduler`: `_scheduler.add_job(_job_daily_backup, trigger=CronTrigger(hour=int(os.getenv("BACKUP_CRON_HOUR", "2")), minute=int(os.getenv("BACKUP_CRON_MINUTE", "0"))), id="daily_backup", name="Daily Organization Backup", replace_existing=True)`
    - Update log message from `"6 jobs"` to `"7 jobs"`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [x] 5.2 Write property tests for scheduler configuration (Properties 15, 16)
    - **Property 15: Scheduler cron hour and minute are configurable** — `@given(h=st.integers(0, 23), m=st.integers(0, 59))` → set env vars `BACKUP_CRON_HOUR=h`, `BACKUP_CRON_MINUTE=m`; verify `CronTrigger` created with `hour=h`, `minute=m`
    - **Property 16: Scheduler continues on per-org failure** — `@given(orgs=st.lists(st.text(min_size=1), min_size=2, max_size=10))` → mock `BackupService.run_backup` to raise for a random subset; verify `run_backup` attempted for every org in list
    - Tag: `# Feature: system-health-backup, Property 15` and `Property 16`; `max_examples=100`
    - _Requirements: 6.3, 6.4, 6.8_

- [x] 6. Clean up `system.py` and register new routers in `main.py`
  - [x] 6.1 Remove stub backup endpoints from `backend/app/api/system.py`
    - Remove `BackupRepo` class, `GET /api/system/backup/list`, `POST /api/system/backup`, and `GET /api/system/backup/download` endpoints from `system.py`
    - These are replaced by the new `backup.py` router; ensure no duplicate route conflicts
    - _Requirements: 4.6, 8.1_

  - [x] 6.2 Register `health.py` and `backup.py` routers in `backend/app/main.py`
    - Add imports: `from app.api import health as health_api, backup as backup_api`
    - Add `app.include_router(health_api.router)` and `app.include_router(backup_api.router)` in the "Phase 6: System" section, after `app.include_router(system.router)`
    - _Requirements: 1.1, 4.6_

- [x] 7. Checkpoint — Backend complete
  - Ensure all backend tests pass, ask the user if questions arise.

- [x] 8. Create `SystemHealthPage.tsx` frontend page
  - [x] 8.1 Create `frontend/src/pages/settings/SystemHealthPage.tsx` with sub-components
    - Create `OverallStatusBanner` sub-component: Ant Design `Alert` with `type="success"` (green, checkmark icon) for `"healthy"`, `type="warning"` (yellow, caution icon) for `"degraded"`, `type="error"` (red, warning icon) for `"unhealthy"`; when API call fails, show `type="error"` with message "Health check unavailable" regardless of any cached state
    - Create `ComponentCard` sub-component: Ant Design `Card` with `Badge`/`Tag` for status (green/yellow/red), response time in ms, and status message; one card per component
    - Create `RecommendationsPanel` sub-component: Ant Design `List` of recommendation strings; hidden when `recommendations` array is empty
    - Create `LastCheckedTimestamp` sub-component: display `checked_at` ISO timestamp in human-readable format using `dayjs`
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.11_

  - [x] 8.2 Implement health check data fetching, loading skeleton, error state, and auto-refresh
    - Use React Query `useQuery` to call `GET /api/system/health/full`; show `LoadingSkeleton` while pending; hide skeleton immediately on error
    - On API failure: show Ant Design `Alert` with `type="error"` and a "Retry" button that calls `refetch()`; override banner to "Health check unavailable" error state
    - Implement "Refresh" button that calls `GET /api/system/health/full?force=true` (invalidate query with `force=true` param)
    - Implement auto-refresh every 60 seconds using `refetchInterval: 60_000` in `useQuery` options
    - _Requirements: 2.2, 2.9, 2.10, 2.13_

  - [x] 8.3 Create `BackupHistoryTable` sub-component
    - Ant Design `Table` with columns: date/time, status badge (green/red), integrity status badge (verified/failed with warning icon + tooltip on failed), total documents, file size, storage path, download button
    - Failed backup rows: red background + error message tooltip on status badge; tooltips also on successful status badges showing metadata
    - "Run Backup Now" button above table: calls `POST /api/system/backup/run`, shows loading spinner, refreshes table on completion
    - Download button: calls `GET /api/system/backup/{id}/download`, opens signed URL; on failure shows `message.error` toast
    - Always render every row regardless of visual indicator render success
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 8.7_

  - [x] 8.4 Apply RTL/LTR layout support and role guard
    - Use existing `useTranslation` / `i18n` infrastructure and `ConfigProvider direction` from `App.tsx` — no additional wiring needed; verify all flex/grid layouts respect `dir` attribute
    - Guard page access: check `user.role` from `useAuthStore`; redirect non-admin/non-owner users (role not in `["admin", "owner"]`) to `/dashboard`
    - _Requirements: 2.1, 2.12_

  - [x] 8.5 Write frontend tests for `SystemHealthPage`
    - Mock `GET /api/system/health/full` with MSW or `vi.mock`; verify component cards render for each of 8 components; verify banner color matches `overall_status`; verify recommendations section visible when non-empty; verify "Refresh" button triggers new API call with `force=true`
    - Test API failure path: mock 500 response; verify error Alert renders; verify banner shows "Health check unavailable"
    - Test RTL: render with `dir="rtl"` context; verify layout direction applied
    - _Requirements: 2.2, 2.3, 2.4, 2.9, 2.10, 2.12_

  - [x] 8.6 Write frontend tests for `BackupHistoryTable`
    - Mock `GET /api/system/backup/list`; verify table rows render; verify failed row has red background class; verify download button calls correct endpoint; verify "Run Backup Now" calls `POST /api/system/backup/run`
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [x] 9. Create `useHealthNotification.ts` hook
  - [x] 9.1 Create `frontend/src/hooks/useHealthNotification.ts`
    - Implement custom hook using `useEffect` with a one-shot ref flag (`hasRun.current`) to fire only once per login session
    - Check `user.role` from `useAuthStore`; if role is not `"admin"` or `"owner"`, return immediately without calling the API
    - Call `GET /api/system/health/full` silently (no loading state exposed); on API failure, catch error and return silently — do NOT block login flow
    - On `overall_status == "healthy"`: show `notification.success` with 4-second auto-dismiss duration
    - On `overall_status == "degraded"`: show `notification.warning` (persistent, no auto-dismiss) with a "View Details" link that navigates to `/settings/system-health` only on explicit click
    - On `overall_status == "unhealthy"`: show `notification.error` (persistent) with same "View Details" link; do NOT auto-navigate
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 9.2 Write property test and frontend tests for `useHealthNotification` (Property 20)
    - **Property 20: Login health notification only fires for admin/owner** — `@given(role=st.sampled_from(["member", "viewer", "accountant", "sales"]))` → mock API; render hook with non-admin role; verify API never called
    - Frontend tests: mock login context; verify hook fires for `admin` and `owner` roles; verify hook skips for regular users; verify API errors are silently suppressed; verify "View Details" link navigates to `/settings/system-health` only on click (no auto-navigation)
    - Tag: `# Feature: system-health-backup, Property 20`; `max_examples=100`
    - _Requirements: 3.3, 3.4, 3.5_

- [x] 10. Register `/settings/system-health` route in `App.routes.tsx`
  - [x] 10.1 Add lazy import and route entry for `SystemHealthPage` in `frontend/src/App.routes.tsx`
    - Add lazy import: `const SystemHealthPage = lazy(() => import('./pages/settings/SystemHealthPage'))`
    - Add route entry inside the protected `ProtectedRoute` children array: `{ path: 'settings/system-health', element: <PageTransition><SystemHealthPage /></PageTransition> }`
    - Place the entry in the settings section, near `NumberingSequences` and other settings routes
    - _Requirements: 2.1_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all backend and frontend tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at backend and frontend boundaries
- Property tests validate universal correctness properties using Hypothesis (`max_examples=200` for classification properties, `max_examples=100` for structural/round-trip properties)
- All property tests must be tagged with `# Feature: system-health-backup, Property N`
- The `psutil` package must be added to `backend/requirements.txt` for memory/CPU checks
- The `httpx` package is likely already present (FastAPI dependency) but verify before use in `_check_api_self`
- Stub backup endpoints in `system.py` (`BackupRepo`, `GET /backup/list`, `POST /backup`, `GET /backup/download`) are removed in Task 6.1 to avoid route conflicts with the new `backup.py` router
- The `useHealthNotification` hook should be called from the post-login flow in `LoginPage` (or equivalent auth success handler), not from `App.tsx` globally

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "3.2"] },
    { "id": 2, "tasks": ["1.4", "3.3", "3.4"] },
    { "id": 3, "tasks": ["1.5", "3.5", "3.6"] },
    { "id": 4, "tasks": ["1.6", "2.1", "3.7", "3.8"] },
    { "id": 5, "tasks": ["2.2", "3.9", "3.10", "4.1"] },
    { "id": 6, "tasks": ["4.2", "5.1"] },
    { "id": 7, "tasks": ["5.2", "6.1"] },
    { "id": 8, "tasks": ["6.2"] },
    { "id": 9, "tasks": ["8.1", "9.1"] },
    { "id": 10, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 11, "tasks": ["8.5", "8.6", "9.2", "10.1"] }
  ]
}
```
