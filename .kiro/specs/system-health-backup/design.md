# Design Document: System Health Check + Auto Backup

## Overview

This feature adds two tightly coupled capabilities to the ERP system:

1. **System Health Dashboard** — A `GET /api/system/health/full` endpoint runs concurrent checks across all system components (Firestore, Auth, Storage, Scheduler, API, Memory, CPU, Recent Errors) and returns a structured report. A React page at `/settings/system-health` renders the results with status badges, an overall banner, recommendations, and a backup history table. A login hook silently notifies admins of any degraded/unhealthy state.

2. **Auto Backup** — A `BackupService` exports every critical Firestore collection per organization to a gzip-compressed JSON archive, uploads it to Firebase Cloud Storage under an org-scoped path, verifies integrity via document count + SHA-256 checksum, and records metadata in a `backups` Firestore collection. An APScheduler `CronTrigger` job runs this daily at a configurable time. Failure triggers an email alert via the existing `email_service.py`.

The implementation replaces the stub backup endpoints in `system.py` with two new dedicated routers (`health.py`, `backup.py`) and two new services (`health_checker.py`, `backup_service.py`), while extending `scheduler.py` with a 7th job.

---

## Architecture

```mermaid
graph TB
    subgraph Frontend ["Frontend (Vercel)"]
        LP[LoginPage] -->|post-login hook| HN[useHealthNotification hook]
        SHP[SystemHealthPage<br/>/settings/system-health] -->|React Query| HN
        SHP --> BHT[BackupHistoryTable]
        SHP --> CC[ComponentCards]
        SHP --> OB[OverallStatusBanner]
    end

    subgraph Backend ["Backend (Cloud Run)"]
        HR[health.py router<br/>GET /api/system/health/full] --> HC[HealthChecker service]
        BR[backup.py router<br/>POST /api/system/backup/run<br/>GET /api/system/backup/list<br/>GET /api/system/backup/{id}/download] --> BS[BackupService]
        SCH[scheduler.py<br/>daily_backup job] --> BS

        HC -->|asyncio.gather| FC[Firestore check]
        HC -->|asyncio.gather| AC[Auth check]
        HC -->|asyncio.gather| SC[Storage check]
        HC -->|asyncio.gather| JC[Scheduler check]
        HC -->|asyncio.gather| APC[API self-check]
        HC -->|asyncio.gather| MC[Memory check]
        HC -->|asyncio.gather| CC2[CPU check]
        HC -->|asyncio.gather| EC[Error count check]

        HC -->|30s TTL| CACHE[AppCache<br/>cache.py]

        BS -->|export collections| FS[(Firestore)]
        BS -->|gzip + upload| GCS[(Firebase Cloud Storage<br/>backups/{org_id}/{date}/)]
        BS -->|integrity verify| GCS
        BS -->|write Backup_Record| FS
        BS -->|on failure| ES[email_service.py]
    end

    HN -->|GET /api/system/health/full| HR
    SHP -->|GET /api/system/health/full?force=true| HR
    BHT -->|GET /api/system/backup/list| BR
    BHT -->|GET /api/system/backup/{id}/download| BR
    SHP -->|POST /api/system/backup/run| BR

    subgraph Auth ["Auth Layer"]
        GCU[get_current_user dependency]
        RBAC[role check: admin/owner]
    end

    HR --> GCU
    BR --> GCU
    BR --> RBAC
```

### Key Design Decisions

- **Separate routers, not monolithic system.py** — `health.py` and `backup.py` are new files registered in `main.py`. The stub backup endpoints in `system.py` are removed to avoid duplication. This keeps `system.py` focused on settings/profile/org.
- **`asyncio.gather` with `return_exceptions=True`** — Each component check is an `async` coroutine. `asyncio.gather(*checks, return_exceptions=True)` ensures one failing check never blocks others, and exceptions are caught per-component.
- **30-second in-memory cache** — Uses the existing `AppCache` with a dedicated key `health:full:{org_id}`. The `force=true` query param bypasses the cache and refreshes it.
- **Org-scoped storage paths** — All backup files are stored under `backups/{org_id}/{YYYY-MM-DD}/backup_{timestamp}.json.gz`, enforced in `BackupService` before any upload.
- **Retention via Firestore query** — After each backup, the service queries the `backups` collection ordered by `created_at` descending, keeps the first 30, and deletes the rest (both Firestore records and Cloud Storage files).

