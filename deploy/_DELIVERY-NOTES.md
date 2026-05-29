# Delivery Notes - Deploy Kit for Kurdish ERP

> Tomarkrdni hamu fayle drustkrawekan le `deploy/`, erki har yekek u taduwekani.
> Auto-generated record of every file produced for the deploy turn-key kit.

**Generated:** 2026-05-27
**Audience:** Safa Othman (safaothman1631@gmail.com)
**Target repo:** `github.com/safaothman1631/<RepoName>` (default `zoho`)

---

## File manifest

| # | File | Purpose | Depends on | Runtime |
|---|------|---------|------------|---------|
| 1 | `deploy/README.md` | Master Kurdish guide - reads first | - | - |
| 2 | `deploy/01-prereqs.ps1` | Tool + login + env-var prereq checker | - | ~2 min |
| 3 | `deploy/02-install-and-build.ps1` | npm/pip clean install + vite build | 01 | ~10-15 min |
| 4 | `deploy/03-run-tests.ps1` | Vitest + Playwright + pytest with coverage | 02 | ~8-12 min |
| 5 | `deploy/04-push-to-github.ps1` | Stage + secret-guard + commit + push | 03 (recommended) | ~1-2 min |
| 6 | `deploy/05-setup-secrets.ps1` | Set 14+ GitHub Actions secrets via `gh` | 04 (origin must exist) | ~5 min |
| 7 | `deploy/.env.example` | Comprehensive bilingual env-var template | - | - |
| 8 | `deploy/_DELIVERY-NOTES.md` | This file | - | - |

Auto-generated at runtime:
- `deploy/prereqs-report.txt` (from 01)
- `deploy/secrets-set-manifest.txt` (from 05 - names only, no values)
- `deploy/logs/<step>-<timestamp>.log` (every script appends here)

---

## Per-file details

### 1. `deploy/README.md`
- Kurdish (sorani-transliterated) master guide.
- Sections: peshpeshe (prereqs), timeline, tomarkhanay scripts, hangawekan (step-by-step), troubleshooting, post-deploy.
- Every PowerShell invocation is quoted so the user can copy/paste verbatim.

### 2. `deploy/01-prereqs.ps1`
- Checks: `node` (>=20), `npm`, `python` (>=3.11), `git`, `gh`, `gcloud`, `vercel`, `docker` (optional).
- Login: `gh auth status`, `gcloud auth list`, `vercel whoami`.
- Env vars: warns (not fails) on missing `GH_TOKEN`, `GCP_PROJECT_ID`, `VERCEL_TOKEN`.
- Writes `prereqs-report.txt` (formatted ASCII table).
- Exit 0 = all hard-required pass; exit 1 = missing required tools or logins.
- **Manual ops:** none - read-only checks.

### 3. `deploy/02-install-and-build.ps1`
- Frontend: removes `node_modules`, runs `npm install --legacy-peer-deps --no-audit --no-fund`, `npm run build`, `npm run audit:lazy`, conditionally `npm run audit:bundle`.
- Backend: creates `venv` if missing, upgrades pip, `pip install -r requirements.txt`, **hotfix** `pip install python-json-logger` (called out by the P4 agent).
- Captures all stdout/stderr to `logs/build-<timestamp>.log`.
- Kurdish summary line at the end with OK/X for each side.
- Exit non-zero if either side fails.
- **Manual ops:** none - idempotent and resumable (already-installed venv is reused; node_modules is always re-created for clean build).

### 4. `deploy/03-run-tests.ps1`
- Frontend Vitest (twice - once for speed, once for coverage so `coverage/coverage-summary.json` exists for downstream scorecards).
- Frontend Playwright: installs chromium then runs `npm run nav:sweep` (fallback `playwright test --grep @smoke`).
- Backend: `pytest --cov=app --cov-report=xml --cov-report=term` -> `backend/coverage.xml`.
- Backend smoke: `python -c "from app.main import app; print(f'OK: {len(app.routes)} routes')"`.
- Summary table (Section / Passed / Failed / Skipped / Coverage%) plus a detailed step-by-step listing.
- Exit non-zero on any failure.
- **Manual ops:** none, but `02` must have completed first (venv + node_modules required).

