# Runbook — Staging Environment / ژینگەی Staging

> **Spec ref:** `.kiro/specs/launch-readiness` Phase R3 (Staging), T-LR.2.5
> **Owner:** Platform + Backend lead
> **Audience:** Anyone shipping a PR, anyone debugging a staging-only issue

Staging mirrors prod's shape but never holds real customer data. It's a
separate GCP project (ADR-LR-005), separate Vercel environment, and
separate Firestore database. The goal: a place where the team and
trusted beta customers can break things without consequence.

---

## 1. Environment topology

| Component | Staging | Prod |
|-----------|---------|------|
| GCP project | `zoho-staging` | `zoho-prod` |
| Region | `me-central1` (Doha) | `me-central1` |
| Firestore mode | Native | Native |
| Backend (Cloud Run) | `api.staging.erp.zoho.kurd.iq` | `api.erp.zoho.kurd.iq` |
| Frontend (Vercel) | `staging.erp.zoho.kurd.iq` | `erp.zoho.kurd.iq` |
| Redis (Memorystore) | 1 GB BASIC tier | 5 GB STANDARD_HA |
| Branch | `staging` | `main` |
| Secrets | Secret Manager prefix `STAGING_*` | prefix `PROD_*` |
| Environment banner | Yellow "STAGING" pill (top-right) via `EnvironmentBadge` | None |

---

## 2. Deploy to staging

### 2.1 Frontend (Vercel auto-deploy)

```bash
git checkout staging
git merge main
git push origin staging
```

Vercel auto-builds on push to `staging`. Wait ~ 4 minutes. Watch:
- Vercel dashboard → `zoho-frontend` project → Deployments
- Final URL: `https://staging.erp.zoho.kurd.iq`

If build fails: check the build log; common failures are env vars
(`VITE_API_BASE`, `VITE_ENV`) and TypeScript errors not caught locally.

### 2.2 Backend (GitHub Actions → Cloud Run)

```bash
git checkout staging
git push origin staging
```

`.github/workflows/staging-deploy.yml` runs:
1. Build container image with tag `staging-<sha>`.
2. Push to `me-central1-docker.pkg.dev/zoho-staging/api/api:<sha>`.
3. Deploy to Cloud Run service `api` in project `zoho-staging`.
4. Smoke test: `curl https://api.staging.erp.zoho.kurd.iq/healthz`.

If smoke test fails the workflow halts before traffic shift.

### 2.3 Force a redeploy of the same SHA

```bash
gcloud run services update api \
  --project=zoho-staging \
  --region=me-central1 \
  --update-env-vars=REDEPLOY_AT=$(date +%s)
```

---

## 3. Reset staging tenant

A "tenant reset" wipes a single tenant's data while leaving infra and
other tenants intact. Use this when:
- A test left bad data and a teammate needs a clean slate.
- A demo with a customer just ended and we want to remove their poking.
- A beta tester reported a regression and we need to reproduce from
  a known starting state.

### 3.1 Single tenant

```bash
python -m backend.app.tools.staging_reset \
  --project zoho-staging \
  --tenant TENANT_ID \
  --confirm
```

The tool:
1. Deletes all subcollections under `tenants/{tenant_id}/...`.
2. Deletes the root tenant doc.
3. Removes Auth claims for users tied only to this tenant.
4. Audit log entry to `staging_audit/resets/{timestamp}`.
5. Won't run on `zoho-prod` (project-name allowlist hard-coded).

### 3.2 All tenants except seeded synthetic

```bash
python -m backend.app.tools.staging_reset \
  --project zoho-staging \
  --all-except seed-tenant \
  --confirm
```

### 3.3 Full nuke (recreate Firestore database)

Only the platform lead does this. Steps in §8.

---

## 4. Seed a synthetic tenant

The seeder builds a realistic Iraqi SMB tenant: 100 products, 50
customers, 30 days of invoices, COA preloaded.

### 4.1 Default seed

```bash
python -m backend.app.tools.seed_staging \
  --tenant seed-tenant \
  --region IQ-BAGHDAD \
  --plan growth
```

This is idempotent — running again on the same `--tenant` resets it.

### 4.2 Custom shape

```bash
python -m backend.app.tools.seed_staging \
  --tenant beta-erbil-restaurant \
  --region IQ-ERBIL \
  --plan pro \
  --industry restaurant \
  --products 250 \
  --customers 100 \
  --invoices-days 60 \
  --include-pos-orders \
  --include-purchase-orders
```

Industries supported: `general`, `restaurant`, `retail`, `pharmacy`,
`construction`. Each tweaks the seed catalog and the COA template.

### 4.3 Default credentials

After seeding:
- Admin user: `admin@<tenant>.staging.local` / password printed at end of run
- Cashier user: `cashier@<tenant>.staging.local` / PIN `1234`

These users only exist in staging Auth, never in prod.

---

## 5. Access staging Firestore

### 5.1 Read-only via gcloud

```bash
# A specific document
gcloud firestore documents get "tenants/TENANT_ID/onboarding/state" \
  --project=zoho-staging --database="(default)"

# A collection (returns IDs only)
gcloud firestore collections list "tenants/TENANT_ID" \
  --project=zoho-staging --database="(default)"
```

### 5.2 Console (read + write)

Cloud Console → Firestore → switch project picker to `zoho-staging`.
You need the `staging-only` IAM group (request via `#oncall-platform`).
Prod IAM never gives you staging access automatically — they're separate.

### 5.3 From application code