---

## Components and Interfaces

### Backend Services

#### `backend/app/services/health_checker.py`

```python
@dataclass
class HealthCheckResult:
    component: str
    status: Literal["healthy", "degraded", "unhealthy"]
    response_time_ms: float
    message: str
    checked_at: str  # ISO8601

@dataclass
class FullHealthReport:
    overall_status: Literal["healthy", "degraded", "unhealthy"]
    checked_at: str
    components: list[HealthCheckResult]
    recommendations: list[str]

class HealthChecker:
    async def run_full_check(self) -> FullHealthReport: ...
    async def _check_firestore(self) -> HealthCheckResult: ...
    async def _check_auth(self) -> HealthCheckResult: ...
    async def _check_storage(self) -> HealthCheckResult: ...
    async def _check_scheduler(self) -> HealthCheckResult: ...
    async def _check_api_self(self) -> HealthCheckResult: ...
    async def _check_memory(self) -> HealthCheckResult: ...
    async def _check_cpu(self) -> HealthCheckResult: ...
    async def _check_recent_errors(self) -> HealthCheckResult: ...
    def _classify_result(self, component: str, response_time_ms: float,
                         exception: Exception | None, extra: dict) -> HealthCheckResult: ...
    def _compute_overall(self, results: list[HealthCheckResult]) -> str: ...
    def _build_recommendations(self, results: list[HealthCheckResult]) -> list[str]: ...
```

Status classification rules (applied in `_classify_result`):
- Exception or timeout → `"unhealthy"`, sanitized message (no stack trace)
- `response_time_ms >= 500` → `"degraded"`
- Memory > 95% → `"unhealthy"`, > 85% → `"degraded"`
- CPU > 80% → `"degraded"`
- Error count >= 200 → `"unhealthy"`, >= 50 → `"degraded"`
- Otherwise → `"healthy"`

#### `backend/app/services/backup_service.py`

```python
@dataclass
class BackupRecord:
    id: str
    org_id: str
    filename: str
    storage_path: str
    created_at: str
    status: Literal["success", "failed"]
    integrity_status: Literal["verified", "failed", "pending"]
    total_documents: int
    collections_backed_up: list[str]
    file_size_bytes: int
    checksum_sha256: str
    error_message: str | None

class BackupService:
    COLLECTIONS: ClassVar[list[str]]  # 40 collection names from Req 4.1
    RETENTION_COUNT: ClassVar[int] = 30

    def __init__(self, org_id: str): ...
    async def run_backup(self) -> BackupRecord: ...
    async def _export_collections(self) -> dict[str, list[dict]]: ...
    def _serialize_to_json(self, data: dict) -> bytes: ...  # returns raw JSON bytes
    def _compress(self, data: bytes) -> bytes: ...           # gzip compress
    def _compute_checksum(self, data: bytes) -> str: ...     # SHA-256 hex
    async def _upload(self, compressed: bytes, path: str) -> None: ...
    async def _verify_integrity(self, path: str, expected_count: int) -> tuple[bool, int]: ...
    async def _write_record(self, record: BackupRecord) -> None: ...
    async def _enforce_retention(self) -> None: ...
    async def _notify_failure(self, record: BackupRecord) -> None: ...
```

#### `backend/app/api/health.py`

```python
router = APIRouter(prefix="/api/system", tags=["Health"])

@router.get("/health/full")
async def get_full_health(
    force: bool = Query(False),
    user: dict = Depends(get_current_user),  # any authenticated user
) -> FullHealthReport: ...
```

Cache key: `health:full:{user["org_id"]}`, TTL 30 seconds. `force=True` bypasses and refreshes.

