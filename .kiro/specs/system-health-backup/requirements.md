# Requirements Document

## Introduction

This feature adds a **System Health Check + Auto Backup** capability to the ERP system (React/TypeScript + FastAPI + Firestore, deployed on Vercel + Cloud Run). It has two main pillars:

1. **System Health Dashboard** — When an admin logs in, the system automatically runs a comprehensive health check across all components (Firestore, API endpoints, Firebase Auth, Cloud Storage, background scheduler jobs, integrations, memory/CPU, recent errors) and presents a professional, real-time dashboard with status indicators (green/yellow/red), response times, error counts, and actionable recommendations.

2. **Auto Backup** — A daily scheduled job exports every critical Firestore collection to a compressed JSON file, stores it in Firebase Cloud Storage, verifies the backup's integrity (document count + checksum), and notifies the admin by email if the backup fails or if integrity verification does not pass.

The feature builds on existing infrastructure: the APScheduler-based `scheduler.py`, the `StorageService`, the `/api/health` and `/api/ready` endpoints, and the stub backup endpoints in `system.py`.

---

## Glossary

- **Health_Dashboard**: The React frontend page that displays the real-time health report for all system components.
- **Health_Checker**: The FastAPI backend service that runs individual component checks and aggregates results.
- **Backup_Service**: The FastAPI backend service that exports Firestore collections, compresses the archive, uploads it to Firebase Cloud Storage, and verifies integrity.
- **Backup_Scheduler**: The APScheduler job that triggers the Backup_Service daily at a configurable time.
- **Backup_Record**: A Firestore document in the `backups` collection that stores metadata for each backup run (timestamp, status, file path, document counts, checksum, error message).
- **Health_Check_Result**: A structured object containing `component`, `status` (healthy / degraded / unhealthy), `response_time_ms`, `message`, and `checked_at`.
- **Admin**: A user with `role == "admin"` or `role == "owner"` in Firestore.
- **Notification_Service**: The existing `email_service.py` used to send alert emails.
- **Component**: Any measurable subsystem — Firestore, Auth, Storage, Scheduler, API, Memory, CPU, Integrations, Recent Errors.
- **Integrity_Check**: Post-backup verification that counts documents in the archive and compares a SHA-256 checksum against the stored value.

---

## Requirements

---

### Requirement 1: Health Check API

**User Story:** As an admin, I want the backend to expose a comprehensive health check endpoint, so that the frontend dashboard can display the real-time status of every system component.

#### Acceptance Criteria

1. THE Health_Checker SHALL expose a `GET /api/system/health/full` endpoint that returns a `Health_Check_Result` for each of the following components: Firestore connectivity, Firebase Auth service, Firebase Cloud Storage, APScheduler (background jobs), API self-check (response time of `/api/health`), memory usage percentage, CPU usage percentage, and recent error count (last 1 hour from audit/error logs).
2. WHEN the `GET /api/system/health/full` endpoint is called, THE Health_Checker SHALL complete all component checks and return a response within 10 seconds.
3. WHEN a component check completes successfully with response time under 500ms, THE Health_Checker SHALL set that individual component's `status` to `"healthy"` based solely on that component's own response time, independent of other components; a component check that raises an exception or times out is NOT considered a successful completion and SHALL be treated as a failure per criterion 5.
4. WHEN a component check completes but response time exceeds 500ms or a non-critical warning condition is detected, THE Health_Checker SHALL set that individual component's `status` to `"degraded"`, leaving other components unaffected.
5. WHEN a specific component check fails (exception, timeout, or unreachable), THE Health_Checker SHALL automatically set only that failed component's `status` to `"unhealthy"` and include a sanitized human-readable `message` describing the failure, leaving all other components unaffected.
6. THE Health_Checker SHALL run all component checks concurrently using `asyncio.gather` to minimize total response time.
7. WHEN memory usage exceeds 85%, THE Health_Checker SHALL set the memory component's `status` to `"degraded"`.
8. WHEN memory usage exceeds 95%, THE Health_Checker SHALL set the memory component's `status` to `"unhealthy"`.
9. WHEN CPU usage exceeds 80% (averaged over 5 seconds), THE Health_Checker SHALL set the CPU component's `status` to `"degraded"`.
10. WHEN the recent error count in the last 1 hour is greater than or equal to 50 (evaluated by direct numeric comparison), THE Health_Checker SHALL set the errors component's `status` to `"degraded"`.
11. WHEN the recent error count in the last 1 hour is greater than or equal to 200 (evaluated by direct numeric comparison), THE Health_Checker SHALL set the errors component's `status` to `"unhealthy"`.
12. THE `GET /api/system/health/full` endpoint SHALL require authentication and SHALL be accessible to any authenticated user regardless of role; unauthenticated requests SHALL be rejected with HTTP 401.
13. THE Health_Checker SHALL include an `overall_status` field in the response that is `"healthy"` only when all components are healthy, `"degraded"` when at least one component is degraded and none are unhealthy, and `"unhealthy"` when at least one component is unhealthy.
14. THE Health_Checker SHALL include a `recommendations` array in the response containing actionable strings for every component that is not `"healthy"`.

