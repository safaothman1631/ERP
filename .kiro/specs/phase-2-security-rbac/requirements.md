# Requirements Document: Phase 2 — Security & Compliance

## Introduction

The audit reports identify ~126 endpoints across banking, HR, payroll, manufacturing, CRM, projects, and reports that lack `require_perm` enforcement, plus PII fields (national_id, salary, api_key, totp_secret) stored in plaintext, audit logs that are mutable, and missing GDPR data-subject endpoints. This phase closes those gaps without breaking existing flows.

---

## Glossary

- **RBAC sweep**: A systematic audit-and-fix pass over every router in `backend/app/api/` to ensure every mutating endpoint and every sensitive read enforces `require_perm`.
- **Field-level encryption**: Encrypting individual fields at rest using a Fernet symmetric key from Secret Manager, decrypting on read by authorized roles only.
- **PII**: Personally Identifiable Information — national_id, date_of_birth, address, phone, salary.
- **GDPR DSR**: Data-Subject Requests — Article 15 (export) and Article 17 (deletion).
- **Audit immutability**: A guarantee that no API caller (including admins) can modify or delete an audit log entry; enforced by Firestore security rules and missing UPDATE/DELETE endpoints.

---

## Requirements

### Requirement 1: RBAC Sweep

1. EVERY mutating endpoint (POST, PUT, PATCH, DELETE) in `backend/app/api/` SHALL declare a `require_perm("<resource>.<action>")` dependency.
2. EVERY sensitive read endpoint (banking, hr, payroll, salaries, audit logs, settings) SHALL declare `require_perm("<resource>.read")`.
3. THE script `backend/scripts/audit_rbac_coverage.py` SHALL list every router function and report whether `require_perm` is applied; exit code 0 only if every mutating endpoint is protected.
4. THE default permission set SHALL include new permission codes: `bank.read`, `bank.write`, `hr.read`, `hr.write`, `payroll.read`, `payroll.write`, `manufacturing.write`, `crm.write`, `projects.write`, `reports.export`, `reports.read`, `audit.read`, `accounts.fx_revalue`, `accounts.budget`, `accounts.close_fy`, `accounts.post_je`, `accounts.reverse_je`, `inventory.shipment`, `pos.refund`, `pos.discount`, `settings.numbering`, `settings.fiscal`.
5. WHEN a permission is missing, THE Backend SHALL respond HTTP 403 with `{detail: "Insufficient permissions: required <code>"}`.
6. THE existing `DEFAULT_ROLES` in `backend/app/services/permissions.py` SHALL be updated so admin/owner have all new permissions; accountant gets accounting+reports; sales gets invoices+contacts; etc.

### Requirement 2: Field-Level Encryption

1. THE Backend SHALL encrypt the following fields at rest: `hr_employees.national_id`, `hr_employees.bank_account`, `hr_contracts.salary_amount`, `payroll_runs.payslips.gross_salary`, `users.totp_secret`, `users.backup_codes`, `users.api_keys`, `iraq_payments.api_secret`.
2. Encryption SHALL use Fernet (AES-128-CBC + HMAC-SHA256) with the key sourced from `FIELD_ENCRYPTION_KEY` environment variable, loaded from GCP Secret Manager in production.
3. THE encryption helper SHALL live in `backend/app/services/crypto.py` exposing `encrypt_field(plaintext)` and `decrypt_field(ciphertext)`.
4. WHEN a field is encrypted, THE persisted value SHALL be a base64 string prefixed with `"enc:v1:"` so reads can detect ciphertext vs legacy plaintext.
5. WHEN reading a legacy plaintext value (no `"enc:v1:"` prefix), THE Backend SHALL return it as-is and SHALL log a deprecation warning to enable a one-time migration script.
6. THE migration script `backend/scripts/migrate_pii_encryption.py` SHALL re-write every existing PII field as encrypted, with `--dry-run` flag, exiting 0 on success.
7. THE crypto module SHALL never log plaintext or ciphertext; logs SHALL contain only field names and counts.
8. THE encryption key SHALL be rotatable: `decrypt_field` SHALL accept multiple keys (current + previous) so an admin can rotate without downtime.

### Requirement 3: GDPR Data-Subject Endpoints

