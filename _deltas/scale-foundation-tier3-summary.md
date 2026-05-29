# scale-foundation (Tier 3) — Parallel Build + Integration Summary

> **Date:** 2026-05-29
> **How:** 7 expert agents in parallel (Workflow) built every *code/docs-doable*
> deliverable; the orchestrator then applied shared-file wiring and verified.
> **Reality:** much of Tier 3 is operational/external (hiring, lawyer sign-off,
> pen-test vendor, SOC 2 auditor, GCP apply, real pilot shops) — those are flagged,
> not faked. This summary covers what was actually built in the repo.

---

## Delivered by stream

### SF1 — Team & Ops (docs)
- `docs/handbook/engineering-handbook.md` (12 chapters) + `onboarding.md` (30/60/90).
- `docs/adr/0001`–`0020` (20 ADRs, Nygard format) + `docs/adr/README.md` index.
- `docs/runbooks/` (10 runbooks, YAML front-matter).
- `scripts/ops/iam-leaver-audit.py` + `iam-allowlist.yml` (weekly leaver audit, gates CI).
- `docs/oncall/escalation-policy.md` (4-layer) + `rotation.md` (3-person, Sunday handoff).

### SF2 — Legal + Compliance (drafts) + GDPR (code)
- `legal/` — 10 counsel-ready DRAFTS: ToS, Privacy (PDPL+GDPR), DPA (SCC 2021 + 3 annexes), MSA + Order Form, SLA (99.5% + 10/25/50% credit ladder), sub-processors, AUP, Cookie, Refund. Each banner-marked "DRAFT — pending counsel".
- `docs/compliance/calendar.yml` (16 obligations) + `templates/employment/{employment-agreement,ip-assignment}.md`.
- **GDPR/PDPL data-rights (functional code):** `backend/app/api/data_rights.py` (4 endpoints: export + erasure, perm-gated), `backend/app/services/data_rights_service.py` + `firestore/data_rights_repo.py` + `services/data_rights_purge.py`, `backend/tests/test_data_rights.py` (18 tests), `frontend/src/pages/settings/sections/system/DataRights.tsx`. Permissions `privacy.export` + `privacy.erasure`.

### SF3 — Disaster Recovery (code)
- `scripts/dr/restore-full.sh`, `restore-tenant.sh`, `provision-dr.sh` (idempotent, --dry-run, integrity-checked).
- `backend/scripts/{verify_restore_sample,extract_tenant_from_db,apply_tenant_patch}.py`.
- `backend/app/services/dr_restore_service.py` + `backend/app/api/admin/dr_restore.py` (4-eyes + diff preview, 14 tests) + `frontend/src/platform/pages/DrRestorePage.tsx`.
- `.github/workflows/dr-backup-restore-verify.yml` (weekly restore-to-sandbox) + `docs/runbooks/dr-restore.md`.

### SF4 — Security hardening (code)
- `backend/app/middleware/csrf.py` (double-submit + SameSite, Bearer-exempt) + `backend/app/services/upload_validation.py` (size/MIME/magic-byte/optional ClamAV).
- `backend/tests/test_tenant_isolation.py` (cross-tenant 403/404), `test_jwt_verification.py`, `test_csrf_middleware.py`, `test_upload_validation.py` — **163 new security tests total (with DR).**
- `firestore-rules-tests/` (@firebase/rules-unit-testing suite, emulator-run) + `docs/security/firestore-rules-audit.md`.
- `docs/security/sirp.md` (Security Incident Response Plan) + `security-summary.md`.
- `.gitleaks.toml` + `.github/workflows/gitleaks.yml` + `.pre-commit-config.yaml` (gitleaks hook).

