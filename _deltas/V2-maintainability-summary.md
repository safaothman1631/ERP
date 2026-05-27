# V2 — Long-Term Maintainability Validation: file map & integration notes

Companion to `.kiro/specs/world-class-performance/validation.md` Part 2
(V-LM.1 … V-LM.12) and Task T-V.1 / T-V.3 / T-V.4 / T-V.5 / T-V.6 / T-V.7 /
T-V.8 / T-V.11.

The goal of this delta: stand up the **scorecard apparatus** that
continuously measures whether the codebase is staying maintainable, plus the
**weekly automated health-check workflow** that runs it and posts results to
a sticky GitHub issue.

---

## Files created

### Scripts (`scripts/`)

| File | What it does | V-LM IDs | Run locally |
| --- | --- | --- | --- |
| `scripts/world-class-scorecard.mjs` | Master script. Composes all sub-reports + production probes, writes `docs/world-class/scorecard.md` and `audit/scorecards/scorecard-{DATE}.json`. Computes trend vs `scorecard-PREV.json`. Outputs WORLD-CLASS verdict (≥ 22/24 green, no red > 14d). | all 24 | `node scripts/world-class-scorecard.mjs [--dry-run] [--no-probes]` |
| `scripts/maintainability-report.mjs` | Six-section maintainability analysis (LOC, complexity, dead code, doc freshness, dep freshness, coverage). Markdown + JSON. | 1, 2, 4, 5, 6, 11 | `node scripts/maintainability-report.mjs [--markdown] [--no-write]` |
| `scripts/flaky-test-tracker.mjs` | Pulls last 100 CI runs via GitHub API, computes pass-rate per workflow/branch, flags tests with pass-rate ∈ (0%, 100%). Graceful skip without `GH_TOKEN`. | 7 | `GH_TOKEN=... node scripts/flaky-test-tracker.mjs` |
| `scripts/velocity-report.mjs` | GitHub Search API: PRs/week over 7/30/90 days, TTM p50/p95, review coverage, QoQ trend. | 10 | `GH_TOKEN=... node scripts/velocity-report.mjs [--markdown] [--write]` |
| `scripts/doc-freshness.mjs` | Walks `docs/` and `.kiro/`, uses `git log -1 --format=%ct` per `.md` to compute age, reports % > 90d stale + oldest 10. | 11 | `node scripts/doc-freshness.mjs [--markdown] [--write] [--quiet]` |
| `scripts/adr-compliance.mjs` | GitHub API: merged PRs in last 30d. Flags PRs with > 20 files OR > 1000 LOC that landed without a `docs/adr/` change. Reports compliance %. | 12 | `GH_TOKEN=... node scripts/adr-compliance.mjs [--markdown] [--write]` |
| `scripts/complexity-radon.sh` | Bash wrapper: `radon cc backend/app -s -a -nc`, classifies by complexity bands, writes `audit/complexity/python-{DATE}.txt`. Graceful skip without `radon`. | 2 | `bash scripts/complexity-radon.sh` |
| `scripts/dependency-age-audit.mjs` | `npm view <pkg> time` (frontend) + PyPI JSON API (backend). Flags deps > 12 months stale. | 5 | `node scripts/dependency-age-audit.mjs [--markdown] [--write] [--offline]` |
| `scripts/dead-code-report.mjs` | Unified report: `ts-prune` (FE) + `vulture` (BE). Computes dead %. Graceful skip if either tool missing. | 4 | `node scripts/dead-code-report.mjs [--markdown] [--write]` |

### Tools (`tools/`)

| File | What it does |
| --- | --- |
| `tools/eslint-rules/complexity-cap.js` | Centralised configuration for the built-in `complexity` ESLint rule. Exposes thresholds (`warn=10`, `error=15`) and three flat-config presets (`recommended`, `recommended-warn`, `two-band`) for the team to extend. |

### Workflows (`.github/workflows/`)

| File | What it does | Schedule |
| --- | --- | --- |
| `.github/workflows/weekly-health-check.yml` | Mondays 06:00 UTC (09:00 Baghdad). Installs `radon` + `vulture` + `ts-prune`, runs all maintainability scripts, runs `world-class-scorecard.mjs`, commits the updated `docs/world-class/scorecard.md` + audit artefacts, finds-or-creates a sticky GitHub issue titled "World-Class Scorecard", and uses `peter-evans/create-or-update-comment@v4` to replace its body with the new scorecard. Also writes the scorecard to `GITHUB_STEP_SUMMARY` for the Actions UI. | weekly + `workflow_dispatch` |

### Docs (`docs/world-class/`)

