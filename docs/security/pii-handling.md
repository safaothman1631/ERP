# PII Handling Policy

> **Spec ref:** requirements.md §7.7 (R7.7), design.md §5.4
> **Owner:** Security lead + Tech lead
> **Last reviewed:** 2026-05-27

This policy defines how Personally Identifiable Information (PII) is classified, stored, exported, deleted, and audited inside the Zoho Kurdish ERP — aligned to the Iraqi Personal Data Protection Law (PDPL) baseline and the EU GDPR equivalence we target for export customers.

## 1. Data classification

| Tier | Examples | Storage rules | Audit |
|---|---|---|---|
| **P0 — Secret / Authentication** | Passwords, OAuth refresh tokens, MFA TOTP seeds, session JWTs, payment card PAN. | Never stored in plaintext. Passwords are Argon2id-hashed; OAuth tokens encrypted at rest with the field-encryption KEK; PAN is **never** stored — we only keep the last 4 digits and a vault token from the payment processor. | Every write logged in `audit_log` with `category=auth`; reads logged on admin-impersonate or break-glass only. |
| **P1 — Direct identifiers** | Email address, phone number, full name, national ID, IBAN, residential address, GPS location. | Encrypted at rest at the Firestore field level via the envelope key `FIRESTORE_FIELD_ENCRYPTION_KEY`. Transmitted only over TLS 1.2+. Display in the UI gated by RBAC. | Every read and write logged in `audit_log` with `category=pii`, including the `requestId` of the originating API call. |
| **P2 — Usage / behavioural** | Last-login timestamp, IP address, user-agent, route navigation history, RUM Web Vitals. | Stored hashed where possible (IP → SHA-256(IP + per-tenant salt)). Retained 90 days raw, then rolled up to anonymous aggregates. | Aggregate access logged; individual reads not logged unless via admin query. |
| **P3 — Business operational** | Invoice line totals, inventory levels, project names. | Standard tenant-scoped Firestore storage. | Standard CRUD audit; no special PII flag. |

The classification is enforced in code by the `Pii` decorator on Pydantic models that mark fields as P0/P1/P2. The audit middleware reads these markers and emits the correct `category`.

## 2. Lawful basis for processing

Per PDPL Art. 6 / GDPR Art. 6 equivalents:

* **Contract performance** for primary user data (employee + customer records inside a tenant). Captured on tenant onboarding via the Terms of Service click-through.
* **Legitimate interest** for usage telemetry (RUM, anonymised). Documented in the privacy policy linked from the login page.
* **Consent** for marketing opt-ins (WhatsApp + email blasts via the `engagement` module). Captured per-contact via the `marketing_consent` boolean with timestamp.

Consent is revocable via `/api/admin/marketing-consent/{contact_id}` and via the per-contact UI toggle.

## 3. Export — Right to Data Portability (PDPL Art. 19 / GDPR Art. 20)

Tenant admins can export the complete dataset for any user the tenant
holds data on (typically an employee or a contact).

* **Endpoint:** `GET /api/privacy/data-export/contact/{contact_id}` (existing) — returns the contact record plus all related invoices and bills as JSON.
* **Endpoint:** `GET /api/admin/export?tenant_id=...` (designed in §5.4, implemented under T-6.4) — returns a ZIP of all per-tenant docs as JSON. Streamed, signed-URL link emailed to the admin so we do not buffer in memory.
* **Format:** JSON (machine-readable). UTF-8. Date fields are ISO 8601 with timezone.
* **Latency target:** 24 hours from request to download link. Logged in `audit_log` with `category=export, actor=<admin user id>`.

## 4. Deletion — Right to Erasure (PDPL Art. 20 / GDPR Art. 17)

We implement deletion as a **30-day soft-delete window** followed by hard delete.

### 4.1 Soft delete

* **Endpoint:** `POST /api/admin/delete?tenant_id=...` (or `/api/privacy/user-deletion` for a single user) — sets `deleted_at = now()` on every relevant doc.
* During the 30-day grace, the data is hidden from all queries (Firestore rules + repository-layer filter on `deleted_at == null`) but can be restored by Support if the user changes their mind.
* The audit log is **retained** across the grace; only after hard delete is it cropped.

