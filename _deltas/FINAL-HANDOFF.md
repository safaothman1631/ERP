# FINAL HAND-OFF — Kurdish ERP Deploy

> **Date:** 2026-05-27
> **Audience:** Safa (the operator) + future Claude sessions.
> **Status:** Apparatus complete. Awaiting first operator-driven production deploy.

---

## The two things you actually need

1. **The doc:** `deploy/FINAL-OPERATOR-GUIDE.md` — single page, bilingual, scannable in 2 minutes.
2. **The command:**
   ```powershell
   cd C:\Users\SAFA\zoho\deploy
   .\00-deploy-everything.ps1 -Project YOUR-GCP-PROJECT -RepoName zoho
   ```

Everything else in this document is reference material for when something goes wrong or you need to understand a specific piece.

---

## Spec documents (what we promised to build)

| Doc | One-line description |
|-----|----------------------|
| `requirements.md` | Functional + non-functional requirements across the whole ERP. |
| `design.md` | Architecture decisions: Cloud Run + Firestore + Vercel + Redis + BigQuery RUM. |
| `tasks.md` | Task breakdown P0..P6, each with owner + acceptance criteria. |
| `docs/world-class/scorecard.md` | 24-metric V-PR / V-LM scorecard with verdict + live snapshot. |
| `docs/world-class/scorecard-explainer.md` | Rationale + triage guidance for each of the 24 metrics. |
| `docs/world-class/30-60-90-day-plan.md` | Time-bound execution plan after first deploy. |
| `docs/security/csp.md` | Two-stage CSP rollout (report-only → enforced). |
| `docs/security/secret-rotation.md` | Rotation cadence + per-secret runbook. |
| `docs/security/workload-identity-federation.md` | WIF setup + side-by-side migration + rollback. |
| `docs/security/pii-handling.md` | P0..P3 classification, export/delete, PDPL alignment. |
| `DISASTER_RECOVERY.md` | DR drill procedure, RTO/RPO targets, backup verify pipeline. |

---

## Deploy scripts (what actually runs)

All in `deploy/`. PowerShell 5.1 + 7 compatible where reasonable; the heavier ones require 7.

| Script | One-line description |
|--------|----------------------|
| `00-deploy-everything.ps1` | **Master orchestrator** — runs everything below in order, idempotent, resumable. |
| `01-prereqs.ps1` | Verify node/python/git/gh/gcloud/vercel/docker versions + login state. |
| `02-install-and-build.ps1` | npm install + Vite build + pip install + i18n split. |
| `03-run-tests.ps1` | Vitest run + coverage, Playwright smoke (`nav:sweep`), pytest with `--cov=app`. |
| `04-push-to-github.ps1` | git add + commit (prompts message) + push to origin. |
| `05-setup-secrets.ps1` | Pushes 16 secrets to GitHub Actions (reads from `.env.deploy` if present). |
| `06a-setup-gcp-resources.ps1` | One-time GCP setup: APIs, Artifact Registry, Firestore, Redis, secrets, BigQuery, WIF, deployer SA. |
| `06-deploy-cloudrun.ps1` | Build + push Docker image, deploy to Cloud Run with new revision. |
| `07a-setup-vercel-project.ps1` | One-time Vercel project link + framework preset + production env. |
| `07-deploy-vercel.ps1` | Run `vercel --prod` and capture the new URL into `vercel-url.txt`. |
| `08-smoke-test-production.ps1` | Hit health + a few canary endpoints; check Sentry connectivity. |
| `09-post-deploy-checklist.ps1` | Bilingual checklist + optional browser tab launcher for consoles. |

Supporting docs in `deploy/`:

| Doc | One-line description |
|-----|----------------------|
| `FINAL-OPERATOR-GUIDE.md` | **The one doc Safa reads** — single page, ~2 minute scan. |
| `STATE.md` | Live tracker — operator fills in step status as they go. |
| `CHECKLIST.md` | Long-form pre-flight checklist (older; FINAL-OPERATOR-GUIDE is the short version). |
| `README.md` | Tool versions + step-by-step long-form walkthrough. |
| `RUNBOOK-FIRST-INCIDENT.md` | What to do if production breaks within 24h of first deploy. |
| `TROUBLESHOOTING.md` | Common errors per script + fix. |
| `POST-DEPLOY-VERIFICATION.md` | The 28-day verification windows + manual checks. |
| `DEPLOY-FLOW.md` | Mermaid diagram of the orchestrator flow. |

