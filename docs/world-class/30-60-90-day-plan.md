# 30 / 60 / 90 / 180-Day Validation Playbook

> Operational companion to
> [`.kiro/specs/world-class-performance/validation.md`](../../.kiro/specs/world-class-performance/validation.md)
> "Path to Proof" table. This document turns that table into per-week
> checklists with owners.

The promise of validation.md is: *we've built the apparatus; the next 180 days
are about running it.* This playbook is what "running it" looks like, day by
day, week by week.

Owners listed below are **roles**, not people. Map them to humans in your
project board / RACI before week 1.

---

## Day 0–7 — Setup (first sprint)

**Goal:** the scorecard generates with the right row labels, even if most V-PR
values say "TBD". Maintainability rows (V-LM.1–.6 and .11) read green or
yellow with real numbers. Baseline captured.

### Checklist

| # | Task | Owner | DoD |
|---|------|-------|-----|
| 1 | Run `node scripts/audit-loc.mjs` and commit the watchlist | Platform | `docs/audit/monolith-watchlist.json` exists with current counts |
| 2 | Run `node scripts/world-class-scorecard.mjs --dry-run` locally | Platform | `docs/world-class/scorecard.md` renders with TBD values |
| 3 | Wire the weekly workflow on `main` (file already exists) | Platform | Workflow run visible in Actions tab; sticky issue created |
| 4 | Capture baseline: `cp docs/world-class/scorecard.md audit/baselines/2026-Q2-scorecard.md` | Platform | Baseline file committed |
| 5 | Create the sticky GitHub issue titled "World-Class Scorecard" | Eng-Manager | Issue exists; pinned; labelled `scorecard` |
| 6 | Confirm `GH_TOKEN` permissions cover Actions read + Issues write | Eng-Manager | First workflow run posts/edits the issue cleanly |
| 7 | Install `radon` + `vulture` in the CI image (handled by workflow) | DevOps | Workflow logs show successful install |
| 8 | Document the Monday-morning review ritual | Eng-Manager | 15-min standing meeting on calendar |

**Exit criteria for Day 7:** workflow has run end-to-end at least once; the
sticky issue body shows the current scorecard; baseline is captured.

---

## Day 7–30 — Staging Validation

**Goal:** synthetic SLO probes generate non-TBD numbers for V-PR.1, V-PR.7,
V-PR.8, V-PR.11. All V-LM rows green or trending right.

### Per-week checklist

#### Week 1 (Day 7–14)

| # | Task | Owner | DoD |
|---|------|-------|-----|
| 1 | Implement `scripts/production-reality-probe.mjs` (T-V.2) and have it write to `audit/probes/probes-<DATE>.json` | Platform | Latest probes file present; V-PR rows in scorecard show values |
| 2 | Wire synthetic latency probe against staging Class-A endpoints | SRE | V-PR.1 cell shows a number (not TBD) |
| 3 | Wire Cloud Run cold-start probe | SRE | V-PR.7 shows a number |
| 4 | Add `redis_cache_hits_total` counter scraping | SRE | V-PR.8 shows a number |

#### Week 2 (Day 14–21)

| # | Task | Owner | DoD |
|---|------|-------|-----|
| 1 | Confirm Firestore wrapper OTel spans land in trace store | Platform | V-PR.11 shows a number |
| 2 | First Monday-morning review: triage any 🟡/🔴 V-LM rows | Whole team | Action items in the sticky issue thread |
| 3 | Address V-LM.1 worst-3 monoliths if any are > 1500 LOC | Platform | LOC numbers drop in the next scorecard |

#### Week 3 (Day 21–30)

| # | Task | Owner | DoD |
|---|------|-------|-----|
| 1 | Wire `eslint-plugin-sonarjs` to fill V-LM.3 | Frontend | V-LM.3 shows a number, not TBD |
| 2 | Wire bundle-diff JSON output for V-LM.8 ingestion | Frontend | V-LM.8 shows a number |
| 3 | Trial 1 quarterly onboarding exercise (V-LM.9) — fresh contributor clones, ships hello-world PR | Eng-Manager | Time recorded; result fed back into `docs/onboarding/` |

**Exit criteria for Day 30:** ≥ 18 of 24 rows have a non-TBD value. ≥ 14 of
24 rows are green.

---

## Day 30–60 — Production Rollout

**Goal:** production traffic begins; RUM data flows; V-PR.2 / V-PR.3 / V-PR.10
start collecting real-user numbers.

### Per-week checklist

#### Week 4 (Day 30–37)

| # | Task | Owner | DoD |
|---|------|-------|-----|
| 1 | Wire `web-vitals` → `/api/rum/vitals` → BQ | Frontend | V-PR.2 has device-class breakdown |
| 2 | Confirm Sentry session tracking is on for production builds | Frontend | V-PR.3 shows real % |
| 3 | Tag `kind=chunk-load-failure` Sentry events | Frontend | V-PR.10 shows real % |

#### Week 5 (Day 37–44)

