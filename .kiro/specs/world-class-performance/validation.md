# Validation Document: How We Prove World-Class

> **Spec ID:** `world-class-performance`
> **Companion to:** `requirements.md`, `design.md`, `tasks.md`, `EXECUTION-REPORT.md`
> **Status:** Draft v1.0
> **Owner:** Safa Othman
> **Reframe:** *Code is necessary. Telemetry is sufficient.*

---

## Introduction

The previous documents define what to build (`requirements.md`), how to build it (`design.md`), and when to build it (`tasks.md`). This document defines **how we know it worked.**

The honest position: **building the apparatus does not prove world-class.** A system is world-class when, under real traffic, on real devices, for real weeks, the numbers stay green and the team can ship features without fear. We do not assert that today. We assert that we have built the *measurement apparatus* and the *gates* — and this document defines the path from "instrumented" to "proven."

Two questions determine whether we are world-class:

1. **Production Reality** — under real traffic, what does the system actually do?
2. **Long-term Maintainability** — six months from now, can the team move fast without breaking things?

Each is broken into measurable sub-questions with explicit thresholds, data sources, alerting policy, and review cadence.

---

## Part 1 — Production Reality Validation

We declare a metric "proven" when:

- It is being **continuously measured** from real traffic (not synthetic stand-ins for production data).
- It has held the SLO target across a **28-day rolling window** at p75 (CWV) or p95 (API).
- The **alerting** for that metric has fired and resolved at least once (proving the alert path works).
- A **runbook** exists for the alert, and someone has rehearsed it.

### V-PR.1 — Real User p95 Latency

| Aspect | Value |
|--------|-------|
| **What** | API p95 by endpoint class (read-single / read-list / write / bulk / report / POS-checkout) |
| **Source** | OpenTelemetry spans → Cloud Trace → `vitals_raw` rollup |
| **Threshold** | Per Requirements §5 SLO table |
| **Sampling** | 100% of traces for the top-20 endpoints; 10% otherwise |
| **Alert** | p95 > 2× SLO for 15 min → SEV2; p95 > 5× SLO for 5 min → SEV1 |
| **Runbook** | `docs/runbooks/slow-firestore-read.md`, `cold-start-spike.md` |
| **Proof gate** | Green for 28 consecutive days |

### V-PR.2 — Core Web Vitals p75

| Aspect | Value |
|--------|-------|
| **What** | LCP / INP / CLS / TTFB / FCP at p75 by device class (mobile-low / mobile-mid / mobile-high / tablet / desktop) and network (slow-2g / 3g / 4g / wifi) |
| **Source** | `web-vitals` library → `/api/rum/vitals` → BigQuery |
| **Threshold** | LCP ≤ 2000ms 4G Android, ≤ 2500ms 3G, ≤ 1500ms desktop (per R1.1); INP ≤ 150ms; CLS ≤ 0.05 |
| **Sampling** | 100% of first sessions per device; 10% thereafter |
| **Alert** | p75 over budget for any device class for 24h → SEV3 |
| **Runbook** | `docs/runbooks/cwv-regression.md` |
| **Proof gate** | Green for 28 consecutive days at p75 across all device classes |

### V-PR.3 — Crash-Free Session Rate

| Aspect | Value |
|--------|-------|
| **What** | Percentage of user sessions that experienced no unhandled error (frontend or backend 5xx) |
| **Source** | Sentry session tracking (frontend) + 5xx counter (backend) |
| **Threshold** | ≥ 99.5% sessions crash-free at the user level; ≥ 99.8% at the request level |
| **Alert** | Crash-free rate < 99.0% for 1h → SEV1 |
| **Runbook** | `docs/runbooks/chunk-load-failure.md`, Sentry triage SOP |
| **Proof gate** | ≥ 99.5% for 28 consecutive days |

### V-PR.4 — Offline POS Sync Success Rate