---

### Requirement 2: Health Dashboard UI

**User Story:** As an admin, I want a professional, modern health dashboard page in the ERP frontend, so that I can instantly see the status of every system component with visual indicators and recommendations.

#### Acceptance Criteria

1. THE Health_Dashboard SHALL be accessible at the route `/settings/system-health` and SHALL be visible only to users with role `admin` or `owner`.
2. WHEN an Admin navigates to the Health_Dashboard, THE Health_Dashboard SHALL automatically trigger a health check call to `GET /api/system/health/full` and display a loading skeleton while the response is pending; the loading skeleton SHALL be hidden immediately when the API call fails.
3. THE Health_Dashboard SHALL display each component as a card showing: component name, status badge (green for healthy, yellow for degraded, red for unhealthy), response time in milliseconds, and a short status message.
4. THE Health_Dashboard SHALL display an overall system status banner at the top of the page using the `overall_status` value from the API response; WHEN the API call itself has failed, THE Health_Dashboard SHALL override the banner to display an error state (red background, "Health check unavailable" message) rather than showing any cached or assumed status.
5. WHEN the `overall_status` is `"unhealthy"`, THE Health_Dashboard SHALL display the banner with a red background and a prominent warning icon.
6. WHEN the `overall_status` is `"degraded"`, THE Health_Dashboard SHALL display the banner with a yellow/amber background and a caution icon.
7. WHEN the `overall_status` is `"healthy"`, THE Health_Dashboard SHALL display the banner with a green background and a checkmark icon.
8. THE Health_Dashboard SHALL display a `Recommendations` section listing all actionable recommendations returned by the API.
9. THE Health_Dashboard SHALL include a "Refresh" button that re-triggers the health check call and updates all component cards.
10. WHEN the health check API call fails (network error or 5xx), THE Health_Dashboard SHALL display an Ant Design error Alert with a retry button.
11. THE Health_Dashboard SHALL display the timestamp of the last successful health check in a human-readable format.
12. THE Health_Dashboard SHALL support both RTL (Kurdish/Arabic) and LTR (English) layouts using the existing i18n infrastructure.
13. WHERE the user's browser supports it, THE Health_Dashboard SHALL auto-refresh the health check every 60 seconds while the page is open.

---

### Requirement 3: Login-Triggered Health Check

**User Story:** As an admin, I want the system to automatically run a health check when I log in, so that I am immediately aware of any system issues without having to navigate to the health page manually.

#### Acceptance Criteria

1. WHEN an Admin successfully logs in, THE Health_Dashboard SHALL display a non-blocking notification (Ant Design notification component) summarizing the overall system status within 5 seconds of login completion.
2. WHEN the overall status is `"healthy"`, THE Health_Dashboard SHALL display a brief green success notification that auto-dismisses after 4 seconds.
3. WHEN the overall status is `"degraded"` or `"unhealthy"`, THE Health_Dashboard SHALL display a persistent warning/error notification (matching the actual system status color) with a "View Details" link that navigates to `/settings/system-health` only upon explicit user click; THE Health_Dashboard SHALL NOT automatically navigate to `/settings/system-health` without user interaction.
4. IF the health check API call fails during login, THEN THE Health_Dashboard SHALL silently suppress the error and not block the login flow.
5. THE login-triggered health check SHALL only run for users with role `admin` or `owner` and SHALL be skipped for regular users.

---

### Requirement 4: Comprehensive Auto Backup

**User Story:** As an admin, I want the system to automatically back up all critical Firestore data every day, so that no business data is ever permanently lost.

#### Acceptance Criteria

