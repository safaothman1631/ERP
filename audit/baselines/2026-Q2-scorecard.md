# World-Class Readiness Scorecard

_Last updated: `2026-05-27T13:37:19.637Z` — regenerated weekly by `scripts/world-class-scorecard.mjs`._

## Verdict

**NOT YET** — 4/24 green; 0 red metric(s) stuck > 14 days.

## Part 1 — Production Reality (V-PR.1–12)

| ID | What | Target | Current (28d) | Trend | Status | Runbook |
| --- | --- | --- | --- | :---: | :---: | --- |
| V-PR.1 | Real User p95 Latency | per SLO table | TBD | · | ⚪ | [link](docs/runbooks/slow-firestore-read.md) |
| V-PR.2 | Core Web Vitals p75 | LCP ≤ 2000ms, INP ≤ 150ms, CLS ≤ 0.05 | TBD | · | ⚪ | [link](docs/runbooks/cwv-regression.md) |
| V-PR.3 | Crash-Free Session Rate | ≥ 99.5% | TBD | · | ⚪ | [link](docs/runbooks/chunk-load-failure.md) |
| V-PR.4 | Offline POS Sync Success | ≥ 99.9% | TBD | · | ⚪ | [link](docs/runbooks/pos-offline-drill.md) |
| V-PR.5 | Receipt-Print Latency p95 | ≤ 200ms | TBD | · | ⚪ | [link](docs/runbooks/print-path-triage.md) |
| V-PR.6 | Availability (monthly) | ≥ 99.5% | TBD | · | ⚪ | [link](DISASTER_RECOVERY.md) |
| V-PR.7 | Cold-Start p95 | ≤ 2s | TBD | · | ⚪ | [link](docs/runbooks/cold-start-spike.md) |
| V-PR.8 | Cache Hit Ratio | ≥ 60% | TBD | · | ⚪ | [link](docs/runbooks/redis-down.md) |
| V-PR.9 | Bundle Size at Production | shell ≤ 350 KB gz | TBD | · | ⚪ | [link](docs/runbooks/bundle-bloat.md) |
| V-PR.10 | Chunk-Load Failure Rate | < 0.5% | TBD | · | ⚪ | [link](docs/runbooks/chunk-load-failure.md) |
| V-PR.11 | Firestore Read p99 | ≤ 400ms | TBD | · | ⚪ | [link](docs/runbooks/slow-firestore-read.md) |
| V-PR.12 | Backup Freshness | ≤ 24h between backups | TBD | · | ⚪ | [link](DISASTER_RECOVERY.md) |

## Part 2 — Long-term Maintainability (V-LM.1–12)

| ID | What | Target | Current | Trend | Status |
| --- | --- | --- | --- | :---: | :---: |
| V-LM.1 | File Size Budget | 0 files > 600 LOC | 73 > 400, 33 > 600 LOC | ⬆ | 🔴 |
| V-LM.2 | Cyclomatic Complexity Cap | 0 functions > 15 | 0 FE violations / BE skipped | ➡ | 🟢 |
| V-LM.3 | Cognitive Complexity Cap | < 10 functions > 15 | TBD (sonarjs not wired) | · | ⚪ |
| V-LM.4 | Dead Code Rate | < 0.5% dead exports | 0 unused FE, 0 BE (0%) | ➡ | 🟢 |
| V-LM.5 | Dependency Freshness | 0 deps > 12 months stale | 0 / 28 deps > 12mo stale | ➡ | 🟢 |
| V-LM.6 | Test Coverage | FE ≥ 70%, BE ≥ 80% | FE n/a, BE n/a | · | 🔴 |
| V-LM.7 | Flaky Test Rate | < 1% flaky | skipped: GH_TOKEN not set; flake tracking requires GitHub API access | · | ⚪ |
| V-LM.8 | Bundle Size Delta per PR | 90% PRs neutral/negative | TBD (bundle-diff workflow runs on PR, not here) | · | ⚪ |
| V-LM.9 | Onboarding Time | ≤ 1 working day | TBD (quarterly exercise) | · | ⚪ |
| V-LM.10 | Feature Velocity | not declining > 20% QoQ | skipped: GH_TOKEN not set | · | ⚪ |
| V-LM.11 | Documentation Freshness | < 20% docs > 90d stale | 0/118 (0%) stale | ➡ | 🟢 |
| V-LM.12 | ADR Compliance | ≥ 90% on significant PRs | skipped: GH_TOKEN not set | · | ⚪ |

## How to read this

- 🟢 green = current value meets target. 🟡 yellow = within 1 band of target. 🔴 red = over target.
- ⚪ unknown = the probe/script hasn't been wired yet or returned no data.
- Trend ⬆/⬇/➡ compares this run to the most recent prior run stored in `audit/scorecards/scorecard-PREV.json`.
- The "WORLD-CLASS" verdict requires **≥ 22/24 green** AND **no red metric older than 14 days**.
- See `docs/world-class/scorecard-explainer.md` for the rationale behind each metric and triage guidance.
