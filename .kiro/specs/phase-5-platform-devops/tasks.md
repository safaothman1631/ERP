# Tasks: Phase 5

- [ ] 1. ChatterWidget integration
  - [ ] 1.1 Create `components/chatter/ChatterWidget.tsx` + sub-components (MessageList, ActivityList, AttachmentList, FollowerList)
  - [ ] 1.2 Add to Invoice detail
  - [ ] 1.3 Add to Bill detail
  - [ ] 1.4 Add to Quote/SO/PO forms
  - [ ] 1.5 Add to Contact detail
  - [ ] 1.6 Add to CRM Lead detail
  - [ ] 1.7 Add to HR Employee detail
  - [ ] 1.8 @-mention resolver
  - [ ] 1.9 Tests `e2e/chatter.spec.ts`

- [ ] 2. React Query migration
  - [ ] 2.1 Create `api/queries/` directory with key factories per domain
  - [ ] 2.2 Migrate Invoices list
  - [ ] 2.3 Migrate Bills list
  - [ ] 2.4 Migrate Contacts list
  - [ ] 2.5 Migrate Items list
  - [ ] 2.6 Migrate Quotes/SOs/POs/CN/VC lists
  - [ ] 2.7 Migrate Banking pages
  - [ ] 2.8 Migrate Payments lists
  - [ ] 2.9 Migrate CRM, HR, Payroll, POS Orders lists
  - [ ] 2.10 Migrate Reports + Custom Reports lists
  - [ ] 2.11 Migrate MO and Subscription lists
  - [ ] 2.12 Migrate Helpdesk tickets
  - [ ] 2.13 Update Vitest tests to mock React Query hooks

- [ ] 3. DevOps D1–D10
  - [ ] 3.1 Unify region me-central1 in deploy/firebase/vercel
  - [ ] 3.2 Add `needs: [ci, quality]` to deploy workflow
  - [ ] 3.3 Add full env-vars list to deploy workflow
  - [ ] 3.4 Dockerfile HEALTHCHECK
  - [ ] 3.5 Sentry SDK + DSN config
  - [ ] 3.6 Structured JSON logging (python-json-logger)
  - [ ] 3.7 Firestore rules/indexes deploy workflow
  - [ ] 3.8 Redis rate-limiter fallback
  - [ ] 3.9 Backup metrics + Cloud Monitoring alerts
  - [ ] 3.10 DISASTER_RECOVERY.md

- [ ] 4. Performance + caching
  - [ ] 4.1 `services/reports_cache.py`
  - [ ] 4.2 Apply caching to top 5 heavy reports
  - [ ] 4.3 `prometheus_client` metrics endpoint
  - [ ] 4.4 Latency p95 verification script

- [ ] 5. Idempotency middleware (carry-over from Phase 4)
  - [ ] 5.1 `middleware/idempotency.py`
  - [ ] 5.2 Tests
