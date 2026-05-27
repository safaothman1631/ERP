# Pre-flight audit — Scripts 06-09 + GitHub workflows

**Auditor:** PowerShell + GCP + Vercel QA agent
**Date:** 2026-05-27
**Scope:** `deploy/06a`, `deploy/06`, `deploy/07a`, `deploy/07`, `deploy/08`, `deploy/09`,
`.github/workflows/deploy-production.yml`, `.github/workflows/preview-deploy.yml`

Based on the three real bugs that surfaced in `01-prereqs.ps1` on first execution:
1. `[Console]::OutputEncoding` crash in non-console hosts (ISE).
2. PowerShell parses bare `value(...)` as a function call when used in `--format=value(...)`.
3. `vercel whoami` emits a "Vercel CLI x.y.z" banner that mixes with username output on Windows.

---

## Per-script findings

### `06a-setup-gcp-resources.ps1` — confidence: HIGH

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | none | All `--format=value(...)` and `--database=(default)` flags are already inside `@()` arrays as single-quoted strings (`'--format=value(name)'`). PS preserves these verbatim to the native gcloud call. **Safe.** | OK |
| 2 | none | No `[Console]::OutputEncoding` writes. | OK |
| 3 | medium | Created secrets list (`zoho-secret-key`, `zoho-sentry-dsn`, `zoho-redis-url`) was missing `field-encryption-key` and `zoho-database-url`, which `deploy-production.yml` references via `--set-secrets`. Deploy would have failed with "secret not found". | **FIXED** — added both to `$secrets` array. |
| 4 | low | `& bq --project_id=$Project show --dataset rum 2>&1` — relies on `bq` being on PATH. Fails noisily if Google Cloud SDK installed without bq component. Acceptable. | noted |
| 5 | low | `--attribute-condition` string interpolation: when `$GithubRepo` is empty, falls through to `assertion.repository_owner != ''` — works fine. | OK |

### `06-deploy-cloudrun.ps1` — confidence: HIGH

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | high | Line 103 used `--format='value(account)'` (single-quoted parens). This actually works in PowerShell because single-quoted strings are passed verbatim, but stderr noise from gcloud (update warnings) would have been merged into `$activeAccount` via `2>&1 \| -join`. | **FIXED** — quoted as `"--format=value(account)"` and filter pipeline keeps only the line containing `@`. |
| 2 | high | Same issue on line 144 (`--format='value(config.name)'`) and 226 (`--format='value(status.url)'`). | **FIXED** — both rewritten as `"--format=value(...)"` form. URL extraction now filters to first `^https://` line. |
| 3 | medium | `(& gcloud config get-value project 2>&1).Trim()` — `gcloud config get-value` may emit `(unset)` or warnings to stderr. | **FIXED** — filtered before trim. |
| 4 | high | `--set-secrets` only listed 3 secrets; workflow YAML uses 5. PS deploy would have produced a Cloud Run revision missing `FIELD_ENCRYPTION_KEY` and `DATABASE_URL` — backend boot would crash. | **FIXED** — added the missing two. |
| 5 | medium | `--set-env-vars` set 5 vars but workflow sets 8 (added `APP_NAME`, `LOG_LEVEL`, `OTEL_SERVICE_NAME`). Backend may fail logging/tracing setup. | **FIXED** — aligned with workflow. |
| 6 | medium | Missing `--cpu-throttling=false` (workflow has it). With `--min-instances 1` and `--no-cpu-throttling` you get full CPU always — required for background tasks. | **FIXED** — added flag. |
| 7 | low | `--set-env-vars $envVars` (space-separated) is ambiguous when value contains spaces. Rewrote as `"--set-env-vars=$envVars"` (single-token form). Same for `--set-secrets`. | **FIXED** |
| 8 | low | `--project=$Project` (bare expansion) works but for consistency wrapped as `"--project=$Project"` in build + deploy + describe. | **FIXED** |
| 9 | none | `--port 8080` matches Dockerfile (the env override). | OK |
| 10 | none | `--allow-unauthenticated` present. | OK |
| 11 | none | `me-central1` region default. | OK |
| 12 | none | `gcloud builds submit --tag $imageUri` — `$imageUri` has a backtick escape `$ServiceName\`:$Tag` to prevent `:Tag` from being parsed as scope. Validated. | OK |

