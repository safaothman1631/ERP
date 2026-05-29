# Implementation Plan: Phase 2 — Security & Compliance

- [ ] 1. RBAC sweep
  - [ ] 1.1 Create `backend/scripts/audit_rbac_coverage.py` introspecting `app.routes`
  - [ ] 1.2 Run script; capture baseline JSON to `MASTER_AUDIT_REPORTS/rbac-baseline.json`
  - [ ] 1.3 Add new permission codes to `services/permissions.py` `ALL_PERMISSIONS` and `DEFAULT_ROLES`
  - [ ] 1.4 Sweep banking router (13 endpoints) — add `require_perm("bank.write"|"bank.read")`
  - [ ] 1.5 Sweep HR router (22 endpoints)
  - [ ] 1.6 Sweep payroll router (10 endpoints)
  - [ ] 1.7 Sweep manufacturing router (15 endpoints)
  - [ ] 1.8 Sweep projects router (12 endpoints)
  - [ ] 1.9 Sweep CRM router (18 endpoints)
  - [ ] 1.10 Sweep reports/exports routers (30 endpoints)
  - [ ] 1.11 Sweep journals/accounts (6 endpoints)
  - [ ] 1.12 Re-run audit script; expect 0 unprotected
  - [ ] 1.13 Write `tests/test_rbac_coverage.py` to enforce in CI

- [ ] 2. Field-level encryption
  - [ ] 2.1 Add `cryptography>=42.0.0` to `requirements.txt`
  - [ ] 2.2 Create `services/crypto.py` with `FieldCrypto` class
  - [ ] 2.3 Add `FIELD_ENCRYPTION_KEY` to `config.py` and `.env.example`
  - [ ] 2.4 Wire `crypto.encrypt/decrypt` into `firestore/hr_employees.py` (and contracts)
  - [ ] 2.5 Wire into `firestore/payroll.py` payslips
  - [ ] 2.6 Wire into `firestore/users.py` for totp_secret/api_keys
  - [ ] 2.7 Wire into `firestore/iraq_payments.py` for api_secret
  - [ ] 2.8 Create `scripts/migrate_pii_encryption.py` with `--dry-run` and `--apply`
  - [ ] 2.9 Write `tests/test_field_encryption.py`

- [ ] 3. GDPR endpoints
  - [ ] 3.1 Implement `GET /api/privacy/export` (JSON streaming)
  - [ ] 3.2 Implement `POST /api/privacy/delete` with confirmation body
  - [ ] 3.3 Add APScheduler job `gdpr_hard_delete_grace` daily 03:00
  - [ ] 3.4 Anonymize `audit_logs` user fields on hard-delete
  - [ ] 3.5 Frontend `pages/settings/PrivacyPage.tsx`
  - [ ] 3.6 Write `tests/test_gdpr.py`

- [ ] 4. Audit log immutability
  - [ ] 4.1 Update `firestore.rules` to deny update/delete on `audit_logs`
  - [ ] 4.2 Implement hash chain in `middleware/audit.py`
  - [ ] 4.3 Add `GET /api/audit/integrity-check`
  - [ ] 4.4 Add sensitive-GET logging for allowlisted paths
  - [ ] 4.5 Write `tests/test_audit_immutability.py`

- [ ] 5. Password policy + 2FA
  - [ ] 5.1 Add `services/password_policy.py` strength check
  - [ ] 5.2 Wire into `auth.register`, `auth.reset_password`, `auth.change_password`
  - [ ] 5.3 Bundle top-1000 common passwords list at `services/_common_passwords.txt`
  - [ ] 5.4 Add 2FA mandatory check for admin/owner login
  - [ ] 5.5 Write `tests/test_password_policy.py`

- [ ] 6. Headers + CORS
  - [ ] 6.1 Add HSTS to `main.py` security headers
  - [ ] 6.2 Tighten `CORS_ORIGINS` validation in `config.py`
  - [ ] 6.3 Add CSP report-only header
  - [ ] 6.4 Write `tests/test_security_headers.py` extension for HSTS
