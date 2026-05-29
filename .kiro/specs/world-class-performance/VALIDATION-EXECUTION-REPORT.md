# Validation Framework — Execution Report

> **Date executed:** 2026-05-27
> **Companion to:** `validation.md`, `EXECUTION-REPORT.md`
> **Status:** ✅ Apparatus complete + baseline captured. 🔴 NOT YET world-class — and now we know exactly why.

---

## Honest answer to "is it world-class yet?"

**No.** Verdict from today's scorecard: **4/24 green, 2/24 red, 18/24 unknown.**

The 4 green metrics confirm the foundation is solid — complexity, dead code, dependency freshness, and documentation are all healthy. The 2 red metrics name the work that's known and tracked. The 18 unknowns will fill in over time once traffic flows or once credentials are wired.

This is exactly the right shape for a system that has just shipped instrumentation. The wrong shape would be all-green by self-report — that would mean the metrics weren't truthful.

---

## Today's scorecard, summarized

### Production Reality — 12/12 unknown ⚪

Every V-PR.x metric is "TBD" because there is no production traffic yet. This is structurally correct: the probes are wired, the endpoints are mounted, the BigQuery ingest is ready. Once the next deploy ships and real users hit it, these will populate over a 28-day rolling window. The proof gate per metric is documented in `validation.md`.

### Long-term Maintainability — 4 green, 2 red, 6 unknown

| ID | Status | Reality |
|----|--------|---------|
| V-LM.1 — File Size Budget | 🔴 RED | 73 files > 400 LOC, 33 > 600 LOC. Worst: `bodies.tsx` (4441), `pos.py` (3778). Known; remediation in Phase 5 task list. |
| V-LM.2 — Cyclomatic Complexity | 🟢 GREEN | 0 violations at threshold 15. |
| V-LM.3 — Cognitive Complexity | ⚪ UNKNOWN | sonarjs not yet wired. |
| V-LM.4 — Dead Code | 🟢 GREEN | 0 unused exports detected. |
| V-LM.5 — Dependency Freshness | 🟢 GREEN | 0 / 28 deps > 12 months stale. |
| V-LM.6 — Test Coverage | 🔴 RED | No coverage files yet — vitest + pytest-cov need configuring to emit reports. |
| V-LM.7 — Flaky Test Rate | ⚪ UNKNOWN | Requires `GH_TOKEN`. |
| V-LM.8 — Bundle Size Delta | ⚪ UNKNOWN | Runs per-PR; no PR yet on the new code. |
| V-LM.9 — Onboarding Time | ⚪ UNKNOWN | Quarterly exercise. |
| V-LM.10 — Feature Velocity | ⚪ UNKNOWN | Requires `GH_TOKEN`. |
| V-LM.11 — Doc Freshness | 🟢 GREEN | 0/118 docs > 90 days stale. |
| V-LM.12 — ADR Compliance | ⚪ UNKNOWN | Requires `GH_TOKEN`. |

---

## What got built in this validation pass

Two parallel specialists delivered 27 files plus integration:

### Production Reality apparatus (12 files)
- `scripts/production-reality-probe.mjs` — synthetic 10-endpoint probe with p50/p95 assertions
- `scripts/probe-targets.json` + `scripts/slo-thresholds.json` — declarative SLO map
- `scripts/crash-rate-tracker.mjs` — Sentry sessions API → per-release crash-free table
- `scripts/sentry-release-tag.sh` — `sentry-cli` wrapper for auto-tagging deploys
- `scripts/rum-summary.mjs` — BigQuery `vitals_raw` → markdown CWV summary
- `scripts/deploy-gates.sh` — 8-gate check that runs before traffic-shift
- `backend/app/api/offline_sync_health.py` — `POST /api/health/offline-sync` heartbeat ingest
- `backend/app/api/health_offline.py` — `GET /api/health/synthetic-summary` for alert-poll
- `frontend/src/observability/offline-sync-heartbeat.ts` — 5-min device reporter
- `docs/runbooks/bundle-bloat.md` — V-PR.9 triage SOP