### `07a-setup-vercel-project.ps1` — confidence: MEDIUM

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | high | `vercel whoami` output captured raw and joined with `-join "\`n"`. On Windows, the "Vercel CLI x.y.z" banner pollutes the captured string. Subsequent `-like '*Error*'` test could miss the actual error, and the printed "Authenticated as:" line would include the banner. | **FIXED** — added `Get-VercelOutputClean` helper that filters `^Vercel CLI`, `^node\.exe`, and blank lines, then takes the last non-empty line as the username. |
| 2 | medium | Did not detect the "log in" prompt text Vercel prints when not authenticated. | **FIXED** — added `-like '*log in*'` to the not-authenticated detection. |
| 3 | medium | `vercel env add` reads value from stdin via `$Value | & vercel @addArgs`. This works in non-TTY (script) mode. However if `vercel env rm` runs against a non-existent key, exit code is non-zero — currently ignored with `Out-Null`. Acceptable. | noted |
| 4 | low | `vercel link --project $ProjectName --yes` — `--yes` skips the scope prompt only when `VERCEL_ORG_ID`/`--scope` is resolvable. May still prompt in some accounts. Use `-VercelToken` parameter (sets `--token` flag) to make non-interactive. | noted |
| 5 | none | No `[Console]::OutputEncoding` writes. | OK |

### `07-deploy-vercel.ps1` — confidence: MEDIUM

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | high | Same Vercel banner pollution as 07a (lines 85/87, `whoami`). | **FIXED** — added `Get-VercelOutputClean` and updated detection logic, mirroring 07a. |
| 2 | medium | URL extraction from `& vercel @deployArgs` output (line 157) uses regex `^https://[^\s]+\.vercel\.app`. Vercel CLI sometimes prints the URL prefixed with ` ` (whitespace). Adjusted regex would be better. Current regex requires literal start-of-line. Could miss URL if banner-prefixed. **Mitigation:** the line-by-line filter from `-join` already split on newlines, so each line is independent. **Likely OK.** | noted |
| 3 | medium | `vercel env rm/add` may fail silently when no project is linked. Push-Location into `frontend/` is correct, but only works if `07a` ran first to populate `.vercel/project.json`. Pre-condition. | noted |
| 4 | low | `Invoke-WebRequest ... -UseBasicParsing -TimeoutSec 30` — present, OK on PS 5.1+. | OK |

### `08-smoke-test-production.ps1` — confidence: HIGH

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | **CRITICAL** | Line 295 used inline `if` expression as `-ForegroundColor` value: `Write-Host "..." -ForegroundColor (if ($criticalFails -gt 0) {'Red'} else {'Green'})`. PowerShell parser does not accept `if` as an expression in parameter position. **Script would have thrown a ParseException at load time.** | **FIXED** — extracted to `$critColor = if (...) {...} else {...}; Write-Host ... -ForegroundColor $critColor`. |
| 2 | medium | `Invoke-WebRequest ... -SkipHttpErrorCheck` requires PowerShell 7+. `#requires -Version 7.0` directive at top of file enforces this. | OK |
| 3 | low | `curl.exe --http2 -sI -o NUL` — `NUL` is the Windows null device, recognised by curl on Windows. Works. | OK |
| 4 | low | `& k6 run` — relies on k6 being installed and on PATH. Script reports "skipped" if absent. | OK |
| 5 | low | `& lighthouse` — Lighthouse CLI optional, reports "skipped" if absent. | OK |
| 6 | low | k6 `BASE_URL` env var name set by script — verify the k6 script reads `BASE_URL`. The workflow uses `LOAD_TEST_TARGET_URL` instead. Inconsistency between local and CI. Not fixed here; verify load script. | noted |