1. THE Backup_Service SHALL export all documents from the following Firestore collections per organization: `users`, `organizations`, `contacts`, `items`, `invoices`, `invoice_lines`, `expenses`, `expense_lines`, `accounts`, `journal_entries`, `payments`, `payments_made`, `quotes`, `quote_lines`, `sales_orders`, `purchase_orders`, `credit_notes`, `vendor_credits`, `inventory`, `locations`, `taxes`, `settings`, `audit_logs`, `recurring_invoices`, `fixed_assets`, `hr_employees`, `payroll_runs`, `crm_leads`, `crm_opportunities`, `pos_sessions`, `pos_orders`, `manufacturing_orders`, `subscriptions`, `branches`, `custom_fields`, `automation_rules`, `budgets`, `currency_rates`, `numbering_sequences`; IF an organization has zero documents across all collections, THE Backup_Service SHALL still produce a backup archive with all collections represented as empty arrays and SHALL NOT skip that organization.
2. THE Backup_Service SHALL serialize all exported documents to a single JSON file with the structure `{ "org_id": "...", "exported_at": "ISO8601", "version": "1.0", "collections": { "<collection_name>": [ ...documents ] } }`.
3. THE Backup_Service SHALL compress the JSON file using gzip before uploading to Firebase Cloud Storage.
4. THE Backup_Service SHALL upload the compressed backup to Firebase Cloud Storage at the path `backups/{org_id}/{YYYY-MM-DD}/backup_{timestamp}.json.gz`.
5. WHEN the upload completes, THE Backup_Service SHALL create a `Backup_Record` in the Firestore `backups` collection containing: `org_id`, `filename`, `storage_path`, `created_at`, `status` (`"success"` or `"failed"`), `total_documents`, `collections_backed_up`, `file_size_bytes`, `checksum_sha256`, and `error_message` (null on success).
6. THE Backup_Service SHALL support manual backup triggering via `POST /api/system/backup/run` (Admin only), in addition to the scheduled daily run.
7. THE Backup_Service SHALL retain the last 30 backup records per organization and automatically delete older records from both Firestore and Cloud Storage.
8. WHEN a collection does not exist or is empty for an organization, THE Backup_Service SHALL include it in the backup JSON with an empty array and SHALL NOT treat this as an error.

---

### Requirement 5: Backup Integrity Verification

**User Story:** As an admin, I want every backup to be automatically verified after creation, so that I can trust that the backup is complete and uncorrupted.

#### Acceptance Criteria

1. WHEN a backup file is uploaded to Cloud Storage, THE Backup_Service SHALL download the file, decompress it, and count the total number of documents across all collections.
2. THE Backup_Service SHALL compute a SHA-256 checksum of the raw compressed bytes before upload and store it in the `Backup_Record`.
3. WHEN the document count in the verification step matches the count recorded during export AND the document counting process itself succeeded without error, THE Backup_Service SHALL set the `Backup_Record` `integrity_status` field to `"verified"`. An empty backup where both the exported count and the verified count are zero SHALL be considered `"verified"`.
4. WHEN the document count does not match, the document counting process fails, or the file cannot be decompressed, THE Backup_Service SHALL set the `Backup_Record` `integrity_status` to `"failed"` and `status` to `"failed"`.
5. THE Backup_Service SHALL complete the integrity verification within 120 seconds of upload completion.
6. FOR ALL valid backup archives, parsing (decompressing + JSON decoding) then re-encoding then parsing again SHALL produce an equivalent document set (round-trip property).

---

### Requirement 6: Backup Scheduler

**User Story:** As an admin, I want backups to run automatically every day at a configurable time, so that I never have to remember to trigger them manually.

#### Acceptance Criteria

1. THE Backup_Scheduler SHALL add a daily backup job to the existing APScheduler instance in `scheduler.py` using a `CronTrigger`.
2. THE Backup_Scheduler SHALL default to running at 02:00 UTC daily.
3. WHERE the environment variable `BACKUP_CRON_HOUR` is set, THE Backup_Scheduler SHALL use that value (0–23) as the hour for the daily backup trigger.
4. WHERE the environment variable `BACKUP_CRON_MINUTE` is set, THE Backup_Scheduler SHALL use that value (0–59) as the minute for the daily backup trigger.
5. THE Backup_Scheduler SHALL back up all organizations in sequence during a single daily run.
6. WHEN the daily backup job starts, THE Backup_Scheduler SHALL log the start time and list of organizations to be backed up.
7. WHEN the daily backup job completes, THE Backup_Scheduler SHALL log the total duration, number of organizations backed up, and any failures.
8. IF the Backup_Scheduler job fails for one organization, THEN THE Backup_Scheduler SHALL continue processing remaining organizations and SHALL NOT abort the entire run.

---

### Requirement 7: Backup Failure Notifications

**User Story:** As an admin, I want to receive an email alert when a backup fails or integrity verification fails, so that I can take corrective action before data is at risk.