Artifact files (auto-generated, do not edit):
- `gcp-resources-manifest.json` — proof of 06a success (orchestrator reads `done`).
- `vercel-link.json` — proof of 07a success (orchestrator looks for existence).
- `cloudrun-url.txt`, `vercel-url.txt` — last-known production URLs.
- `logs/*.log` — per-script logs including `master-<ISO>.log` from the orchestrator.

---

## GitHub Actions workflows (.github/workflows/)

| Workflow | One-line description |
|----------|----------------------|
| `ci.yml` | PR gate: lint + typecheck + unit tests + bundle budget. |
| `ci-quality.yml` | Quality probes (complexity, dead code, dep freshness) on push + nightly. |
| `deploy-production.yml` | Tag-triggered prod deploy via WIF — mirrors what 06+07 do locally. |
| `deploy-cloudrun.yml` | Backend-only deploy path. |
| `deploy-firestore.yml` | Firestore index + rules deploy. |
| `preview-deploy.yml` | PR preview env on Vercel. |
| `bundle-diff.yml` | PR comment with bundle delta vs main. |
| `scorecard-on-pr.yml` | Re-runs `world-class-scorecard.mjs` on PR, fails if a green metric goes red. |
| `weekly-health-check.yml` | Sunday scorecard regen + Slack post. |
| `security-scan.yml` | npm audit + pip-audit + CodeQL + Gitleaks (push + weekly). |
| `load-test.yml` | Nightly k6 matrix; sticky issue tracker for trend. |
| `backup-verify.yml` | Quarterly restore drill into ephemeral project. |
| `prelaunch-ops.yml` | One-shot prelaunch ops checks. |

---

## Runbooks (`docs/runbooks/`)

Pre-written response procedures for the eight scenarios the V-PR scorecard tracks:

- `slow-firestore-read.md` — for V-PR.1 / V-PR.11 latency alerts
- `cwv-regression.md` — for V-PR.2 RUM regression
- `chunk-load-failure.md` — for V-PR.3 / V-PR.10 client errors
- `pos-offline-drill.md` — for V-PR.4 quarterly DR
- `print-path-triage.md` — for V-PR.5 receipt latency
- `cold-start-spike.md` — for V-PR.7 cold start
- `redis-down.md` — for V-PR.8 cache hit collapse
- `bundle-bloat.md` — for V-PR.9 / V-LM.8 bundle regression

---

## Verdict — world-class today?

**NOT YET WORLD-CLASS — instrumented and ready to validate.**

- The apparatus (specs, scripts, runbooks, workflows, scorecard, telemetry pipes) is complete and self-consistent.
- 4 of 24 V-metrics are green from static analysis today. The remaining 20 are ⚪ pending live production data.
- The single fastest path to a "WORLD-CLASS" verdict is: ship the first production deploy (today), let RUM + SLO probes collect 28 days of real traffic, then re-run `scripts/world-class-scorecard.mjs`. At that point ≥ 22/24 green is achievable if the system holds.

Until then: the verdict is honest — we are deploy-ready, not yet field-proven.

---

## Where Claude can't help

These need real-world time and physical operator presence, no amount of code can compress them:

- 28-day RUM window (V-PR.2)
- 28-day API SLO window (V-PR.1, V-PR.11)
- 90-day backup restore verification (V-PR.12)
- Quarterly DR drill — full 24h offline POS simulation (V-PR.4)
- Quarterly onboarding test (V-LM.9)
- 56-section settings UI decomposition (~32 working days, V-LM.1)
- Arabic translation (V-LM.9 i18n breadth)

These are listed in `FINAL-OPERATOR-GUIDE.md` under "پاش deploy — ئەو شتانە کە کات-بەندە" so Safa sees them but doesn't try to short-circuit them.