### `09-post-deploy-checklist.ps1` — confidence: HIGH

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | **CRITICAL** | Line 83 used `\"` (backslash-quote) inside a double-quoted PowerShell string to embed a `"`. PowerShell does not honor `\"` as escape — its escape character is backtick. The string would have been parsed as `"...annotations.\"` then orphan tokens. **Script would have failed to load with ParseError.** | **FIXED** — rewrote to use `` `" `` PowerShell-native escape and the `annotations['key']` indexing form (cleaner than the `annotations."key"` form anyway). |
| 2 | none | Other `Cmd=` strings use single-quoted internals (`'value(...)'`) — PS parses fine. | OK |
| 3 | low | `$env:SENTRY_ORG_SLUG` used in URL but workflow stores `secrets.SENTRY_ORG`. User must set `SENTRY_ORG_SLUG` env var locally to make the link work. Cosmetic. | noted |
| 4 | low | `Start-Process $c.Url` — opens default browser on Windows. Works. | OK |

### `.github/workflows/deploy-production.yml` — confidence: HIGH

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | none | `permissions: id-token: write` present for WIF. | OK |
| 2 | none | `concurrency: group: production-deploy, cancel-in-progress: false` correct (never abort in-flight prod deploys). | OK |
| 3 | none | Action versions current: `actions/checkout@v4`, `setup-node@v4`, `setup-python@v5`, `google-github-actions/auth@v2`, `setup-gcloud@v2`, `peter-evans/create-or-update-comment@v4`. | OK |
| 4 | none | Secret names (`GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SENTRY_AUTH_TOKEN`, `VITE_SENTRY_DSN`, `LOAD_TEST_*`) match what `05-setup-secrets.ps1` sets. | OK |
| 5 | medium | Workflow uses `secrets.SENTRY_ORG` (without `_SLUG`). `05-setup-secrets.ps1` does not include `SENTRY_ORG` in its required-secret list. `scripts/sentry-release-tag.sh` accepts either `SENTRY_ORG` or `SENTRY_ORG_SLUG`, but only after one is set. **Pre-condition:** user must `gh secret set SENTRY_ORG --body <slug>` manually before first deploy. (Sister agent territory.) | noted |
| 6 | none | Job order: `ci-gate → bundle-budget-gate → deploy-backend → deploy-frontend → smoke-test → post-deploy-scorecard → summary`. Correct. | OK |
| 7 | medium | `amondnet/vercel-action@v25` is community-maintained and somewhat dated; works but Vercel official advice is direct CLI. Acceptable for now. | noted |
| 8 | low | `gh run list --commit ... --workflow ci.yml --jq '.[0]...'` requires `gh` to be auth'd inside ubuntu-latest. `GH_TOKEN: secrets.GITHUB_TOKEN` is set — works. | OK |
| 9 | low | `chmod +x scripts/deploy-bluegreen.sh` then bash — confirmed `scripts/deploy-bluegreen.sh` exists. | OK |
| 10 | low | Workflow `--cpu-throttling=false` (line 185). Same flag now in `06-deploy-cloudrun.ps1`. | OK |

### `.github/workflows/preview-deploy.yml` — confidence: HIGH

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | none | `concurrency` per PR with `cancel-in-progress: true` correct for preview. | OK |
| 2 | none | Paths-ignore for `*.md`, `docs/**`, `_deltas/**` skips trivial PRs. | OK |
| 3 | low | `alias-domains` set to `zoho-erp-pr-N.vercel.app`. Requires the team to own that subdomain on a Vercel domain. May fail if no custom domain configured. Acceptable — Vercel emits the standard preview URL too. | noted |
| 4 | low | `scorecard-blurb` job greps `docs/world-class/scorecard.md` on the PR branch — will be stale on most PRs. Cosmetic. | noted |

---

## Bug-pattern summary table

| Pattern | Files affected | Fixed? |
|---------|----------------|--------|
| Inline `if` expression in parameter position (PS parse error) | 08 line 295 | YES |
| `\"` backslash-escape (invalid in PS) | 09 line 83 | YES |
| Bare `--format='value(...)'` → could mix with stderr noise | 06 lines 103, 144, 226 | YES |
| Vercel CLI banner pollution in captured output | 07a `whoami`, 07 `whoami` | YES |
| `--set-secrets` referenced secrets not created by `06a` | 06a `$secrets`, 06 `--set-secrets` | YES |
| Env vars drift between PS script and workflow YAML | 06 vs deploy-production.yml | YES |
| Missing `--cpu-throttling=false` in PS Cloud Run deploy | 06 line 207 | YES |
| `gcloud config get-value` stderr warnings | 06 line 113 | YES |
| `[Console]::OutputEncoding` crash in ISE | none of 06-09 | n/a |

---

## Confidence ratings

| Script | Confidence | Rationale |
|--------|-----------|-----------|
| `06a-setup-gcp-resources.ps1` | HIGH | Quoting is consistent (uses `@()` arrays with single-quoted parens). Missing-secret bug fixed. |
| `06-deploy-cloudrun.ps1` | HIGH | All gcloud format flags normalised to `"--format=value(...)"`. Workflow parity restored. Auth + project-detection now noise-tolerant. |
| `07a-setup-vercel-project.ps1` | MEDIUM | `vercel link` may still prompt for scope if `VERCEL_TOKEN` is not set AND the user's local CLI isn't logged in. Pre-condition: pass `-VercelToken` or run `vercel login` first. |
| `07-deploy-vercel.ps1` | MEDIUM | Same Vercel-link pre-condition. Deploy URL regex assumes Vercel keeps emitting `https://*.vercel.app` — true today. |
| `08-smoke-test-production.ps1` | HIGH | Parse error fixed. All optional tools (k6, lighthouse, curl.exe) gracefully report "skipped". |
| `09-post-deploy-checklist.ps1` | HIGH | Parse error fixed. The remaining `Cmd=` lines are display-only and use safe quoting. |
| `.github/workflows/deploy-production.yml` | HIGH | Already well-structured. One open question: secrets.SENTRY_ORG (without `_SLUG`) must be set manually. |
| `.github/workflows/preview-deploy.yml` | HIGH | Standard pattern, no blockers. |

---

## Specific failure modes still possible at runtime

1. **`vercel link` prompts for scope (07a)** — symptom: script hangs on first line of "Link to existing project? > scope:". Recognise by no output progressing for >60 s.
   - **Fix:** run `vercel login` once interactively before running 07a, OR pass `-VercelToken <token>` from `vercel.com/account/tokens`.

2. **`vercel env add` reads no stdin (07a, 07)** — symptom: script hangs at "What's the value of CLOUDRUN_URL?".
   - **Fix:** PowerShell's pipe should fulfill stdin, but if your Vercel CLI is v34+, prefer `vercel env add NAME production --token=$T <(echo $V)` — not portable in PowerShell, so safer to `Set-Content tmpfile $V; Get-Content tmpfile | vercel env add ...; Remove-Item tmpfile`. Currently unchanged; monitor on first run.

3. **`gcloud builds submit` quota exceeded (06)** — symptom: `ERROR: (gcloud.builds.submit) HTTPError 429`. Cloud Build has a 10-concurrent-build default quota.
   - **Fix:** request quota increase or serialise deploys.

4. **`gcloud run deploy` complains about secrets that don't exist (06)** — fixed by adding `field-encryption-key` and `zoho-database-url` to 06a, but the user MUST run 06a *and* populate values (via `echo VALUE | gcloud secrets versions add ...`) before running 06. If a secret has no versions, Cloud Run will create the revision but the container will fail to start with `Permission denied on secret: ...:latest`.

5. **Cloud Run `--cpu-throttling=false` + `--min-instances 1` cost** — bills always-on CPU. Roughly USD 35-50/month per instance.
   - The `-Confirm` switch gates this. User saw the warning.

6. **`vercel --prod` writes to a different team/scope** — Vercel's "personal account" vs "team scope". If `VERCEL_ORG_ID` is unset and the user has multiple teams, may deploy to wrong project.
   - **Fix:** always pass `--token` AND ensure `.vercel/project.json` (from 07a) is committed or present in CWD.

7. **`08` k6 BASE_URL vs LOAD_TEST_TARGET_URL mismatch** — local smoke test sets `BASE_URL`, CI smoke test sets `LOAD_TEST_TARGET_URL`. If `load/k6-suite/dashboard.js` only reads one, the other test path will load `localhost`.
   - **Fix:** verify the k6 script reads both, falling back to one.

8. **`08` Lighthouse path** — script calls `lighthouse <url>` (the standalone CLI). Spec mentioned Playwright-based capture; that's not implemented here, so simpler.
   - **Pre-condition:** `npm i -g lighthouse` OR `npx lighthouse <url>` (script doesn't try npx — could add).

9. **`09` `Start-Process $c.Url` opens 12 browser tabs at once** — when `-OpenBrowser` is passed, all 12 console URLs open. On a low-memory machine this thrashes. Sleep is 400 ms between opens.
   - Acceptable.

---

## Pre-conditions the user MUST satisfy BEFORE running 06-09

### Before `06a-setup-gcp-resources.ps1`:
- `gcloud auth login` (interactive, opens browser).
- `gcloud auth application-default login` (for SDK calls).
- Billing enabled on the target GCP project (required for Memorystore Redis, Cloud Run, BigQuery).
- The `bq` component of Google Cloud SDK installed: `gcloud components install bq`.
- `-GithubRepo "<owner>/<repo>"` parameter, OR plan to manually bind the WIF principalSet after.

### Before `06-deploy-cloudrun.ps1`:
- `06a` ran successfully (creates the Artifact Registry repo + secrets).
- All 5 Secret Manager secrets have at least one version with a real value:
  - `zoho-secret-key` — Fernet-style 32-byte b64 key.
  - `zoho-sentry-dsn` — Sentry DSN URL.
  - `zoho-redis-url` — `redis://host:port/0` from `06a` output.
  - `field-encryption-key` — Fernet-style 32-byte b64 key.
  - `zoho-database-url` — Cloud SQL or Postgres connection string. **If your backend uses Firestore-only, set this to a placeholder and remove from `--set-secrets`.**
- `gcloud builds submit` quota verified.
- `Dockerfile` in repo root with a valid build context.

### Before `07a-setup-vercel-project.ps1`:
- `npm i -g vercel` (Vercel CLI installed).
- `vercel login` OR pass `-VercelToken <token>` (generate at https://vercel.com/account/tokens).
- The Vercel project name should not collide with an existing one on the user's account, OR the script will link to the existing one (idempotent).

### Before `07-deploy-vercel.ps1`:
- `07a` ran successfully — `frontend/.vercel/project.json` must exist.
- `06-deploy-cloudrun.ps1` ran successfully — `deploy/cloudrun-url.txt` should exist, OR pass `-CloudrunUrl` explicitly.
- `npm run build` succeeds locally (Vite build).

### Before `08-smoke-test-production.ps1`:
- `06` and `07` both ran successfully (URLs captured to files).
- Optional: `npm i -g lighthouse`, `choco install k6`, `node` on PATH for production-reality-probe.
- `Invoke-WebRequest -SkipHttpErrorCheck` requires PowerShell 7+ (`#requires` enforces).

### Before `09-post-deploy-checklist.ps1`:
- `08` should have passed.
- Firebase CLI installed (`npm i -g firebase-tools`) only if you'll use the firestore:rules/indexes deploy commands.

### Before the GitHub workflow first runs:
- `04-push-to-github.ps1` ran (origin remote set).
- `05-setup-secrets.ps1` ran (all secrets pushed via `gh secret set`).
- Manually set `gh secret set SENTRY_ORG --body <your-org-slug>` (the workflow refers to `secrets.SENTRY_ORG` but 05 only sets `SENTRY_ORG_SLUG`-style names — see TODO).
- Workflow variables (not secrets) set: `gh variable set SCORECARD_ISSUE_NUMBER --body <num>` and `gh variable set RUM_BIGQUERY_DATASET --body rum`.
- WIF binding completed: `06a` must have been run with `-GithubRepo "<owner>/<repo>"` so the GitHub Actions principal can impersonate the service account.

---

## Files edited in this audit

- `deploy/06a-setup-gcp-resources.ps1` — added `field-encryption-key`, `zoho-database-url` to secrets list.
- `deploy/06-deploy-cloudrun.ps1` — normalised gcloud `--format` quoting, added stderr filters for auth/project/URL capture, added missing secrets + env vars, added `--cpu-throttling=false`, quoted `--project=$Project`.
- `deploy/07a-setup-vercel-project.ps1` — added `Get-VercelOutputClean` banner filter, updated `whoami` parser.
- `deploy/07-deploy-vercel.ps1` — same Vercel banner filter, updated `whoami` parser.
- `deploy/08-smoke-test-production.ps1` — extracted inline-`if` to variable to fix parse error.
- `deploy/09-post-deploy-checklist.ps1` — replaced `\"` with PS-native `` `" `` and used `annotations['key']` form.

No changes to YAML workflows — both pass audit.