1. THE Backend SHALL expose `GET /api/privacy/export?user_id=<id>&format=json|zip` returning all data linked to a user across all collections within 60 seconds for an org with up to 10,000 records per user.
2. THE export SHALL include: profile, contacts created by user, invoices/bills, audit log entries, attachments (links only).
3. THE export SHALL be available only to: (a) the user themselves, or (b) org admin/owner with `privacy.export` permission.
4. THE Backend SHALL expose `POST /api/privacy/delete?user_id=<id>` which marks the user `deleted_at=now`, anonymizes contact records (`name="Deleted User <hash>"`, email cleared, phone cleared), and schedules hard-delete after 30 days via APScheduler.
5. WHEN a user has been hard-deleted, THE Backend SHALL keep audit-log entries with the user_id but set `user_email=null` and `user_name="(deleted)"`.
6. THE deletion endpoint SHALL require explicit confirmation: body `{confirmation: "DELETE", reason: string}`.
7. THE export endpoint SHALL log the export to audit log with `action="privacy.export"`.

### Requirement 4: Audit Log Immutability

1. THE Firestore rules `firestore.rules` SHALL deny all UPDATE and DELETE operations on `audit_logs` collection from any authenticated client.
2. THE audit-log writer in `backend/app/middleware/audit.py` SHALL include a SHA-256 hash chain: each entry's `prev_hash` field equals the previous entry's `hash` (per-org chain), and each entry's `hash` is computed from `(timestamp, user_id, action, resource, prev_hash)`.
3. THE Backend SHALL expose `GET /api/audit/integrity-check` that walks the hash chain for an org and returns `{valid: bool, broken_at?: log_id}`.
4. THE Backend SHALL log every state-changing endpoint, including DELETEs and PATCHes, even when GET endpoints to sensitive data (e.g. `/api/payroll/runs/{id}` accessing salary).
5. WHEN an audit log entry fails to write, THE Backend SHALL still complete the user's request but SHALL emit a `logger.error` with full request context.

### Requirement 5: Sensitive GET Logging

1. THE audit middleware SHALL log GETs that match a configured allowlist: `/api/payroll/*`, `/api/hr/employees/*`, `/api/banking/*`, `/api/audit/*`, `/api/settings/*`, `/api/users/*`.
2. THE log entry for a sensitive GET SHALL include the path, query string (with secrets redacted), user, and timestamp — but SHALL NOT include the response body.
3. THE allowlist SHALL be configurable via `SENSITIVE_GET_PATHS` env var (comma-separated paths or regexes).

### Requirement 6: Password Policy + 2FA Enforcement

1. THE password policy SHALL require: minimum 10 characters, at least one uppercase, one lowercase, one digit, one symbol; SHALL reject the top 1000 most common passwords (use a checked-in list).
2. WHEN a user with role `admin` or `owner` attempts to authenticate without 2FA enabled, THE Backend SHALL prompt for 2FA setup before issuing any access token.
3. THE Backend SHALL expose `GET /api/auth/password-strength?password=<base64>` for client-side preview (rate-limited).
4. WHEN a user fails 2FA verification 5 times in a row, THE Backend SHALL lock the user for 15 minutes.

### Requirement 7: HSTS + CORS Hardening

1. THE Backend SHALL set `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` in production responses.
2. THE Backend SHALL reject CORS requests not in `CORS_ORIGINS`; wildcard `*` is forbidden in production.
3. THE Backend SHALL set `Content-Security-Policy` allowing only same-origin + Firebase + recharts, in report-only mode for first 30 days then enforce.

### Requirement 8: Test Coverage

1. THE backend SHALL ship at least the following new test files:
   - `tests/test_rbac_coverage.py` — every router has the right `require_perm`
   - `tests/test_field_encryption.py` — encrypt/decrypt round-trip; legacy plaintext detected
   - `tests/test_gdpr.py` — export & delete flows, confirmation required
   - `tests/test_audit_immutability.py` — hash chain integrity, reject mutation
   - `tests/test_password_policy.py` — strength validator
2. The full pytest run SHALL stay green (0 failures).
3. AgentShield CI scan SHALL show zero critical findings.

---

## Out of Scope

- SSO / SAML — defer to post-launch
- API key management UI — scaffold only
- Snailmail / IAP — defer
- Actual rotation of encryption key in production — out (just supply the capability)

## Definition of Done

- 0 unprotected mutating endpoints reported by `audit_rbac_coverage.py`
- All PII fields encrypted at rest in production data
- GDPR export and delete flows tested end-to-end
- Audit log hash chain verified for at least 1 org
- HSTS header observed in production responses