| File | What it contains |
| --- | --- |
| `docs/world-class/scorecard.md` | The scorecard itself. Re-generated each run. Currently regenerated with real values (5/24 green at first run — see Findings). |
| `docs/world-class/scorecard-explainer.md` | Long-form rationale for the 24 metrics, how each is computed, what "world-class" means, triage guidance per row, when to file a follow-on spec. |
| `docs/world-class/30-60-90-day-plan.md` | Operational playbook: Day 0–7 setup, Day 7–30 staging, Day 30–60 prod rollout, Day 60–90 first 28-day proof window, Day 90–180 full rollout. Per-week checklist + role-based ownership matrix. |

### Audit storage stubs (`audit/`)

- `audit/scorecards/.gitkeep` — scorecard JSON history (one per run + `scorecard-PREV.json` pointer).
- `audit/maintainability/.gitkeep` — sub-report markdowns + JSONs.
- `audit/flakes/.gitkeep` — flaky-test reports.
- `audit/complexity/.gitkeep` — radon output per run.
- `audit/probes/.gitkeep` — production-reality probe results (consumed by scorecard; the probe itself is a separate workstream, T-V.2).

---

## Integration steps (for the team)

These are the manual steps required to wire the apparatus into the project.
Each is a small, reversible PR.

1. **Confirm Node 20 + Python 3.11 are available** on developer machines and
   in CI. The workflow handles CI; the README should mention dev versions.

2. **Install the maintainability tools locally** (optional but recommended):
   ```sh
   npm i -g ts-prune@0.10.3
   pip install radon vulture
   ```
   Without these, the scripts gracefully skip the relevant section and the
   scorecard marks those rows ⚪ unknown rather than crashing.

3. **Wire `tools/eslint-rules/complexity-cap.js` into `frontend/eslint.config.js`**:
   ```js
   import complexityCap from '../tools/eslint-rules/complexity-cap.js';
   export default [
     // ... existing ...
     complexityCap.configs.recommended,
   ];
   ```
   This applies the ≤ 15 error threshold from V-LM.2 across all FE TS/TSX.

4. **Create the sticky GitHub issue** named exactly "World-Class Scorecard"
   the first time, OR let the workflow create it on its first run (it does
   this automatically via `gh issue create` if no matching open issue exists).
   Pin the issue and add the `scorecard` label.

5. **Set the `GITHUB_TOKEN` repo-level permissions** to grant Issues: write
   (required by the workflow's `peter-evans/create-or-update-comment@v4`
   step). The workflow's top-level `permissions:` block already requests
   `issues: write` and `contents: write`.

6. **Trigger the workflow manually once** via `workflow_dispatch` to confirm
   end-to-end: the artefact uploads, the commit lands, the sticky issue
   updates.

7. **Coverage wiring**: ensure Vitest produces `coverage/coverage-summary.json`
   (the c8 reporter is set via `--coverage --coverage-reporter=json-summary`)
   and `pytest-cov` produces `backend/coverage.xml`. Both files are read by
   `maintainability-report.mjs` if present; otherwise V-LM.6 stays red.

8. **Production-reality probe (T-V.2)** is a separate workstream that writes
   `audit/probes/probes-<DATE>.json`. The scorecard already reads it
   automatically — no change needed once that probe exists.

---

## Environment variables

| Var | Used by | Required? | Default behaviour if missing |
| --- | --- | --- | --- |
| `GH_TOKEN` | `flaky-test-tracker`, `velocity-report`, `adr-compliance` | No | Each script emits a structured `{ skipped: true, reason }` and exits 0. The scorecard row goes ⚪ unknown. |
| `GH_REPO` | same trio | No | Derived from `git config remote.origin.url`. |
| `FLAKY_WORKFLOW_NAME` | `flaky-test-tracker` | No | Defaults to `ci.yml`. |
| `FLAKY_RUN_LIMIT` | `flaky-test-tracker` | No | Defaults to 100. |
| `MAINTAINABILITY_OFFLINE` | `maintainability-report` (forwards to `dependency-age-audit`) | No | If `1`, skips network calls (useful in CI without internet). |

CI: `GH_TOKEN` is set from `secrets.GITHUB_TOKEN` automatically in the
workflow. No extra repo-level secret is needed for the V-LM rows to work.

---

## Findings from the first dry-run

Ran `MAINTAINABILITY_OFFLINE=1 node scripts/world-class-scorecard.mjs --no-probes`
against the current `main`. Result: **5 of 24 rows green** — the right answer
for "apparatus just wired up, no probes yet, no GH_TOKEN":

- 🟢 green (5): V-LM.1, V-LM.2, V-LM.4, V-LM.5, V-LM.11
- 🔴 red (1): V-LM.6 — coverage files not yet generated in the workspace
  (`coverage/coverage-summary.json` and `backend/coverage.xml` absent).