### 5. `deploy/04-push-to-github.ps1`
- Args: `-RepoName "zoho"` (default), `-Branch "main"` (default), `-Message "..."` (optional override).
- Verifies `gh auth`, verifies remote `origin` matches `github.com/safaothman1631/<RepoName>` (offers to set/update).
- **Secret guard:** scans changed/staged files against `\.env`, `credentials\.json`, `\.pem`, `id_rsa`, `id_ed25519`, `serviceAccountKey`, `firebase-adminsdk*.json` patterns. **Refuses** to commit if any match (except `.env.example`).
- Stages everything (`git add -A`), prompts for commit message (default: `feat: world-class performance spec P0-P6 + validation framework`), commits, pushes.
- On success: prints commit URL, repo URL, Actions URL.
- On failure: passes the git exit code verbatim and prints common-fix hints.
- **Manual ops:** confirm the commit message at the prompt (Enter accepts default).

### 6. `deploy/05-setup-secrets.ps1`
- Verifies `gh auth status` and that we are inside a github-linked repo (`gh repo view`).
- Loads `deploy/.env.deploy` if present (gitignored - user populates manually). Strips inline `#` comments.
- For each of the 16 secrets, if value is in `.env.deploy` uses it directly; otherwise prompts via `Read-Host -AsSecureString` so the value never appears on screen or in process args.
- Pipes value to `gh secret set <NAME> --body -` (stdin, no argv exposure); falls back to `--body <value>` for older `gh` versions.
- Writes `secrets-set-manifest.txt` listing **names only** with `[SET]`/`[SKIPPED-REQUIRED]`/`[SKIPPED-OPTIONAL]`/`[FAILED]` tags. Values NEVER appear in logs or manifest.
- Secrets covered: `VITE_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `CLOUDRUN_URL`, `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `REDIS_URL`, `FIREBASE_PROJECT_ID`, `LOAD_TEST_TARGET_URL`, `LOAD_TEST_USER_EMAIL`, `LOAD_TEST_USER_PASSWORD`, `LOAD_TEST_TENANT_ID`.
- **Manual ops:** populate `deploy/.env.deploy` first (recommended) OR be ready to paste each value at the prompt.

### 7. `deploy/.env.example`
- Originally drafted minimal; **user/linter expanded to a comprehensive bilingual template** with sections for:
  - Frontend Vite (build-time)
  - Backend FastAPI runtime
  - Security (JWT, field encryption)
  - Observability (Sentry, OTEL, RUM/BigQuery)
  - Database (DATABASE_URL, migrations)
  - Firebase / Firestore
  - Deploy: GCP / Vercel
  - CI/CD secrets
  - Load testing