#### `backend/app/api/backup.py`

```python
router = APIRouter(prefix="/api/system", tags=["Backup"])

@router.get("/backup/list")
async def list_backups(user: dict = Depends(get_current_user)) -> list[BackupRecord]:
    # Requires admin/owner role → 403 otherwise

@router.post("/backup/run", status_code=202)
async def run_backup(
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> dict:
    # Requires admin/owner role → 403 otherwise
    # Enqueues backup as background task, returns {"status": "queued"}

@router.get("/backup/{backup_id}/download")
async def download_backup(
    backup_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    # Requires admin/owner role AND org_id match → 403 otherwise
    # Returns {"url": "<signed_url>", "expires_in_minutes": 60}
```

### Frontend Components

#### `frontend/src/pages/settings/SystemHealthPage.tsx`

Top-level page component at route `/settings/system-health`. Accessible only to `admin`/`owner` roles (guarded by existing route protection pattern).

Sub-components:
- `OverallStatusBanner` — Ant Design `Alert` with dynamic `type` (`success`/`warning`/`error`) and icon based on `overall_status`. Shows "Health check unavailable" on API failure.
- `ComponentCard` — Ant Design `Card` with `Badge`/`Tag` for status, response time, and message. One card per component.
- `RecommendationsPanel` — Ant Design `List` of recommendation strings, hidden when empty.
- `BackupHistoryTable` — Ant Design `Table` with columns: date/time, status badge, integrity badge, total docs, file size, storage path, download button. "Run Backup Now" button above the table.
- `LastCheckedTimestamp` — Displays ISO timestamp in human-readable format using `dayjs`.

#### `frontend/src/hooks/useHealthNotification.ts`

Custom hook called once after successful login for `admin`/`owner` users. Uses `useEffect` with a one-shot flag. Calls `GET /api/system/health/full` silently. On success: shows `notification.success` (4s auto-dismiss) for healthy, `notification.warning`/`notification.error` (persistent, with "View Details" link) for degraded/unhealthy. On API failure: silently swallows the error.

---

## Data Models

### Firestore: `backups` Collection

Path: `backups/{backup_id}` (org-scoped via `org_id` field, not subcollection — consistent with existing pattern in `system.py`).

```typescript
interface BackupRecord {
  id: string;                          // Firestore document ID (UUID)
  org_id: string;                      // Organization ID
  filename: string;                    // e.g. "backup_20240115_020000.json.gz"
  storage_path: string;                // e.g. "backups/org123/2024-01-15/backup_20240115_020000.json.gz"
  created_at: string;                  // ISO8601 UTC
  status: "success" | "failed";
  integrity_status: "verified" | "failed" | "pending";
  total_documents: number;             // total docs across all collections
  collections_backed_up: string[];     // list of collection names included
  file_size_bytes: number;             // size of compressed .gz file
  checksum_sha256: string;             // hex SHA-256 of compressed bytes
  error_message: string | null;        // null on success
}
```

### API Response: `FullHealthReport`

```typescript
interface HealthCheckResult {
  component: string;                   // e.g. "firestore", "memory", "cpu"
  status: "healthy" | "degraded" | "unhealthy";
  response_time_ms: number;
  message: string;                     // sanitized, human-readable
  checked_at: string;                  // ISO8601 UTC
}

interface FullHealthReport {
  overall_status: "healthy" | "degraded" | "unhealthy";
  checked_at: string;                  // ISO8601 UTC of this check run
  components: HealthCheckResult[];     // one per component (8 total)
  recommendations: string[];           // one or more per non-healthy component
}
```

### Backup Archive JSON Structure

```json
{
  "org_id": "org_abc123",
  "exported_at": "2024-01-15T02:00:00Z",
  "version": "1.0",
  "collections": {
    "users": [ { "id": "...", ... } ],
    "invoices": [ { "id": "...", ... } ],
    "contacts": [],
    "..."  : []
  }
}
```

### Scheduler Job Configuration

