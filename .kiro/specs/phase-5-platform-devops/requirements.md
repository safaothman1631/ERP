# Requirements Document: Phase 5 — Platform UX + DevOps

## Introduction

The platform features (Universal Chatter on records, automated actions, multi-company switcher) and DevOps hygiene (CI gating deploy, monitoring, structured logs, backup verification) are the last barriers to safe production operation. This phase delivers chatter integration on the top 8 record types, React Query migration for the 20 highest-traffic list pages, the DevOps D1–D10 checklist, and a verified disaster-recovery runbook.

---

## Glossary

- **ChatterWidget**: A reusable React component that renders the message thread, attachments, activities, and follower list for any record.
- **mail.thread mixin**: A repository mixin that adds chatter capabilities to any document.
- **Automated action**: A trigger-based workflow (on create/update/timing) that performs server-side actions (send email, update field, call webhook).
- **Structured logging**: JSON-formatted logs with consistent fields (`request_id`, `user_id`, `org_id`, `path`, `latency_ms`).
- **DR runbook**: Step-by-step recovery procedure for restoring service from backup.

---

## Requirements

### Requirement 1: Universal Chatter Integration

1. THE Frontend SHALL embed `ChatterWidget` on the detail page of every record type in: Invoices, Bills, Quotes, Sales Orders, Purchase Orders, Contacts, CRM Leads, HR Employees.
2. THE ChatterWidget SHALL show: message thread (chronological), file attachments, activities (due/done), followers, scheduled activities.
3. WHEN a user posts a message, THE Backend SHALL: persist via `/api/chatter/{entity_type}/{entity_id}/messages`, send email to followers (per their notification prefs), update `updated_at` on the record.
4. THE ChatterWidget SHALL support @-mentions resolved against active org users; mentioned users are auto-followed and notified.

### Requirement 2: React Query Migration

1. THE top 20 list pages (Invoices, Bills, Contacts, Items, Quotes, SOs, POs, Banking, Banking Reconciliation, Payments Received, Payments Made, CRM Leads, HR Employees, Payroll Runs, POS Orders, Reports list, Custom Reports list, Manufacturing Orders, Subscriptions, Helpdesk Tickets) SHALL use TanStack React Query for server state.
2. EACH list query SHALL define a stable cache key including filters and pagination.
3. EACH mutation SHALL invalidate the relevant query keys; optimistic updates allowed for create/edit but not delete.
4. WHEN a list page is open and the user navigates away/back within 30 seconds, THE list SHALL render from cache without re-fetching unless explicitly refreshed.

### Requirement 3: DevOps D1–D10

1. THE Cloud Run region SHALL be unified to `me-central1` (closer to Iraq) across `DEPLOY.md`, `deploy-cloudrun.yml`, `firebase.json`, `vercel.json` (D1).
2. THE deploy workflow SHALL declare `needs: [ci, ci-quality]` (D2).
3. THE deploy workflow SHALL include all required env vars: `DATABASE_URL=firestore://`, `FIREBASE_PROJECT_ID`, `GCP_PROJECT`, `ALLOWED_ORIGINS`, `ENVIRONMENT`, `APP_NAME`, `CORS_ORIGINS`, plus the existing `SECRET_KEY` from Secret Manager (D3).
4. THE root `Dockerfile` SHALL declare a `HEALTHCHECK` instruction that hits `/api/health` (D4).
5. THE Backend SHALL include Sentry SDK initialized in `main.py` with DSN from env; `SENTRY_DSN` opt-out via empty string (D5).
6. THE Backend logging SHALL be structured JSON via `python-json-logger`; default level INFO; INFO+ logs include `request_id` from `X-Request-Id` header or generated UUID (D6).
7. THE Firestore rules and indexes SHALL be deployed via a new GitHub Action `deploy-firestore.yml` triggered on changes to `firestore.rules` or `firestore.indexes.json` (D7).
8. THE rate limiter SHALL use Redis (Cloud Memorystore or Upstash) when `REDIS_URL` env is set; fall back to in-memory in dev (D8).
9. THE backup job SHALL emit metrics on success/failure to Cloud Monitoring; alerting rules SHALL fire if no successful backup in 24 hours (D9).
10. THE repo SHALL include `DISASTER_RECOVERY.md` with: how to restore from a Firestore backup, how to roll back a Cloud Run revision, how to rotate compromised secrets (D10).

### Requirement 4: Performance + Caching

1. THE list endpoints (`/api/invoices`, `/api/bills`, `/api/contacts`, `/api/journals`) SHALL respond p95 < 300ms for orgs ≤ 10,000 records.
2. THE reports endpoints SHALL cache results in Firestore `reports_cache` collection with 5-minute TTL by default; cache key includes filters.
3. THE Backend SHALL emit `prometheus`-compatible metrics on `/api/metrics` for: request count by route, latency histogram, error count by status.

### Requirement 5: Tests

1. New test files: `tests/test_idempotency.py`, `tests/test_chatter_integration.py`, `tests/test_metrics.py`.
2. New Playwright spec: `e2e/chatter.spec.ts` posting a message on an invoice.
3. CI workflow `ci.yml` SHALL block deploy on test failure.

---

## Out of Scope

- Full Odoo automated-actions engine (server actions, scheduled UI) — partial only
- React Server Components migration — defer
- Move from Firestore to PostgreSQL — out of scope

## Definition of Done

- Chatter posts work on Invoice, Bill, Contact, CRM Lead, HR Employee
- 20 list pages use React Query
- Deploy gated on CI; region unified to me-central1
- Sentry receives a test error
- Structured JSON logs visible in Cloud Logging
- DISASTER_RECOVERY.md committed
- Lighthouse a11y >= 95; performance p95 budget met