```bash
# Local dev pointing at staging Firestore
export GOOGLE_CLOUD_PROJECT=zoho-staging
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/zoho-staging-sa.json
python -m backend.app.main
```

Only do this when intentionally writing to staging — local-against-prod
is forbidden by policy.

---

## 6. View staging logs

### 6.1 Cloud Logging filter (recent errors)

```
resource.type="cloud_run_revision"
resource.labels.project_id="zoho-staging"
severity>=ERROR
timestamp >= "now-1h"
```

### 6.2 Per-tenant filter

```
resource.type="cloud_run_revision"
resource.labels.project_id="zoho-staging"
labels.tenant_id="TENANT_ID"
timestamp >= "now-1h"
```

### 6.3 Per-route filter

```
resource.type="cloud_run_revision"
resource.labels.project_id="zoho-staging"
jsonPayload.route="/api/onboarding/coa/apply"
```

### 6.4 Frontend logs (Sentry)

Sentry project: `zoho-frontend-staging`. Filter by `environment=staging`.

### 6.5 Service-worker logs

PWA console messages from staging end up in the user's browser
DevTools — there's no server-side aggregation. For systematic SW
diagnostics, register a beta tester with the Workbox dev mode toggle.

---

## 7. Debug a staging-only issue

When prod is fine but staging is broken, walk this list:

1. **Is the failing service `staging` or a stale prod-config?**
   - `curl https://api.staging.erp.zoho.kurd.iq/healthz` → JSON should have `env: "staging"`.
   - If it returns `env: "production"`, the Cloud Run service has the wrong env vars. Re-deploy with correct config.

2. **Is Firestore data shape consistent?**
   - Compare `tenants/<id>/onboarding/state` schema to the migration history in `backend/app/firestore/migrations/`.
   - Staging often gets ahead of prod after a schema change — old rows in staging may need backfill.

3. **Is the Redis cache poisoned?**
   - `gcloud redis instances get-credentials staging-redis --region me-central1`
   - `FLUSHDB` (staging only — would be career-ending in prod).
   - Restart the backend.

4. **Did a CI deploy land that you missed?**
   - GitHub → Actions → latest `staging-deploy.yml` run.
   - Compare the deployed commit SHA to what you expected.

5. **Are env vars set?**
   - Cloud Run revision → "Variables & Secrets" tab. Check `VITE_ENV`, `API_BASE`, `STRIPE_API_KEY` (staging key, not prod), `FIRESTORE_PROJECT`.

6. **Is DNS pointed correctly?**
   - `dig staging.erp.zoho.kurd.iq +short` → should return Vercel IPs.
   - `dig api.staging.erp.zoho.kurd.iq +short` → should return GCLB IPs.

If all six pass and the issue persists: it's a real bug. File and reproduce locally.

---

## 8. Monthly reset cron

Staging gets a full reset on the **1st of each month, 03:00 UTC** to
prevent data drift and keep storage costs predictable.

### 8.1 What the cron does

```bash
python -m backend.app.tools.staging_monthly_reset
```

1. Lists all tenants in staging.
2. Excludes tenants in the allowlist `data/staging_allowlist.yaml` (set
   for active beta customers — usually 5-10 entries).
3. For each non-allowlisted tenant: runs single-tenant reset (§3.1).
4. Re-seeds the canonical `seed-tenant`.
5. Sends a Slack message to `#staging-status`.

### 8.2 Cloud Scheduler config

Job name: `staging-monthly-reset`
Schedule: `0 3 1 * *`
Target: Cloud Run service `staging-tools`
Path: `/jobs/monthly-reset`
Authenticated via SA `staging-cron@zoho-staging.iam.gserviceaccount.com`.

### 8.3 Manual trigger

```bash
gcloud scheduler jobs run staging-monthly-reset \
  --location=me-central1 \
  --project=zoho-staging
```

### 8.4 Pause the reset for a month

```bash
gcloud scheduler jobs pause staging-monthly-reset \
  --location=me-central1 \
  --project=zoho-staging
```

Resume with `... resume ...`. Document the reason in
`audit/staging-resets/skipped/YYYY-MM.md`.

---

## 9. Promotion: staging → prod

When code passes staging soak test (default: 5 business days with no
SEV-1):
```bash
git checkout main
git merge --no-ff staging
git push origin main
```

`main` triggers prod deploy. Watch:
- Vercel `zoho-frontend` deployment
- Cloud Run prod service revision
- Cloud Logging prod project for new errors over the first 30 minutes

Rollback procedure if anything breaks: `gcloud run services update-traffic api --to-revisions=<previous-rev>=100 --project=zoho-prod`.

---

## 10. What staging is NOT

- **Not a backup of prod.** Don't dump prod into staging to "have data."
- **Not for performance testing.** Staging is a single Cloud Run instance with
  low memory; perf numbers are not representative.
- **Not externally exposed except to allowlisted beta IPs** (via Cloud Armor).
  If you need to share a staging URL with someone outside the company, ask
  Platform to add their IP.
- **Not a place to test real payment flows.** Use the provider-specific
  sandboxes. Even staging Stripe key is sandbox — never prod.

---

## 11. Related

- [`onboarding-troubleshooting.md`](./onboarding-troubleshooting.md)
- [`payment-reconciliation.md`](./payment-reconciliation.md)
- ADR-LR-005 (in design.md §6) — staging as a separate GCP project

---

*Last reviewed: 2026-05-29 by Safa Othman. Re-review when staging gets its first 5 beta tenants.*