### Maintainability scorecard apparatus (15 files)
- `scripts/world-class-scorecard.mjs` — master scorecard generator
- `scripts/maintainability-report.mjs` — multi-section maintainability analysis
- `scripts/flaky-test-tracker.mjs` — flake detection over last 100 CI runs
- `scripts/velocity-report.mjs` — PR-velocity + time-to-merge from GitHub API
- `scripts/doc-freshness.mjs` — markdown staleness scanner
- `scripts/adr-compliance.mjs` — flags significant PRs lacking an ADR
- `scripts/complexity-radon.sh` — Python complexity via radon
- `scripts/dependency-age-audit.mjs` — dep age cross-checked against PyPI / npm
- `scripts/dead-code-report.mjs` — ts-prune + vulture unified
- `tools/eslint-rules/complexity-cap.js` — recommended ESLint config (threshold 10/15)
- `.github/workflows/weekly-health-check.yml` — Monday 06:00 UTC scorecard run
- `docs/world-class/scorecard.md` — the living scorecard
- `docs/world-class/scorecard-explainer.md` — long-form rationale per metric
- `docs/world-class/30-60-90-day-plan.md` — operational playbook for validation period
- `audit/scorecards/` + `audit/maintainability/` + `audit/flakes/` + `audit/complexity/` + `audit/probes/` + `audit/rum/` — output directories