| Aspect | Value |
|--------|-------|
| **What** | Of orders submitted while offline, % that successfully synced within 5 minutes of reconnect |
| **Source** | Per-device heartbeat to `/api/health/offline-sync` reporting `{queued_count, synced_count, failed_count, oldest_queued_age_sec}` |
| **Threshold** | ≥ 99.9% sync success; oldest queued age ≤ 24h at p99 |
| **Alert** | Sync success < 99.5% for any tenant for 24h → SEV2; queued age > 48h on any device → SEV1 |
| **Runbook** | `docs/runbooks/pos-offline-drill.md` |
| **Proof gate** | ≥ 99.9% sync success across all tenants for 28 days; controlled 24-hour drill passes with zero data loss |

### V-PR.5 — Receipt-Print Latency

| Aspect | Value |
|--------|-------|
| **What** | Tap-to-printer-buffer-write latency at p95 on real devices |
| **Source** | `performance.mark('pos:print:start')` / `'pos:print:end'` → RUM ingest with device class |
| **Threshold** | p95 ≤ 200ms (Requirements R4.7) |
| **Alert** | p95 > 400ms for 1h → SEV3 |
| **Runbook** | Print-path triage SOP (TODO — see Tasks T-V.5) |
| **Proof gate** | p95 ≤ 200ms for 14 consecutive days across the deployed tablet fleet |

### V-PR.6 — Availability (Monthly Error Budget)

| Aspect | Value |
|--------|-------|
| **What** | Successful-request rate over a calendar month |
| **Source** | Cloud Load Balancer + Cloud Run logs |
| **Threshold** | ≥ 99.5% (= 3.6 hours of downtime budget per month) |
| **Burn-rate alerts** | 2x burn for 1h → SEV2; 10x burn for 5 min → SEV1 |
| **Runbook** | `DISASTER_RECOVERY.md` + incident-response SOP |
| **Proof gate** | Three consecutive months ≥ 99.5%; one quarterly DR drill passed |

### V-PR.7 — Cold-Start p95

| Aspect | Value |
|--------|-------|
| **What** | Cloud Run cold-start time at p95 |
| **Source** | Cloud Run metrics + OTel span on the lifespan startup |
| **Threshold** | ≤ 2s with min-instances=1 (R5.6) |
| **Alert** | p95 > 4s for 1h → SEV3 |
| **Runbook** | `docs/runbooks/cold-start-spike.md` |
| **Proof gate** | p95 ≤ 2s for 14 days |

### V-PR.8 — Cache Hit Ratio

| Aspect | Value |
|--------|-------|
| **What** | Redis cache hit ratio for Class-C/D endpoints |
| **Source** | `redis_cache_hits_total` / `(hits + misses)` |
| **Threshold** | ≥ 60% in steady state (Tasks §T-4.1 acceptance) |
| **Alert** | Hit ratio < 40% for 4h → SEV3 (cache likely cold, stampede, or invalidation bug) |
| **Runbook** | `docs/runbooks/redis-down.md` |
| **Proof gate** | ≥ 60% for 14 days |

### V-PR.9 — Bundle Size at Production

| Aspect | Value |
|--------|-------|
| **What** | Actual served bundle size at the CDN edge for the app shell |
| **Source** | Synthetic probe `curl -H 'Accept-Encoding: gzip' <shell-url>` |
| **Threshold** | ≤ 350 KB gzipped for shell, ≤ 80 KB per route chunk (R1.5) |
| **Alert** | Shell > 380 KB after deploy → block traffic-shift |
| **Runbook** | `docs/runbooks/bundle-bloat.md` (TODO — see T-V.9) |
| **Proof gate** | Three consecutive deploys ship a shell ≤ 350 KB |

### V-PR.10 — Chunk-Load Failure Rate

| Aspect | Value |
|--------|-------|
| **What** | Lazy-loaded chunks that fail to load after all retries |
| **Source** | Sentry events tagged `kind=chunk-load-failure` |
| **Threshold** | < 0.5% of sessions experience a chunk-load failure |
| **Alert** | > 1% for 1h → SEV2 (typically CDN issue or stale cache) |
| **Runbook** | `docs/runbooks/chunk-load-failure.md` |
| **Proof gate** | < 0.5% for 28 days |

### V-PR.11 — Firestore Read p99