| # | Task | Owner | DoD |
|---|------|-------|-----|
| 1 | First on-call rotation runs an alert drill (any V-PR runbook) | SRE | Drill report committed to `audit/drills/` |
| 2 | Backup-verify workflow run on schedule | SRE | V-PR.12 shows ≤ 24h consistently |
| 3 | Audit `docs/runbooks/` — every V-PR runbook link resolves to a real doc | SRE | `make docs-link-check` (or equivalent) passes |

#### Weeks 6–8 (Day 44–60)

| # | Task | Owner | DoD |
|---|------|-------|-----|
| 1 | Burn-down stale docs surfaced by V-LM.11 | Whole team | Stale % drops below 20% |
| 2 | Burn-down 1–2 V-LM.1 monoliths/week | Frontend | LOC trend ⬇ for V-LM.1 |
| 3 | Stand up `/api/health/offline-sync` heartbeat endpoint (T-V.10) | Backend | V-PR.4 has device-level data |

**Exit criteria for Day 60:** ≥ 22 of 24 rows have a non-TBD value. ≥ 18 of
24 rows green. No row has been red for > 14 days.

---

## Day 60–90 — First 28-Day Proof Window

**Goal:** the 28-day rolling windows have meaningful data. Evaluate the proof
gates for V-PR.2, V-PR.3, V-PR.6, V-PR.7, V-PR.10, V-PR.11, V-PR.12.

### Weekly checklist

Every Monday review:

| # | Task | Owner |
|---|------|-------|
| 1 | Read the scorecard | Whole team |
| 2 | For each row whose status changed: name a cause (deploy/PR) and owner | Eng-Manager |
| 3 | For each row red > 7 days: confirm an active fix is in progress | Owner |
| 4 | For each row red > 14 days: agree to file a follow-on spec | Eng-Manager |

POS rollout begins on 3 pilot stores; V-PR.4 and V-PR.5 start collecting.

| # | Task | Owner | DoD |
|---|------|-------|-----|
| 1 | Deploy POS to pilot store 1 | POS team | Heartbeat from store 1 shows in dashboard |
| 2 | Deploy POS to pilot store 2 | POS team | Heartbeat from store 2 shows |
| 3 | Deploy POS to pilot store 3 | POS team | Heartbeat from store 3 shows |
| 4 | First 24-hour offline drill on a store (V-PR.4) | POS team + SRE | Drill log in `audit/drills/`; 0 data loss |

**Exit criteria for Day 90:** the proof gates listed above are either green
for 28 consecutive days OR have a documented exception with an end date.

---

## Day 90–180 — Full Rollout and Proof Gates

**Goal:** every metric has had its proof window evaluated. The first quarterly
DR drill is executed. The first quarterly onboarding exercise (V-LM.9) has
completed end-to-end.

### Bi-weekly checklist

| Week | Task | Owner |
|---|------|------|
| 13–14 | Roll out POS to next tier of stores | POS team |
| 15–16 | Quarterly DR drill — fail-over + restore | SRE |
| 17–18 | Quarterly onboarding exercise (V-LM.9, real new hire) | Eng-Manager |
| 19–20 | Review the cumulative scorecard JSON history; look for stuck-yellow rows | Whole team |
| 21–24 | Lock-in: write the "what we'd do differently" retro | Whole team |
| 25–26 | If still ≥ 22/24 green for 28d → declare WORLD-CLASS in the verdict | Eng-Manager |

**Exit criteria for Day 180:** the scorecard reads ≥ 22/24 green AND no row
red for > 14 days. The spec graduates.

---

## After Day 180 — Steady State

The scorecard does not stop. Every Monday, the team spends 15 minutes
reviewing it. Any single row red for > 30 days seeds a follow-on spec. Any
trend of three rows simultaneously red triggers a "tiger team" — a 2-week
focused effort to bring the structural problem back under threshold.

The 24-row scorecard is the contract: this is what world-class looks like
operationally, and this is how we know we haven't drifted.

---

## Who owns what

| Role | Responsibilities |
| --- | --- |
| **Eng-Manager** | Monday-morning review; verdict declaration; spec seeding for red rows; onboarding exercises (V-LM.9) |
| **Platform**    | LOC budget (V-LM.1); complexity (V-LM.2); dead code (V-LM.4); doc freshness (V-LM.11); scorecard plumbing |
| **Frontend**    | Bundle gates (V-PR.9, V-LM.8); web vitals (V-PR.2); chunk-load (V-PR.10); test coverage FE (V-LM.6) |
| **Backend**     | Latency (V-PR.1, V-PR.11); cold-start (V-PR.7); cache (V-PR.8); offline-sync endpoint (V-PR.4); coverage BE (V-LM.6) |
| **POS team**    | Offline sync (V-PR.4); print latency (V-PR.5) |
| **SRE**         | Availability (V-PR.6); backups (V-PR.12); runbooks; on-call drills |
| **All**         | ADR discipline (V-LM.12); flake triage (V-LM.7); dependency hygiene (V-LM.5); feature velocity (V-LM.10) |