```python
# In scheduler.py
_scheduler.add_job(
    _job_daily_backup,
    trigger=CronTrigger(
        hour=int(os.getenv("BACKUP_CRON_HOUR", "2")),
        minute=int(os.getenv("BACKUP_CRON_MINUTE", "0")),
    ),
    id="daily_backup",
    name="Daily Organization Backup",
    replace_existing=True,
)
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Component status classification is deterministic by response time

*For any* component check result with a response time strictly less than 500ms and no exception, the `_classify_result` function SHALL assign `status = "healthy"`. *For any* response time >= 500ms (with no exception), it SHALL assign `status = "degraded"`. *For any* exception (regardless of response time), it SHALL assign `status = "unhealthy"`.

**Validates: Requirements 1.3, 1.4, 1.5**

### Property 2: Memory and CPU thresholds are correctly applied

*For any* memory usage percentage `m`, the memory component status SHALL be `"unhealthy"` when `m >= 95`, `"degraded"` when `85 < m < 95`, and `"healthy"` when `m <= 85`. *For any* CPU usage percentage `c`, the CPU component status SHALL be `"degraded"` when `c > 80` and `"healthy"` when `c <= 80`.

**Validates: Requirements 1.7, 1.8, 1.9**

### Property 3: Error count thresholds are correctly applied

*For any* recent error count `n`, the errors component status SHALL be `"unhealthy"` when `n >= 200`, `"degraded"` when `50 <= n < 200`, and `"healthy"` when `n < 50`.

**Validates: Requirements 1.10, 1.11**

### Property 4: Overall status aggregation is correct

*For any* list of component statuses, `_compute_overall` SHALL return `"unhealthy"` if at least one component is `"unhealthy"`, `"degraded"` if at least one is `"degraded"` and none are `"unhealthy"`, and `"healthy"` only when all components are `"healthy"`.

**Validates: Requirements 1.13**

### Property 5: Recommendations cover all non-healthy components

*For any* list of `HealthCheckResult` objects where `k` components have status != `"healthy"`, the `_build_recommendations` function SHALL return a list with at least `k` entries.

**Validates: Requirements 1.14**

### Property 6: Error messages are sanitized (no stack traces)

*For any* Python exception passed to `_classify_result`, the resulting `message` field SHALL NOT contain any of the substrings `"Traceback"`, `"File \""`, `"line "`, or `"raise "`.

**Validates: Requirements 10.5**

### Property 7: Backup archive round-trip preserves document set

*For any* valid backup archive (a dict mapping collection names to lists of documents), serializing to JSON, gzip-compressing, decompressing, and JSON-parsing SHALL produce a document set equivalent to the original (same collection names, same document count per collection, same document IDs).

**Validates: Requirements 5.6**

### Property 8: SHA-256 checksum is deterministic

*For any* byte sequence `b`, calling `_compute_checksum(b)` twice SHALL return the same hex string both times.

**Validates: Requirements 5.2**

### Property 9: Integrity verification correctly classifies count match/mismatch

*For any* backup archive where the exported document count equals the count obtained by decompressing and counting the uploaded file, `integrity_status` SHALL be `"verified"`. *For any* archive where the counts differ or decompression fails, `integrity_status` SHALL be `"failed"`.

**Validates: Requirements 5.3, 5.4**

### Property 10: Backup record contains all required fields

*For any* completed backup run (success or failure), the resulting `BackupRecord` SHALL contain non-null values for `id`, `org_id`, `filename`, `storage_path`, `created_at`, `status`, `integrity_status`, `total_documents`, `collections_backed_up`, `file_size_bytes`, and `checksum_sha256`.

**Validates: Requirements 4.5**

### Property 11: Retention policy keeps at most 30 records

*For any* sequence of `N > 30` backup runs for the same organization, after `_enforce_retention` completes, the `backups` collection SHALL contain exactly 30 records (the most recent 30 by `created_at`).

**Validates: Requirements 4.7**

### Property 12: Empty collections are included in backup

*For any* organization where a subset of the 40 required collections have zero documents, the backup archive SHALL still include those collections as empty arrays, and `integrity_status` SHALL be `"verified"` (zero exported == zero verified).

**Validates: Requirements 4.8, 5.3**

### Property 13: Org-scoped storage paths

*For any* organization with `org_id = X`, every backup file uploaded by `BackupService` SHALL have a `storage_path` that starts with `backups/X/`.

**Validates: Requirements 10.6**

### Property 14: Cross-org download is rejected

*For any* user with `org_id = A` attempting to download a backup record with `org_id = B` where `A != B`, the endpoint SHALL return HTTP 403 regardless of the user's role.

**Validates: Requirements 10.3**

### Property 15: Scheduler cron hour and minute are configurable

*For any* integer `h` in `[0, 23]` set as `BACKUP_CRON_HOUR`, and any integer `m` in `[0, 59]` set as `BACKUP_CRON_MINUTE`, the `CronTrigger` added to the scheduler SHALL use `hour=h` and `minute=m`.

**Validates: Requirements 6.3, 6.4**

### Property 16: Scheduler continues on per-org failure

*For any* list of organizations where a subset fail during backup, the daily backup job SHALL attempt backup for every organization in the list, and the number of attempted backups SHALL equal the total number of organizations.

**Validates: Requirements 6.8**

### Property 17: Failure notifications reach all admin/owner users

*For any* organization with `k` users having role `admin` or `owner`, a failed backup run SHALL trigger exactly `k` email send attempts (one per admin/owner user).

**Validates: Requirements 7.1**

### Property 18: Success runs do not trigger email notifications

*For any* backup run that completes with `status = "success"` and `integrity_status = "verified"`, the `_notify_failure` method SHALL NOT call `send_email`.

**Validates: Requirements 7.3**

### Property 19: Health check cache respects 30-second TTL

*For any* cache entry with age `t` seconds where `t < 30`, calling `GET /api/system/health/full` (without `force=true`) SHALL return the cached result without re-running component checks. *For any* `force=true` call, the response SHALL contain freshly computed data regardless of cache age.

**Validates: Requirements 9.2, 9.4**

### Property 20: Login health notification only fires for admin/owner

*For any* authenticated user with a role other than `admin` or `owner`, the `useHealthNotification` hook SHALL NOT call `GET /api/system/health/full`.

**Validates: Requirements 3.5**

---

## Error Handling

### Backend

| Scenario | Behavior |
|---|---|
| Individual component check raises exception | Caught by `asyncio.gather(return_exceptions=True)`; component status set to `"unhealthy"` with sanitized message; other components unaffected |
| Firestore export fails for one collection | Collection included as empty array; error logged; backup continues |
| Cloud Storage upload fails | `BackupRecord.status = "failed"`, `error_message` set; failure notification sent |
| Integrity verification timeout (>120s) | `integrity_status = "failed"`; failure notification sent |
| Email send fails | Logged at ERROR level; retried up to 3 times with exponential backoff; never raises to caller |
| Backup job fails for one org | Exception caught; logged; next org processed; job-level summary logged at completion |
| `force=true` health check while another is in progress | Each request runs independently; no locking needed (stateless checks) |
| Unauthenticated request to `/health/full` | FastAPI `get_current_user` dependency raises HTTP 401 |
| Non-admin request to backup endpoints | `_require_admin` helper raises HTTP 403 |
| Cross-org download attempt | Backup record `org_id` compared to `user["org_id"]`; HTTP 403 if mismatch |

### Frontend

| Scenario | Behavior |
|---|---|
| Health check API call fails on page load | Ant Design `Alert` with `type="error"` and retry button; overall banner shows "Health check unavailable" |
| Health check API call fails during login | `useHealthNotification` silently catches the error; no UI disruption |
| Backup run takes longer than expected | Loading spinner remains; React Query timeout after 120s shows error toast |
| Download URL fetch fails | Ant Design `message.error` toast |
| User navigates away during backup | Background task continues on server; no client-side cancellation needed |

---

## Testing Strategy

### Unit Tests (Python — pytest + pytest-asyncio)

Focus on pure logic: status classification, aggregation, serialization, checksum, retention.

- `test_health_checker.py` — Test `_classify_result` with boundary values (499ms, 500ms, 501ms), exception inputs, memory/CPU/error thresholds. Test `_compute_overall` with all combinations of component status lists. Test `_build_recommendations` returns at least one entry per non-healthy component.
- `test_backup_service.py` — Test `_serialize_to_json` produces valid JSON with correct structure. Test `_compress`/decompress round-trip. Test `_compute_checksum` determinism. Test `_enforce_retention` with N=31, N=30, N=29 records. Test `_verify_integrity` with matching and mismatching counts.
- `test_backup_api.py` — Test role enforcement (403 for non-admin), org-scoping (403 for cross-org download), 401 for unauthenticated.

### Property-Based Tests (Python — Hypothesis)

Uses [Hypothesis](https://hypothesis.readthedocs.io/) with minimum 100 examples per property.

Tag format: `# Feature: system-health-backup, Property {N}: {property_text}`