- ⚪ unknown (18): all 12 V-PR rows + V-LM.3, .7, .8, .9, .10, .12.

The unknowns will burn down as:
- the production probe (T-V.2) lands → V-PR.1–12 fill in.
- `GH_TOKEN` becomes available in CI → V-LM.7, V-LM.10, V-LM.12 fill in.
- `eslint-plugin-sonarjs` is wired → V-LM.3 fills in.
- the existing `bundle-diff.yml` workflow's artefact is read by the scorecard → V-LM.8 fills in.
- a quarterly onboarding exercise happens → V-LM.9 fills in.

V-LM.6 (test coverage) goes 🔴 by design until the coverage reports are
generated. As soon as `npm run test -- --coverage` and `pytest --cov` run in
CI with the right reporters, the row will flip 🟢.

---

## Verified behaviour during build

- `node --check` passes on all 8 .mjs scripts.
- `node scripts/doc-freshness.mjs --quiet` reports `118 docs, 0 stale (0%) — green`.
- `node scripts/adr-compliance.mjs` returns a structured "skipped" result without `GH_TOKEN`.
- `node scripts/velocity-report.mjs` returns a structured "skipped" result without `GH_TOKEN`.
- `node scripts/flaky-test-tracker.mjs` returns a structured "skipped" result without `GH_TOKEN`.
- `node scripts/dependency-age-audit.mjs --offline` runs and parses both `frontend/package.json` and `backend/requirements.txt`.
- `bash scripts/complexity-radon.sh` writes a graceful "skipped" marker file when `radon` is absent.
- `node scripts/world-class-scorecard.mjs --dry-run --no-probes` produces a complete 24-row markdown table.
- `node scripts/world-class-scorecard.mjs --no-probes` writes `docs/world-class/scorecard.md`, `audit/scorecards/scorecard-{DATE}.json`, and `audit/scorecards/scorecard-PREV.json`.
- Running the scorecard twice produces output that differs only in the
  `generated` timestamp — determinism preserved.

---

## Follow-ups (not in this delta)

1. **Production-reality probe** (T-V.2): `scripts/production-reality-probe.mjs`
   must be written to fill V-PR.1–12. Once written, no scorecard code change
   is needed — the probe just writes `audit/probes/probes-<DATE>.json`.

2. **eslint-plugin-sonarjs** wiring for V-LM.3 (cognitive complexity).
   Add to `frontend/package.json` and enable `sonarjs/cognitive-complexity`
   at threshold 15.

3. **Per-test flake data**: `flaky-test-tracker.mjs` currently uses workflow
   conclusion as a coarse proxy. To get per-test granularity, configure
   Vitest with the JSON reporter (`--reporter=json`) and pytest with
   `--junitxml=` outputs, and upload them as a CI artifact named
   `test-results`. The tracker already has the JUnit and Vitest-JSON
   parsers ready (`parseJUnitXml`, `parseVitestJson`); only the
   artifact-download step is missing.

4. **Bundle-diff feed into V-LM.8**: have `.github/workflows/bundle-diff.yml`
   write a JSON summary to `audit/maintainability/bundle-diff-{DATE}.json`,
   then teach `maintainability-report.mjs` to read it.

5. **Coverage thresholds blocking** for V-LM.6: the workflow currently
   reports coverage but doesn't block. Once thresholds are stable, flip the
   CI gate to fail builds when coverage drops > 2% in a PR.

6. **Onboarding metric** for V-LM.9: design a quarterly exercise template
   in `docs/onboarding/quarterly-exercise.md` and store results in
   `audit/onboarding/`.

7. **Sentry release tagging** (T-V.9): wire automatic release markers on
   every deploy so V-PR.3 (crash-free rate) is attributable.

8. **Pre-commit hook** running `node scripts/audit-loc.mjs --check` so
   V-LM.1 hard limit doesn't even reach review.

---

## Constraints honoured

- **No modifications** to `frontend/package.json`, `backend/requirements.txt`,
  `frontend/src/main.tsx`, `backend/app/main.py`, or any existing
  `.github/workflows/*.yml` file. The only workflow file added is the new
  `weekly-health-check.yml`.
- **Graceful degradation**: every external tool (`radon`, `vulture`,
  `ts-prune`, `npm`, network) has a defined skip path.
- **Idempotent**: re-running the scorecard yields identical output modulo the
  `generated` timestamp (verified by diff).
- **Production-grade Node**: JSDoc-typed (`@ts-check` headers), `node:fs/promises`
  throughout, no callbacks.
- **Validation IDs cited**: every script and doc references the V-LM.x ID it
  serves so traceability back to `validation.md` is one grep away.