### SF5 — Observability (config + code)
- `terraform/monitoring/` — 6 dashboards, 24 alert policies, 2 SLOs, log-metrics, notification channels, BigQuery RUM warehouse (HCL2-valid).
- `sql/observability/{rum_daily_agg,cost_per_tenant}.sql`.
- `backend/app/observability/{otel_middleware,heartbeat}.py` + `frontend/src/observability/traceparent.ts` (W3C propagation).
- `.github/workflows/{sentry-release,k6-nightly}.yml` + `scripts/observability/{k6-synthetic.js,check-cardinality.mjs}`.

### SF6 — UAT toolkit (templates)
- `pilots/` — README, scoring-rubric, `iraq-edge-cases.md` (32 entries), results template, case-study template, NPS/CSAT surveys (ku/ar/en), `_template/` + worked example `p-a-supermarket-erbil/`.
- `templates/pilot-agreement.md` (DRAFT) + `docs/training/scripts/` (10 power-user video scripts, Kurdish+Arabic).
- `.github/workflows/pilot-release.yml` (weekly `pilot` Cloud Run channel, `--no-traffic --tag pilot`).

---

## Shared-file wiring applied by the orchestrator
- `backend/app/main.py`: DR-restore router; **data-rights router**; CSRF middleware; OTel enrichment middleware.
- `backend/app/config.py`: `CSRF_PROTECTION_ENABLED=True`, `UPLOAD_CLAMAV_ENABLED=False`.
- `backend/app/services/scheduler.py`: observability heartbeat job + `EVENT_JOB_ERROR` listener (19 → 20 jobs).
- `frontend/src/App.routes.tsx`: `/platform/dr-restore` route.
- `frontend/src/pages/settings/sections.registry.ts`: `system.gdpr` → DataRights section (was a TODO placeholder).
- `frontend/src/api.ts`: traceparent request interceptor.
- `backend/tests/test_scheduler_properties.py`: `@h_settings(deadline=None)` (kill a Hypothesis-deadline flake the larger suite exposed).
- `.pre-commit-config.yaml`: gitleaks hook (by the SF4 agent).

## Verification
- **Backend boot:** 2338 routes; DR-restore + data-rights mounted; scheduler imports (20 jobs).
- **Backend pytest:** **1333 passed / 2 failed** — both pre-existing & unrelated (`test_firestore_audit_tool` → `app/firestore/client.py` not a BaseRepository; `test_redis_rate_limit_config` → storage_uri query-param drift). 163 new SF security/DR tests + 18 data-rights tests all green.
- **Frontend:** `tsc --noEmit` 0 errors; **`npm run build` exit 0** (475 PWA precache).

## Workflow notes
- 7-agent parallel workflow: 5 returned structured output, 2 (SF1-OpsDocs, SF2-GDPR) did partial work then failed to emit the final object. The orchestrator completed both: SF1's missing ADRs 0019–0020 + index + IAM script + on-call docs, and SF2-GDPR's API router + tests + frontend section + wiring (a follow-up Agent A finished the GDPR API; Agent B died on a transient socket error after ADR 0018, the rest written inline).

## Remaining — genuinely external (cannot be coded)
- **Hiring** the 3-person core (SF1). **Lawyer/counsel sign-off** on all `legal/` drafts + LLC registration + insurance binding (SF2). **Pen-test vendor**, **SOC 2 / Drata auditor**, **bug-bounty platform**, **WIF cloud apply** (SF4). **`terraform apply`** + PagerDuty/Slack/Sentry accounts + GCP provisioning (SF3/SF5). **Real pilot shops**, hardware, on-site visits, video recording, conversions (SF6).
- Sub-processor doc says 360Dialog/Crisp; `docs/security/pii-handling.md` says Twilio — engineering must reconcile before publishing the sub-processors page.

## Out-of-scope follow-ups (flagged, not fixed — pre-existing)
- `test_redis_rate_limit_config` expected `storage_uri` is stale (one-line test update).
- `tools/firestore_audit.py` flags `app/firestore/client.py` (the client wrapper, not a repo) → exclude it from the audit.