| Aspect | Value |
|--------|-------|
| **What** | Firestore read latency at p99 |
| **Source** | OTel spans on the Firestore wrapper |
| **Threshold** | ≤ 400ms (Requirements R5.8) |
| **Alert** | p99 > 1s for 30 min → SEV2 |
| **Runbook** | `docs/runbooks/slow-firestore-read.md` |
| **Proof gate** | p99 ≤ 400ms for 28 days |

### V-PR.12 — Backup Freshness

| Aspect | Value |
|--------|-------|
| **What** | Time since last verified Firestore backup |
| **Source** | `backup-verify.yml` workflow + scheduled job |
| **Threshold** | ≤ 24h between successful backups |
| **Alert** | No successful backup in 24h → SEV1 |
| **Runbook** | `DISASTER_RECOVERY.md` §3 |
| **Proof gate** | 90 consecutive days without a missed backup |

---

## Part 2 — Long-term Maintainability Validation

A codebase is maintainable if **a new contributor can ship a feature on day one**, and if **the second derivative of complexity is zero or negative**. We turn that into measurable gates.

### V-LM.1 — File Size Budget

| Aspect | Value |
|--------|-------|
| **What** | Lines of code per file |
| **Source** | `scripts/audit-loc.mjs` |
| **Threshold** | ≤ 400 LOC (advisory); ≤ 600 LOC (hard limit, fails CI without `// monolith-budget-exempt: <ADR>`) |
| **Today's state** | 22 files > 600 LOC, worst: `bodies.tsx` (4,605) and `pos.py` (3,778) |
| **Proof gate** | Top-10 monoliths decomposed; CI gate flipped to blocking |
| **Review cadence** | Weekly |

### V-LM.2 — Cyclomatic Complexity Cap