- Cross-references the exact source files where each var is read (config.py, observability/*, etc.).
- **Manual ops:** `Copy-Item deploy\.env.example deploy\.env.deploy` then fill in values. Make sure `.env.deploy` is in `.gitignore` (it should be already).

---

## Manual operations checklist (in order)

1. **Verify `.gitignore` covers `deploy/.env.deploy`** (one-time):
   ```powershell
   Get-Content C:\Users\SAFA\zoho\.gitignore | Select-String 'env.deploy'
   ```
   If absent, add:
   ```
   deploy/.env.deploy
   deploy/prereqs-report.txt
   deploy/secrets-set-manifest.txt
   deploy/logs/
   ```

2. **Enable PowerShell script execution** (one-time, per user):
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

3. **Run scripts in order** from `C:\Users\SAFA\zoho`:
   ```powershell
   .\deploy\01-prereqs.ps1
   .\deploy\02-install-and-build.ps1
   .\deploy\03-run-tests.ps1
   .\deploy\04-push-to-github.ps1 -RepoName "zoho"
   .\deploy\05-setup-secrets.ps1
   ```

4. **Populate `.env.deploy`** before step 5 (or paste interactively at the prompts).

5. **After step 5:** trigger the deploy workflow:
   ```powershell
   gh workflow run deploy.yml --ref main
   gh run watch
   ```

6. **Post-deploy verification:**
   ```powershell
   $url = gcloud run services describe backend --region me-central1 --format "value(status.url)"
   curl "$url/health"
   ```

---

## TODOs / known limitations

- [ ] **Cloud Run deploy script (`06-deploy-cloudrun.ps1`)** is NOT included - relies on `.github/workflows/deploy.yml` to do the Cloud Run deploy. If the workflow doesn't exist yet, add one or extend this kit.
- [ ] **Vercel link** must be done manually first (`vercel link` inside `frontend/`) to populate `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`. Then re-run 05 to push them as secrets.
- [ ] **Workload Identity Federation** setup is NOT scripted - follow https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines to create the provider and SA, then put the names in `.env.deploy`.
- [ ] **Firestore indexes** are not auto-deployed by this kit - apply via `gcloud firestore indexes create` or commit `firestore.indexes.json` and use `firebase deploy --only firestore:indexes`.
- [ ] **DATABASE_URL secret** is referenced in the expanded `.env.example` but is NOT in `05-setup-secrets.ps1`'s list - if you use Cloud SQL, add it to the secrets array in `05-setup-secrets.ps1` (lines 105-122).
- [ ] **PowerShell 5.1 vs 7+**: scripts use `#Requires -Version 5.1` and avoid `&&`/`$PSStyle` so they run on Windows PowerShell 5.1, but they are recommended to be run under PowerShell 7+ for better output encoding and UTF-8.
- [ ] **bash sandbox unavailable** during generation: scripts were authored without runtime testing. Smoke-test each one in a non-production checkout before going live.

---

## Security notes

- No script ever echoes secret values to console or log files.
- `Read-Host -AsSecureString` is used for all secret prompts.
- `gh secret set --body -` (stdin) is used so values never appear in process argv.
- `04-push-to-github.ps1` actively refuses to commit if it detects `.env`, `.pem`, `id_rsa`, `serviceAccountKey`, `credentials.json`, or `firebase-adminsdk*.json` in the changeset.
- `.env.example` is the only `.env*` file that may be committed (explicitly allowed by the secret-guard regex).

---

## Support

- Maintainer: Safa Othman (`safaothman1631@gmail.com`)
- Issues: https://github.com/safaothman1631/zoho/issues
- Generated by: Claude Code DevOps subagent, 2026-05-27.

---

## Part 2 — Production deploy kit (Cloud Run + Vercel)

> Added by the Production Deployment specialist agent. Picks up where step 05
> leaves off and takes you from "secrets are in GitHub" all the way to "live on
> production with full observability".

### File manifest — Part 2

| # | File | Purpose | Depends on | Runtime |
|---|------|---------|------------|---------|
| 9  | `deploy/06a-setup-gcp-resources.ps1`  | One-time GCP setup: APIs, Artifact Registry, Firestore, Memorystore Redis, Secret Manager seeds, BigQuery RUM, WIF pool/provider, deployer service account. | 01 prereqs (`gcloud` + auth) | ~10-15 min (first run) |
| 10 | `deploy/06-deploy-cloudrun.ps1`       | Build container via Cloud Build + deploy to Cloud Run me-central1. Captures URL to `cloudrun-url.txt`. Optionally tags Sentry release. | 06a + 05 secrets | ~5-8 min |
| 11 | `deploy/07a-setup-vercel-project.ps1` | One-time Vercel: link `frontend/` to project, seed production env vars, print org/project IDs for GitHub. | 01 prereqs (`vercel` CLI + login) | ~3 min |
| 12 | `deploy/07-deploy-vercel.ps1`         | Push frontend to Vercel `--prod`. Reads `cloudrun-url.txt` and sets `CLOUDRUN_URL` env. Captures URL to `vercel-url.txt`. Smoke-checks the deployed URL. | 06 + 07a | ~3-5 min |
| 13 | `deploy/08-smoke-test-production.ps1` | Critical path tests (backend `/api/health`, `/api/version`, `/api/ready`; frontend `/`, `/login`, `/manifest.webmanifest`, immutable cache headers); HTTP/2; production-reality-probe.mjs; optional k6 30s 5 VU; optional Lighthouse via CLI. Writes md report. | 06 + 07 | ~2-5 min |
| 14 | `deploy/09-post-deploy-checklist.ps1` | Operator final checklist — 12 items printed bilingually with verify commands + GCP console URLs. `-OpenBrowser` opens every console URL. | 06 + 07 (URLs in saved txt) | ~1 min |
| 15 | `deploy/TROUBLESHOOTING.md`           | 12 common deploy failures + fixes (build, Cloud Run cold-start, Vercel rewrites, Sentry DSN, WIF auth, Firestore indexes, etc.) | - | - |
| 16 | `.github/workflows/deploy-production.yml` | (already in repo via sister-agent / pre-existing) — auto-deploys main → backend + frontend, runs smoke + scorecard, tags Sentry. **Concurrency group `production-deploy`** prevents racing pushes. | 05 secrets | ~15-20 min end-to-end |

Auto-generated at runtime:
- `deploy/cloudrun-url.txt`             (written by 06)
- `deploy/vercel-url.txt`               (written by 07)
- `deploy/gcp-resources-manifest.json`  (written by 06a)
- `deploy/logs/cloudrun-deploy-*.log`   (06)
- `deploy/logs/gcp-setup-*.log`         (06a)
- `deploy/logs/vercel-deploy-*.log`     (07)
- `deploy/logs/vercel-setup-*.log`      (07a)
- `deploy/logs/smoke-*.log` + `smoke-*.md` (08)

### Per-file details — Part 2

#### 9. `deploy/06a-setup-gcp-resources.ps1`
- **One-time** GCP project bootstrap. Idempotent — re-running detects already-created resources.
- Enables: Cloud Run, Cloud Build, Artifact Registry, Firestore, Cloud Trace, Secret Manager, Logging, Monitoring, BigQuery, Redis, IAM, IAMCredentials, STS.
- Creates Artifact Registry repo `zoho-images` in `me-central1`.
- Creates Firestore native database in `me-central1` (or no-op if exists).
- Creates Memorystore Redis 1 GB basic — **gated behind `-Confirm` (cost ~$50/mo).**
- Creates 3 Secret Manager secrets (`zoho-secret-key`, `zoho-sentry-dsn`, `zoho-redis-url`) without versions. Prints the `gcloud secrets versions add` commands the operator must run with real values.
- Creates BigQuery dataset `rum` + table `vitals_raw` (partitioned by `ts` day, clustered on `tenant_id, metric`) per design.md §9.1.
- Creates `github-deployer@<project>.iam.gserviceaccount.com` SA + binds 6 roles (`run.admin`, `iam.serviceAccountUser`, `artifactregistry.writer`, `secretmanager.secretAccessor`, `cloudbuild.builds.editor`, `storage.admin`).
- Creates WIF pool `github-pool` + OIDC provider `github-provider`. Prints the `projects/<num>/.../providers/github-provider` resource path for the `GCP_WIF_PROVIDER` GH secret.
- If `-GithubRepo OWNER/REPO` passed, binds the principalSet to the SA automatically; otherwise prints the binding command for manual run.
- Saves all created resources to `deploy/gcp-resources-manifest.json`.
- **Manual ops:** after running, the operator must:
  1. Run the `gcloud secrets versions add` commands for each secret with real values.
  2. (If `-GithubRepo` not passed) run the printed `iam.workloadIdentityUser` binding.
  3. Save `GCP_PROJECT_ID`, `GCP_SA_EMAIL`, `GCP_WIF_PROVIDER` into GitHub via `gh secret set` (sister-agent's `05-setup-secrets.ps1` covers most of these; manifest gives the exact values).

#### 10. `deploy/06-deploy-cloudrun.ps1`
- Args: `-Project` (required), `-ServiceName` (default `zoho-erp-backend`), `-Region me-central1`, `-MinInstances 1`, `-MaxInstances 20`, `-Memory 1Gi`, `-Cpu 2`, `-Tag` (defaults to ISO timestamp), `-Confirm` (required if MinInstances>0).
- Pre-flight: verifies `gcloud` installed + authenticated + project matches; enables required APIs if not on.
- **Cost guard:** refuses to run if `MinInstances > 0` without `-Confirm` (prints ~$30-50/mo warning).
- Builds via `gcloud builds submit --tag <Artifact Registry URI> --timeout 20m` from repo root.
- Deploys with `--port 8080` (matches `Dockerfile` CMD), `--cpu-throttling=false`, `--execution-environment gen2`, `--concurrency 80`.
- Sets env vars: `ENVIRONMENT=production`, `APP_VERSION=$Tag`, `FIREBASE_PROJECT_ID=$Project`, `RATE_LIMITING_ENABLED=true`, `RUN_MIGRATIONS_ON_BOOT=true`.
- Sets secrets: `SECRET_KEY`, `SENTRY_DSN`, `REDIS_URL` from Secret Manager `:latest`.
- Captures `status.url`, writes to `deploy/cloudrun-url.txt`.
- Optional Sentry release tag if `SENTRY_AUTH_TOKEN` env set + WSL/bash available (calls `scripts/sentry-release-tag.sh`).
- **Manual ops:** none if 06a ran successfully. Re-running deploys a new revision.

#### 11. `deploy/07a-setup-vercel-project.ps1`
- **One-time** Vercel link + env setup. Idempotent (removes-then-adds env vars).
- Verifies `vercel whoami` (or `VERCEL_TOKEN` env).
- Runs `vercel link --project <name> --yes` inside `frontend/`.
- Reads `frontend/.vercel/project.json` to extract `orgId` + `projectId` — prints them for GitHub secret setup.
- Seeds production env vars: `CLOUDRUN_URL`, `VITE_API_BASE_URL`, `VITE_SENTRY_DSN` (if env present), `VITE_APP_VERSION`.
- **Manual ops:** in Vercel dashboard, the operator should verify:
  - Framework Preset: Vite
  - Root Directory: `frontend`
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - Install Command: `npm install --legacy-peer-deps`
  (vercel.json overrides most of these; dashboard settings are a backstop.)

#### 12. `deploy/07-deploy-vercel.ps1`
- Args: `-ProjectName`, `-CloudrunUrl` (defaults to `deploy/cloudrun-url.txt`), `-VercelToken` (env fallback).
- Pre-flight: verifies `vercel` CLI + auth.
- Idempotently sets env vars `CLOUDRUN_URL`, `VITE_API_BASE_URL`, optional `VITE_SENTRY_DSN`, `VITE_APP_VERSION`, `RUM_BIGQUERY_DATASET`.
- Runs `vercel --prod --yes` from `frontend/`.
- Extracts deployed URL from CLI output, saves to `deploy/vercel-url.txt`.
- Smoke check: `Invoke-WebRequest` against root, verifies HTTP 200 + `<div id="root">` present.
- **Manual ops:** none. Re-running creates a new Vercel deployment.

#### 13. `deploy/08-smoke-test-production.ps1`
- Args: `-FrontendUrl`, `-BackendUrl` (both auto-read from `deploy/*-url.txt` if missing); `-SkipLoadTest`, `-SkipLighthouse`.
- Runs **9 critical checks** (most critical=hard fail):
  - Backend: `/api/health`, `/api/version`, `/api/ready`.
  - Frontend: `/`, `/login`, `/manifest.webmanifest`, asset `Cache-Control: immutable`.
  - HTTP/2 active via `curl --http2`.
  - `scripts/production-reality-probe.mjs` with `PROBE_TARGET_URL`.
- Optional: k6 30s 5 VU against `load/k6-suite/dashboard.js`, extracts p95.
- Optional: Sentry release verification via API if `SENTRY_AUTH_TOKEN` set.
- Optional: Lighthouse CLI if installed.
- Writes `deploy/logs/smoke-<ts>.md` markdown report with table of all checks.
- Exits non-zero if any **critical** check fails (non-critical failures logged only).
- **Manual ops:** none if k6/Lighthouse missing — script degrades gracefully.

#### 14. `deploy/09-post-deploy-checklist.ps1`
- Prints 12-item bilingual operator checklist:
  1. Cloud Run min-instances=1 verified.
  2. Min/max/CPU/memory match spec.
  3. Firestore rules deployed.
  4. Firestore indexes deployed.
  5. 6 Cloud Monitoring dashboards exist.
  6. Alerts wired to Slack/email.
  7. Backup job scheduled + verified.
  8. DNS pointed at Vercel/Cloud Run.
  9. TLS certs issued.
  10. CSP Report-Only for first 14 days.
  11. Sentry release tagged.
  12. Initial scorecard regenerated.
- Each item has a verify command + a GCP/Vercel/Firebase console URL.
- `-OpenBrowser` flag launches each URL via `Start-Process`.
- **Manual ops:** the operator manually checks each box.

#### 15. `deploy/TROUBLESHOOTING.md`
- 12 sections covering the most likely failures:
  npm peer-dep / vite-plugin-pwa types / i18n.config import / Cloud Run cold-start /
  Vercel "no framework" / 502 on `/api/*` / Sentry DSN missing / 401 every request /
  Workbox SW not registering / `gh secret set` 401 / `gcloud builds submit` permission /
  WIF auth fails / Firestore "index needed" / Cloud Run health check fail.
- Every fix is a copy-pasteable PowerShell or `gcloud` command.

#### 16. `.github/workflows/deploy-production.yml`
- (Already in repo — confirmed present, not overwritten.)
- 7 jobs: `ci-gate` (waits for ci.yml + ci-quality.yml green) → `bundle-budget-gate` (shell ≤ 350 KB) → `deploy-backend` (Cloud Build + blue/green via `scripts/deploy-bluegreen.sh`) → `deploy-frontend` (Vercel via `amondnet/vercel-action@v25`) → `smoke-test` (probe + k6 30s) → `post-deploy-scorecard` (regenerate + sticky-comment) → `summary` (always runs).
- Uses WIF auth for GCP; reads `GCP_WIF_PROVIDER` + `GCP_SERVICE_ACCOUNT` secrets.
- Concurrency group `production-deploy`, `cancel-in-progress: false`.
- Tags Sentry release for backend + frontend separately.

### Manual operations — Part 2

The Part 1 checklist gets you to "secrets are in GitHub". Part 2 picks up here:

1. **GCP project setup** (once per project):
   ```powershell
   .\deploy\06a-setup-gcp-resources.ps1 -Project <gcp-project-id> -GithubRepo safaothman1631/zoho -Confirm
   # Then add real values to each Secret Manager secret as printed.
   ```

2. **Vercel project link** (once):
   ```powershell
   .\deploy\07a-setup-vercel-project.ps1 -ProjectName zoho-kurdish-erp -CloudrunUrl <url-or-empty>
   # Note the printed VERCEL_ORG_ID, VERCEL_PROJECT_ID — feed back to 05-setup-secrets.ps1
   ```

3. **First production deploy** (manual, before enabling auto-deploy on push):
   ```powershell
   .\deploy\06-deploy-cloudrun.ps1 -Project <gcp-project-id> -Confirm
   .\deploy\07-deploy-vercel.ps1
   ```

4. **Verify** the deploy:
   ```powershell
   .\deploy\08-smoke-test-production.ps1
   .\deploy\09-post-deploy-checklist.ps1 -OpenBrowser
   ```

5. **Enable auto-deploy** by merging to `main` — `.github/workflows/deploy-production.yml` takes over.

### Master flow diagram

```
+--------------------------------------------------------------------------+
|                      Local machine (Windows / PS 7+)                     |
|                                                                          |
|  01-prereqs ──> 02-install-and-build ──> 03-run-tests                    |
|                                              |                           |
|                                              v                           |
|                                       04-push-to-github                  |
|                                              |                           |
|                                              v                           |
|                                       05-setup-secrets ─────┐            |
|                                                             |            |
|     ONE-TIME GCP/VERCEL SETUP (rare; only when bootstrap)   |            |
|     06a-setup-gcp-resources                                 |            |
|     07a-setup-vercel-project                                |            |
|                                              |              |            |
|                                              v              v            |
|     FIRST MANUAL PROD DEPLOY (or whenever auto-deploy off):              |
|     06-deploy-cloudrun  ──>  07-deploy-vercel                            |
|                                              |                           |
|                                              v                           |
|     08-smoke-test-production  ──>  09-post-deploy-checklist              |
+--------------------------------------------------------------------------+
                                              |
                                              v
+--------------------------------------------------------------------------+
|              Steady-state: GitHub Actions on push → main                 |
|                                                                          |
|  ci.yml + ci-quality.yml  ─green─>  deploy-production.yml                |
|                                            |                             |
|                                  ci-gate -> bundle-budget-gate           |
|                                            |                             |
|                                            v                             |
|                                  deploy-backend (Cloud Run blue/green)   |
|                                            |                             |
|                                            v                             |
|                                  deploy-frontend (Vercel --prod)         |
|                                            |                             |
|                                            v                             |
|                                  smoke-test  ──>  scorecard ──> summary  |
+--------------------------------------------------------------------------+
```

### Dependencies between Part 1 and Part 2 scripts

- **06a depends on**: 01 (gcloud installed + authenticated).
- **06 depends on**: 06a (secrets exist in Secret Manager, even if empty), 05 (GitHub secrets for CI), Dockerfile at repo root.
- **07a depends on**: 01 (vercel CLI installed + authenticated).
- **07 depends on**: 06 (writes `cloudrun-url.txt`), 07a (vercel project linked, env vars seeded).
- **08 depends on**: 06 + 07 (both URLs saved in `deploy/*-url.txt`).
- **09 depends on**: 06 + 07 (URLs in saved txt), 06a (`gcp-resources-manifest.json` for project ID).
- **`.github/workflows/deploy-production.yml` depends on**: 05 (GitHub secrets), 06a (WIF + SA), 07a (Vercel project IDs).

### Cost summary

Running the full Part 2 chain costs (in production posture):
| Resource | Approx monthly |
|---|---|
| Cloud Run (min-instances=1, 2 CPU, 1 GiB) | ~$30-50 |
| Memorystore Redis 1 GB basic | ~$50 |
| Firestore (light usage) | < $5 |
| BigQuery (light RUM) | < $5 |
| Artifact Registry storage | < $5 |
| **Total (GCP)** | **~$90-115/mo** |
| Vercel Pro (optional) | $20/seat |
| Sentry Team plan | $26/mo |

All cost-incurring resources are gated behind `-Confirm` flags.

### Security notes — Part 2

- No deploy script ever prints secret VALUES — only secret NAMES and metadata.
- WIF (Workload Identity Federation) used in GitHub Actions — **no long-lived SA keys**.
- Secret Manager secrets are mounted into Cloud Run via `--set-secrets`, not env vars on disk.
- Cloud Run service is `--allow-unauthenticated` so Vercel can proxy; **all auth is done inside the FastAPI app** (JWT middleware).
- CSP starts as `Report-Only` for 14 days (per `vercel.json`); switch to enforcing after burn-in.
- Sentry release tagging skips gracefully if `SENTRY_AUTH_TOKEN` missing.

### Known limitations — Part 2

- **Cloud Run port**: Dockerfile uses `8080` (the GCP default), not `8000` as stated in the prompt. Scripts use `8080` to match the actual Dockerfile.
- **`backend/main.py` lookup**: the Dockerfile expects `backend/app/main.py` to exist (CMD references `app.main:app`). If the backend is laid out differently, `06-deploy-cloudrun.ps1` will succeed at building but fail at the Cloud Run health probe — see TROUBLESHOOTING §12.
- **k6 + Lighthouse optional**: `08-smoke-test-production.ps1` degrades gracefully if these CLIs aren't installed locally. CI has them via `grafana/setup-k6-action`.
- **`deploy-production.yml` references `scripts/deploy-bluegreen.sh`** which already exists in the repo. If you replace it, keep the `(service, sha, region, project)` arg shape.
- **No rollback script** — to roll back, use `gcloud run services update-traffic <service> --to-revisions <prev>=100 --region me-central1` manually. A future `10-rollback.ps1` should automate this.

---

## Part 3 — CI/CD glue, env template, operator docs (CI/CD Specialist agent)

> Added by the CI/CD Specialist subagent. Owns the GitHub Actions workflows
> for deploy/preview/scorecard, the comprehensive `.env.example`, and the
> operator-facing docs (verification, runbook, checklist, flow diagram).

### File manifest — Part 3

| # | File | Purpose | Depends on | Runtime |
|---|------|---------|------------|---------|
| 17 | `deploy/.env.example`                       | Comprehensive bilingual env-var template. 6 sections (FE build-time, BE runtime, GCP deploy, Vercel deploy, CI secrets, optional features). Every var cross-referenced to the code that reads it. (Replaces the prior 45-line placeholder.) | - | - |
| 18 | `.github/workflows/deploy-production.yml`   | Canonical 7-job production deploy: ci-gate, bundle-budget-gate (shell ≤ 350 KB + 100% lazy), deploy-backend (Cloud Build → Cloud Run blue/green), deploy-frontend (Vercel `--prod`), smoke-test (`production-reality-probe.mjs` + k6 30 s), post-deploy-scorecard (sticky issue comment), summary. Triggers on push to `main` + `workflow_dispatch`. Concurrency `production-deploy`, `cancel-in-progress: false`. | 05 secrets + 06a GCP + 07a Vercel | ~14 min |
| 19 | `.github/workflows/preview-deploy.yml`      | PR-time Vercel preview. Builds frontend on PR HEAD, deploys preview (no `--prod`), posts a sticky comment with preview URL + one-line scorecard blurb. Backend stays on prod (via vercel.json rewrite). | secrets (VERCEL_*, VITE_SENTRY_DSN) | ~5 min per PR |
| 20 | `.github/workflows/scorecard-on-pr.yml`     | Lightweight maintainability delta on every PR. Builds main + HEAD, compares shell-KB / total-KB / file-count / lint-count, sticky comment with green/red arrows. Non-blocking. | - | ~8 min per PR |
| 21 | `deploy/POST-DEPLOY-VERIFICATION.md`        | Day-1 ops playbook. 10 sections: URL discovery, immediate checks, Cloud Run verify, Vercel verify, /api proxy verify, Sentry deliberate-error test, RUM (browser → logs → BQ), backup cron, DR drill, Slack/email alert wiring, sign-off checklist. EN + KU. | 06 + 07 (URLs) | ~30 min walk-through |
| 22 | `deploy/RUNBOOK-FIRST-INCIDENT.md`          | Incident playbook. 10 sections: signs, SEV tiers, first-5-min rollback (Cloud Run + Vercel + Slack template), Sentry triage, RUM regression detection, user statements, postmortem template, rollback one-liners, escalation tree, don'ts. | - | reference doc |
| 23 | `deploy/CHECKLIST.md`                       | Single-page printable checklist. 14 GH secrets + 8 Secret Manager secrets explicitly enumerated. One-time setup + every-deploy + post-deploy sections. Signature block. | - | reference doc |
| 24 | `deploy/DEPLOY-FLOW.md`                     | Visual ASCII flow diagram. Big-picture (one-time → every-deploy → post-deploy), per-step ownership/duration/artifacts table, failure branches, side workflows, data flow (browser → RUM/Sentry → BQ/Sentry → Slack), cost table, glossary. | - | reference doc |

### Coordination with sister agents

- **`.env.example` overlap (file #7 / file #17):** I replaced the placeholder with a comprehensive version. The variable names Agent A's `05-setup-secrets.ps1` reads still all exist in my expanded template; I only added more vars (RUM_*, OTEL_*, FIELD_ENCRYPTION_KEY, SMTP_*, optional WhatsApp/OCR, etc.).
- **`deploy-production.yml` overlap (file #16 / file #18):** Part 2's manifest claims this file was "already in repo via sister-agent / pre-existing." Verified — when I started, the file did NOT exist (only `deploy-cloudrun.yml` did). I produced the canonical version. The 7-job structure matches Part 2's description exactly, so Agent B can reference my YAML rather than ship a duplicate.
- **`deploy/_DELIVERY-NOTES.md`:** I appended this Part 3 after Parts 1 and 2 without touching their content.

### Dependencies on existing scripts

The new workflow YAMLs reference scripts that already exist in the repo (verified):
- `scripts/deploy-bluegreen.sh`
- `scripts/sentry-release-tag.sh`
- `scripts/production-reality-probe.mjs`
- `scripts/world-class-scorecard.mjs`

Optional (workflow degrades gracefully if missing):
- `load/k6-suite/dashboard.js` — emits a warning rather than failing.

### Operator first-time setup sequence (canonical)

1. `deploy\01-prereqs.ps1` (Agent A)
2. `deploy\06a-setup-gcp-resources.ps1 -Project <id> -GithubRepo <owner>/<repo> -Confirm` (Agent B)
3. `deploy\07a-setup-vercel-project.ps1 -ProjectName <name>` (Agent B)
4. Populate `deploy\.env.deploy` from `deploy\.env.example` (Part 3 — comprehensive template covers everything).
5. `deploy\05-setup-secrets.ps1` (Agent A) — sets GH secrets + Secret Manager values.
6. `deploy\02-install-and-build.ps1` → `deploy\03-run-tests.ps1` → `deploy\04-push-to-github.ps1` (Agent A)
7. **Wait for CI:** `ci.yml`, `ci-quality.yml`, then my `deploy-production.yml` run to green automatically on push to main.
8. After the first auto-deploy, update Vercel's `CLOUDRUN_URL` env var with the value from `deploy\cloudrun-url.txt`; redeploy frontend once for the rewrite to take effect.
9. `deploy\08-smoke-test-production.ps1` (Agent B) — operator-side smoke.
10. `deploy\09-post-deploy-checklist.ps1` (Agent B) → walk through `deploy\CHECKLIST.md` Part C (Part 3).
11. Complete §§5–9 of `deploy\POST-DEPLOY-VERIFICATION.md` (Part 3): Sentry deliberate error, RUM verification, backup cron, DR drill, alert wiring.
12. Print `deploy\CHECKLIST.md`, sign, file.

For every subsequent deploy: skip steps 1–5 (one-time); start at step 6.

For incidents: `deploy\RUNBOOK-FIRST-INCIDENT.md` — first action is always "roll back, then debug."

For PRs: `preview-deploy.yml` + `scorecard-on-pr.yml` run automatically and post sticky comments — no operator action needed.

### Known gotchas / TODOs added by Part 3

1. **Repo variable `SCORECARD_ISSUE_NUMBER`** — `deploy-production.yml`'s post-deploy-scorecard job posts to issue #1 by default. Create a sticky tracking issue (titled e.g. "Production scorecard — rolling") and set `gh variable set SCORECARD_ISSUE_NUMBER --body <issue-number>`.
2. **Repo variable `RUM_BIGQUERY_DATASET`** — used by the scorecard job to query live RUM data. Set with `gh variable set RUM_BIGQUERY_DATASET --body rum` (or your dataset name).
3. **`amondnet/vercel-action@v25`** — pinned for stability. Re-check quarterly for newer maintained versions.
4. **`DATABASE_URL` Secret Manager** — I added `--set-secrets DATABASE_URL=zoho-database-url:latest` to the workflow. Confirm Agent B's `06a` creates this secret, or remove this entry if the backend reads `DATABASE_URL` from a different source.
5. **`FIELD_ENCRYPTION_KEY` Secret Manager** — added to `--set-secrets` (the backend's `crypto.py` reads it). Confirm Agent B's `06a` creates `field-encryption-key`.
6. **Sentry test endpoint** — `POST /api/_sentry/boom` referenced in POST-DEPLOY-VERIFICATION §5 is dev-only by default. For prod verification without redeploying, use a real validation-error path instead (e.g. POST an invalid invoice payload).
7. **First deploy chicken-and-egg** — the GH secret `CLOUDRUN_URL` is empty before the first deploy. The smoke-test job uses `needs.deploy-backend.outputs.service_url` instead of the secret, so this works on the first run.