### 4.2 Hard delete

* An APScheduler job (`hard_delete_sweeper`) runs nightly. Every doc with `deleted_at < now() - 30 days` is:
  1. PII fields scrubbed (replaced with `[REDACTED]`).
  2. Audit-log entries older than 7 years (Iraqi commercial record requirement) are also redacted; newer ones are kept for legal compliance with PII set to `null`.
  3. The "deletion certificate" — a hash of (tenant_id, user_id, deleted_at, hard_deleted_at) — is written to `tenants/{tid}/deletion_certificates/{cert_id}`. This is the receipt we hand to the user.
* Backups are *not* re-encrypted on each deletion. Per PDPL guidance, we declare in the privacy policy that "data in backups is overwritten on the normal 90-day backup rotation; restoration of a deleted-then-restored backup will re-instate then re-delete."

### 4.3 Cancellation / out

The user can withdraw a deletion request inside the 30-day window by emailing `privacy@zoho.kurd.iq`. Support runs the un-delete tool (`scripts/undelete.sh --tenant <tid> --user <uid>`), which removes `deleted_at` and logs the reversal.

## 5. Tenant isolation

PII never crosses a tenant boundary. The Firestore rules (`firestore.rules`) deny any read/write that does not satisfy `request.auth.token.tenant_id == tenantId`. The backend's `tenant_dep` injects `tenant_id` from the JWT — never from a query param — into every repository call.

Cross-tenant requests are flagged as `category=security` and trigger a SEV-2 alert.

## 6. Vendor sub-processors

| Sub-processor | Data category | Region | DPA on file |
|---|---|---|---|
| Google Cloud (Firestore, Cloud Run, GCS) | P0/P1/P2/P3 | me-central1 (Doha) | Yes — Google Cloud Data Processing Addendum. |
| Vercel | P3 (HTML + static assets only; no PII at rest) | EU + global edge | Yes — Vercel DPA. |
| Sentry | Error stack traces (incidental P1 in user input) | EU (frankfurt) | Yes; PII scrubber enabled. |
| AsiaCell / ZainCash / FastPay | P1 (phone), P0 (payment tokens) | Iraq | Provider TOS; verified PDPL-aligned. |
| Twilio (WhatsApp transport) | P1 (phone) | EU | Yes — Twilio DPA. |

Adding a new sub-processor requires Security lead sign-off and a DPA review **before** any traffic flows.

## 7. PDPL / GDPR alignment

| Requirement | How we meet it |
|---|---|
| PDPL Art. 7 — explicit consent for sensitive data | Captured at signup; revocable; logged. |
| PDPL Art. 12 — data minimisation | Pydantic models reject unknown fields (`extra='ignore'`); only the fields needed for a business purpose are stored. |
| PDPL Art. 14 — security of processing | Field-level encryption (P1), TLS 1.2+ in transit, RBAC, audit log. |
| PDPL Art. 19 — portability | Section 3. |
| PDPL Art. 20 — erasure | Section 4. |
| PDPL Art. 24 — breach notification | Incident runbook (`audit/incidents/`) requires Security lead to notify the Iraqi Data Protection Office within 72 hours of confirmed breach involving > 100 records. |
| GDPR Art. 30 — record of processing activities | This document + the per-module README in `docs/sections/`. |

## 8. Implementation checkpoints

* **P4 delivered:** `/api/privacy/data-export/contact/*`, `/api/privacy/user-deletion`, `request_user_deletion()` with 30-day grace, audit-chain verifier (`verify_audit_chain`).
* **P6 delivers:** `/api/admin/export?tenant_id=...` (zip-of-tenant), `/api/admin/delete?tenant_id=...` (tenant-wide soft delete).
* **Pending (next spec):** automated anonymisation of P1 fields in cold-storage backups older than 7 years.

## 9. Owners

* **Privacy point-of-contact (publicly listed):** `privacy@zoho.kurd.iq`
* **Internal owner:** Security lead
* **Backup owner:** Tech lead
* **Regulator contact (Iraq):** files in `audit/regulators/iq-pdpa/`