| Aspect | Value |
|--------|-------|
| **What** | Cyclomatic complexity per function |
| **Source** | ESLint `complexity` rule (frontend), `radon cc` (backend) |
| **Threshold** | ≤ 15 per function (Sonar's recommended) |
| **Alert** | Lint error on > 15; lint warning on > 10 |
| **Proof gate** | < 5 functions in the whole codebase exceed 10 |
| **Review cadence** | Per-PR + monthly trend |

### V-LM.3 — Cognitive Complexity Cap

| Aspect | Value |
|--------|-------|
| **What** | Cognitive complexity (Sonar's metric — how hard a human finds it to read) |
| **Source** | `eslint-plugin-sonarjs` rule `cognitive-complexity` |
| **Threshold** | ≤ 15 per function |
| **Alert** | Lint warning on > 15 |
| **Proof gate** | < 10 functions exceed 15 |
| **Review cadence** | Per-PR |

### V-LM.4 — Dead Code Rate

| Aspect | Value |
|--------|-------|
| **What** | Exported symbols never imported, files never reached from an entry point |
| **Source** | `ts-prune` (frontend) + `vulture` (backend) + `knip` for full unused exports |
| **Threshold** | < 0.5% of exports are dead |
| **Alert** | Weekly report flags growth > 0.2% week-over-week |
| **Proof gate** | < 0.5% sustained for 60 days |
| **Review cadence** | Weekly |

### V-LM.5 — Dependency Freshness

| Aspect | Value |
|--------|-------|
| **What** | Age of every dependency relative to its latest stable release |
| **Source** | `npm-check-updates` (frontend) + `pip list --outdated` (backend) + GitHub's Dependabot |
| **Threshold** | No dep > 12 months behind latest stable on a non-major; no critical CVE > 7 days unpatched |
| **Alert** | Weekly report; CVE alert on detection |
| **Proof gate** | Median dep age < 6 months; zero unpatched CVEs > 7 days |
| **Review cadence** | Weekly |

### V-LM.6 — Test Coverage

| Aspect | Value |
|--------|-------|
| **What** | Line + branch coverage |
| **Source** | c8 (Vitest) + coverage.py (pytest) |
| **Threshold** | ≥ 70% FE / ≥ 80% BE (Requirements R13.1) |
| **Alert** | Coverage drops > 2% in a PR → block |
| **Proof gate** | Thresholds met; CI gate flipped to blocking |
| **Review cadence** | Per-PR + monthly |

### V-LM.7 — Flaky Test Rate

| Aspect | Value |
|--------|-------|
| **What** | Tests that pass and fail across reruns of the same commit |
| **Source** | Last 100 CI runs analyzed by `scripts/flaky-test-tracker.mjs` |
| **Threshold** | < 1% of tests are flaky; no test fails > 5% of the time |
| **Alert** | New flake detected → quarantine + ticket |
| **Proof gate** | Flake rate < 1% for 60 days |
| **Review cadence** | Weekly |

### V-LM.8 — Bundle Size Delta per PR

| Aspect | Value |
|--------|-------|
| **What** | Gzip size delta of each chunk vs main |
| **Source** | `.github/workflows/bundle-diff.yml` |
| **Threshold** | +10 KB gzipped per chunk = advisory; +20 KB = block without `[allow-bundle-growth]` in commit |
| **Alert** | Sticky PR comment with the table |
| **Proof gate** | 90% of PRs land neutral or negative bundle delta |
| **Review cadence** | Per-PR |

### V-LM.9 — Onboarding Time

| Aspect | Value |
|--------|-------|
| **What** | Time from `git clone` to first PR merged for a new contributor |
| **Source** | Quarterly real-onboarding exercise |
| **Threshold** | ≤ 1 working day (Requirements R14.3) |
| **Alert** | If > 2 days, file a ticket against `docs/onboarding/` |
| **Proof gate** | Four consecutive quarters with onboarding ≤ 1 day |
| **Review cadence** | Quarterly |

### V-LM.10 — Feature Velocity

| Aspect | Value |
|--------|-------|
| **What** | PRs merged per week, time-to-merge p50/p95 |
| **Source** | GitHub API → `scripts/velocity-report.mjs` weekly |
| **Threshold** | Velocity trend not declining > 20% quarter-over-quarter; time-to-merge p95 < 5 working days |
| **Alert** | Quarterly review |
| **Proof gate** | Two consecutive quarters with stable or improving velocity |
| **Review cadence** | Quarterly |

### V-LM.11 — Documentation Freshness

| Aspect | Value |
|--------|-------|
| **What** | Documentation files not touched in the last 90 days |
| **Source** | `scripts/doc-freshness.mjs` walks `docs/` and `.kiro/` |
| **Threshold** | < 20% of docs are > 90 days stale |
| **Alert** | Weekly report |
| **Proof gate** | < 20% stale for 90 days |
| **Review cadence** | Weekly |

### V-LM.12 — ADR Compliance

| Aspect | Value |
|--------|-------|
| **What** | Significant code changes that landed without an ADR |
| **Source** | `scripts/adr-compliance.mjs` flags PRs touching > 20 files or > 1000 LOC without `docs/adr/` change |
| **Threshold** | < 10% of "significant" PRs without an ADR |
| **Alert** | Sticky PR comment recommending an ADR |
| **Proof gate** | Last 30 significant PRs have ≥ 90% ADR coverage |
| **Review cadence** | Per-PR + quarterly |

---

## The Scorecard

A single page (`docs/world-class/scorecard.md`) is regenerated weekly by `scripts/world-class-scorecard.mjs`. It contains:

| Section | Format |
|---------|--------|
| **Production Reality** | 12-row table, one per V-PR.x metric, columns: target, current (28d), trend (vs last week), status (🟢/🟡/🔴), runbook link |
| **Long-term Maintainability** | 12-row table, one per V-LM.x metric, same columns |
| **Overall verdict** | "World-class" only if ≥ 22 of 24 are green AND none are red for > 14 days |
| **Top regressions** | Any metric that changed status in the last week, with attribution to the deploy/PR most likely responsible |
| **Open OQs** | Decisions still pending from `design.md` §12 |

The scorecard is posted to a sticky GitHub issue (`World-Class Scorecard — Week N`) updated weekly by the CI workflow. The team reviews it every Monday morning (15 min).

---

## Path to Proof — the 30 / 60 / 90 / 180 day plan

| Window | Milestone |
|--------|-----------|
| **Day 0–7** | All probes wired; scorecard generates with the right metric names but mostly "TBD" values for production-data fields. Baseline LOC, complexity, test coverage captured. |
| **Day 7–30** | Staging traffic + synthetic SLO probes generate real (if not real-user) numbers for V-PR.1, V-PR.7, V-PR.8, V-PR.11. All maintainability metrics (V-LM.1–12) green or trending right. |
| **Day 30–60** | Production rollout per phase plan. RUM begins reporting. First proof candidates: V-PR.2 (CWV), V-PR.3 (crash rate), V-PR.10 (chunk-load failure). |
| **Day 60–90** | First 28-day rolling window on production. Proof gates V-PR.2, V-PR.3, V-PR.6, V-PR.7, V-PR.10, V-PR.11, V-PR.12 evaluated. POS rollout begins on 3 pilot stores; V-PR.4, V-PR.5 start collecting. |
| **Day 90–180** | Full POS rollout across deployed fleet. V-PR.4 (24-hour offline drill), V-PR.5 (print latency) reach proof gates. Quarterly DR drill executed. First quarterly onboarding test (V-LM.9). |
| **Day 180+** | Scorecard read at 22/24 green → spec graduates. Any red metric becomes the seed for a follow-on spec. |

---

## Gates that block traffic-shift

Beyond observation, certain metrics are wired as **deploy gates** — if they're red, the blue/green deploy refuses to shift 100% traffic to the candidate revision:

1. Shell bundle size > 380 KB gz (V-PR.9).
2. Synthetic SLO probe shows p95 over budget on any Class-A endpoint during the 5-min soak.
3. Sentry release marker reports > 0.5% crash rate during soak.
4. CI's coverage gate failed.
5. CI's bundle-diff gate failed.
6. Async-safety linter reports a new violation.
7. Audit-loc reports a new file > 600 LOC without exempt marker.
8. `firestore.indexes.json` has a missing index for a query in the candidate code (Tasks T-4.6).

This list lives in `scripts/deploy-gates.sh` (called by `deploy-bluegreen.sh`).

---

## What "world-class" looks like operationally

When the scorecard is green and stays green:

- **For users:** the app feels instant, never crashes, prints receipts in under 200ms, keeps working through an outage, never asks them to refresh.
- **For developers:** a new joiner ships a PR on day one; the lint catches mistakes before review; the bundle size doesn't creep; the test suite tells the truth.
- **For operators:** every alert has a runbook; every runbook has been rehearsed; backups are verified; rollback is one command; SLO budgets give honest signal about whether to slow down or ship faster.

The gap between **instrumented** and **world-class** is closed by traffic + time + discipline. The instrumentation is in place; the gates are documented; the scorecard makes the truth visible. The next 180 days are about running the system and watching the scorecard.

---

## Tasks introduced by this validation document

| ID | Task | Status |
|----|------|--------|
| T-V.1 | Build `scripts/world-class-scorecard.mjs` | Pending |
| T-V.2 | Build `scripts/production-reality-probe.mjs` (synthetic SLO probe) | Pending |
| T-V.3 | Build `scripts/maintainability-report.mjs` (complexity + dead-code + freshness) | Pending |
| T-V.4 | Build `scripts/flaky-test-tracker.mjs` | Pending |
| T-V.5 | Build `scripts/velocity-report.mjs` (GitHub API → markdown) | Pending |
| T-V.6 | Build `scripts/doc-freshness.mjs` | Pending |
| T-V.7 | Build `scripts/adr-compliance.mjs` | Pending |
| T-V.8 | Wire `.github/workflows/weekly-health-check.yml` running every Monday 09:00 Baghdad time | Pending |
| T-V.9 | Sentry release auto-tagging on every deploy | Pending |
| T-V.10 | Per-device offline-sync heartbeat endpoint `/api/health/offline-sync` | Pending |
| T-V.11 | Cyclomatic complexity ESLint rule + radon CI step | Pending |
| T-V.12 | Initial baseline capture (today's numbers written to `audit/baselines/2026-Q2-scorecard.md`) | Pending |

These tasks are executed in parallel by the validation-framework agent(s).

---

## Closing position

The original spec gave us the **right things to build**. The execution gave us **the things built**. This validation document gives us **the proof that they work** — and the discipline to keep them working.

When the scorecard reads 22/24 green for 28 consecutive days, *and* the maintainability gates have held for two consecutive quarters, *then* we say "world-class" without flinching. Until then, we say "instrumented and validating."