#### Acceptance Criteria

1. WHEN a backup run completes with `status == "failed"` or `integrity_status == "failed"`, THE Notification_Service SHALL send an alert email to all users with role `admin` or `owner` in the affected organization.
2. THE alert email SHALL include: organization name, backup timestamp, failure reason (error message), and a direct link to the Health Dashboard at `/settings/system-health`.
3. WHEN a backup run completes successfully with `integrity_status == "verified"`, THE Notification_Service SHALL NOT send any email (success is silent).
4. IF the email sending itself fails, THEN THE Notification_Service SHALL log the failure at ERROR level and SHALL NOT retry more than 3 times.
5. THE Notification_Service SHALL use the existing `email_service.py` `send_email` function for all backup alert emails.

---

### Requirement 8: Backup Management UI

**User Story:** As an admin, I want to view backup history, trigger manual backups, and download backup files from the Health Dashboard, so that I have full visibility and control over the backup process.

#### Acceptance Criteria

1. THE Health_Dashboard SHALL include a "Backup History" section displaying the last 30 backup records in a table with columns: date/time, status badge, integrity status badge, total documents, file size, and a download button.
2. WHEN an Admin clicks the "Run Backup Now" button, THE Health_Dashboard SHALL call `POST /api/system/backup/run`, show a loading spinner, and refresh the backup history table upon completion.
3. WHEN an Admin clicks the download button for a backup record, THE Health_Dashboard SHALL call `GET /api/system/backup/{backup_id}/download` which returns a signed Firebase Cloud Storage URL valid for 60 minutes.
4. THE `GET /api/system/backup/{backup_id}/download` endpoint SHALL require Admin authentication.
5. THE Health_Dashboard SHALL always display every backup record row in the Backup History table regardless of whether visual failure indicators render; WHEN a backup record has `status == "failed"` AND the visual indicator renders successfully, THE Health_Dashboard SHALL additionally apply a red background to that row and show the error message in a tooltip on the status badge; tooltips SHALL also be available on successful backup status badges to show additional metadata.
6. WHEN a backup record has `integrity_status == "failed"`, THE Health_Dashboard SHALL display a warning icon next to the integrity badge with a tooltip explaining the verification failure; tooltips SHALL also be available on verified integrity badges.
7. THE Health_Dashboard SHALL display the storage path and file size for each backup record.

---

### Requirement 9: Health Check Caching

**User Story:** As a system operator, I want health check results to be lightly cached, so that rapid repeated calls from multiple admin sessions do not overload the system.

#### Acceptance Criteria

1. THE Health_Checker SHALL cache the result of `GET /api/system/health/full` in the existing in-memory cache for 30 seconds.
2. WHEN a cached result exists and is less than 30 seconds old (strictly less than, not equal to), THE Health_Checker SHALL return the cached result immediately without re-running component checks.
3. WHEN the "Refresh" button is clicked on the Health_Dashboard, THE Health_Dashboard SHALL call `GET /api/system/health/full?force=true` to bypass the cache and force a fresh check.
4. WHEN `force=true` is passed, THE Health_Checker SHALL bypass the cache, run all component checks live, update the cache with the new result, and return the fresh result; the response SHALL NOT contain any data sourced from the cache and all component check data in the response SHALL be freshly computed from live checks performed during that request.

---

### Requirement 10: Security and Access Control

**User Story:** As a system owner, I want all health and backup endpoints to be protected, so that sensitive system information and backup data are never exposed to unauthorized users.

#### Acceptance Criteria

1. THE Health_Checker SHALL reject unauthenticated requests (no valid session) to `GET /api/system/health/full` with HTTP 401; any authenticated user regardless of role SHALL be permitted to call this endpoint.
2. THE Backup_Service SHALL reject requests to `POST /api/system/backup/run` from users without role `admin` or `owner` with HTTP 403.
3. THE Backup_Service SHALL reject requests to `GET /api/system/backup/{backup_id}/download` from any user whose `org_id` does not match the backup record's `org_id` with HTTP 403, regardless of the user's role (including admin and owner).
4. THE Backup_Service SHALL reject requests to `GET /api/system/backup/list` from users without role `admin` or `owner` with HTTP 403.
5. THE Health_Checker SHALL never include raw exception stack traces in API responses; error messages SHALL be sanitized to human-readable descriptions only.
6. THE Backup_Service SHALL store backup files under org-scoped paths (`backups/{org_id}/...`) in Cloud Storage to prevent cross-organization access.