### Integration done in this pass
- `backend/app/main.py` — mounted `offline_sync_health.router` and `health_offline.router` via try-blocks (validation framework V-PR.4 + V-PR.1)
- `frontend/src/main.tsx` — dynamic-import `offline-sync-heartbeat.ts` from boot
- `scripts/maintainability-report.mjs` — fixed locSection JSON parse to read `data.watchlist` (audit-loc's actual shape); was reading `data.files` and silently returning zero

### Baselines captured
- `audit/scorecards/scorecard-2026-05-27.json` — machine-readable
- `audit/scorecards/scorecard-PREV.json` — kept for next-run trend
- `audit/baselines/2026-Q2-scorecard.md` — human-readable copy
- `audit/maintainability/report-2026-05-27.{md,json}` — detailed maintainability snapshot

---

## How the scorecard moves from "NOT YET" to "WORLD-CLASS"

The verdict requires **≥ 22 of 24 green** AND **no red metric stuck > 14 days**. Today: 4 green, 2 red, 18 unknown.

### Path to 22 green — what each metric needs

| Metric | What unlocks green | Estimated effort | Owner |
|--------|-------------------|------------------|-------|
| V-PR.1 — Real User p95 Latency | Production traffic + 28-day window | 60 days passive | Auto |
| V-PR.2 — CWV p75 | Production traffic + 28-day window | 60 days passive | Auto |
| V-PR.3 — Crash-free rate | Sentry release tagging on deploy + 28-day window | 60 days passive (after T-V.9) | DevOps |
| V-PR.4 — Offline sync success | POS rollout to ≥ 3 stores + 28-day heartbeat data | 90 days | POS team |
| V-PR.5 — Receipt-print latency | POS rollout + tablet fleet `performance.mark` data | 90 days | POS team |
| V-PR.6 — Availability | 3 consecutive months ≥ 99.5% | 90 days passive | DevOps |
| V-PR.7 — Cold-start p95 | min-instances=1 deployed + 14-day window | 14 days passive | DevOps |
| V-PR.8 — Cache hit ratio | T-4.1 cache adoption + 14-day window | 14 days passive | Backend |
| V-PR.9 — Bundle size | First post-P1 deploy with shell ≤ 350 KB gz | 1 deploy | Frontend |
| V-PR.10 — Chunk-load failure | 28-day window | 28 days passive | Auto |
| V-PR.11 — Firestore read p99 | 28-day window after index audit (T-4.6) | 28 days passive | Backend |
| V-PR.12 — Backup freshness | 90 consecutive days backup verified | 90 days passive | DevOps |
| V-LM.1 — File size | Decompose `bodies.tsx` (P5 task) + `pos.py` + top-30 monoliths | 32 days work | Frontend + Backend |
| V-LM.3 — Cognitive complexity | Install `eslint-plugin-sonarjs`, wire rule | 0.5 day | Frontend |
| V-LM.6 — Test coverage | Configure `vitest --coverage`, `pytest --cov=app`, hit 70%/80% | 10 days work | All engineers |
| V-LM.7 — Flaky tests | Set `GH_TOKEN` in scorecard runner | 0.1 day | DevOps |
| V-LM.8 — Bundle delta per PR | Bundle-diff workflow runs on actual PRs | Per-PR passive | Auto |
| V-LM.9 — Onboarding time | Quarterly exercise | Quarterly | Tech lead |
| V-LM.10 — Feature velocity | `GH_TOKEN` + 30 days of PR data | 30 days | Auto |
| V-LM.12 — ADR compliance | `GH_TOKEN` + ADR culture established | 30 days | Tech lead |

### Critical path summary
- **3 days of immediate work**: wire `GH_TOKEN`, install sonarjs, configure coverage. Unlocks V-LM.3, V-LM.6, V-LM.7, V-LM.10, V-LM.12.
- **32 days of decomposition work**: `bodies.tsx` and 30 other monoliths per `docs/settings/migration-plan.md`. Unlocks V-LM.1.
- **60–90 days of production data**: traffic flowing + Sentry tags + heartbeat data. Unlocks V-PR.1–6, V-PR.10–12.
- **One quarterly drill**: V-LM.9 + V-PR.4 24-hour drill.

So **the system can credibly read 22+/24 green in ~90 days** if the team follows through. **Until then we say "instrumented and validating," not "world-class."**

---

## Bugs found and fixed during validation pass

1. **maintainability-report locSection JSON parser** — Was looking for `data.files` but audit-loc.mjs writes `data.watchlist`. Resulted in the first scorecard reporting "0 files > 400 LOC" while the true count is 73. Fixed.
2. **`maintainability-report.mjs` mount truncation** — Windows-mount path lost the last ~18 lines of the file after an Edit. Bash sees a truncated copy, Node fails to parse. Worked around by appending the missing bytes via Python on the bash mount directly. Same issue the build agent had documented.

Both were caught by trying to run the scorecard and observing the wrong number.

---

## What the scorecard does NOT yet prove

The scorecard is a **dashboard**, not an alerting system. We have:

- ✅ A way to see the current state at any time (`node scripts/world-class-scorecard.mjs`)
- ✅ Automated weekly regeneration (`.github/workflows/weekly-health-check.yml` Monday 06:00 UTC)
- ✅ Trend tracking via `scorecard-PREV.json`
- ✅ A documented thresholds + runbook map per metric (`validation.md`)

We don't yet have:

- ❌ Real-time alerts wired to PagerDuty / Slack for SEV1/SEV2
- ❌ A traffic-shift block based on production probe failures (the code is there in `deploy-gates.sh`, but `deploy-bluegreen.sh` doesn't call it yet — integration step)
- ❌ Monthly executive read-out of the scorecard

Those are the natural next steps once 60–90 days of telemetry have flowed.

---

## Closing

You asked: *"Is it really world-class?"*

Honest answer: **The instrumentation says we're ready to *prove* world-class. The first measurement says we're not there yet. The path is mapped, the gates are wired, the scorecard is honest. In 90 days of production traffic and 32 days of decomposition work, the scorecard should read ≥ 22/24 green. Until then, we say "validating."**

The thing that makes a system world-class is not the code we wrote — it's the **discipline to keep the scorecard green** week after week. The apparatus is now in place to make that discipline measurable.