```python
# Example property test structure
from hypothesis import given, settings as hyp_settings
from hypothesis import strategies as st

# Feature: system-health-backup, Property 1: Component status classification
@given(response_time_ms=st.floats(min_value=0, max_value=499.9))
@hyp_settings(max_examples=200)
def test_healthy_status_for_fast_response(response_time_ms):
    result = classify_result("firestore", response_time_ms, exception=None, extra={})
    assert result.status == "healthy"

# Feature: system-health-backup, Property 4: Overall status aggregation
@given(statuses=st.lists(st.sampled_from(["healthy", "degraded", "unhealthy"]), min_size=1, max_size=10))
@hyp_settings(max_examples=500)
def test_overall_status_aggregation(statuses):
    overall = compute_overall(statuses)
    if "unhealthy" in statuses:
        assert overall == "unhealthy"
    elif "degraded" in statuses:
        assert overall == "degraded"
    else:
        assert overall == "healthy"

# Feature: system-health-backup, Property 7: Backup archive round-trip
@given(collections=st.dictionaries(
    keys=st.sampled_from(BackupService.COLLECTIONS),
    values=st.lists(st.fixed_dictionaries({"id": st.uuids().map(str)}), max_size=20),
    min_size=1,
))
@hyp_settings(max_examples=100)
def test_backup_round_trip(collections):
    svc = BackupService.__new__(BackupService)
    raw = svc._serialize_to_json({"org_id": "test", "exported_at": "...", "version": "1.0", "collections": collections})
    compressed = svc._compress(raw)
    decompressed = gzip.decompress(compressed)
    parsed = json.loads(decompressed)
    for col, docs in collections.items():
        assert col in parsed["collections"]
        assert len(parsed["collections"][col]) == len(docs)
```

Properties covered by Hypothesis tests: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20.

### Integration Tests (Python — pytest with Firebase emulator)

- Full backup run against Firestore emulator: verify record created, file uploaded, integrity verified.
- Scheduler job registration: verify `daily_backup` job exists in scheduler with correct trigger type.
- Email notification: mock `send_email`, trigger failed backup, verify mock called with correct args.

### Frontend Tests (Vitest + React Testing Library)

- `SystemHealthPage.test.tsx` — Mock `GET /api/system/health/full`, verify component cards render, banner color matches status, recommendations section visible, refresh button triggers new call.
- `BackupHistoryTable.test.tsx` — Mock `GET /api/system/backup/list`, verify table rows, failed row has red background, download button calls correct endpoint.
- `useHealthNotification.test.ts` — Mock login context, verify hook fires for admin/owner, skips for regular users, suppresses API errors.
- RTL layout: render with `dir="rtl"` context, verify layout direction is applied.

### Minimum Test Configuration

- Hypothesis: `max_examples=200` for classification properties, `max_examples=100` for round-trip/structural properties.
- pytest-asyncio: `asyncio_mode = "auto"` in `pytest.ini`.
- All property tests tagged with `# Feature: system-health-backup, Property N`.
