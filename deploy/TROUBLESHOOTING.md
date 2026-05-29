# Deployment Troubleshooting / چارەسەری کێشەکانی ناردن

> EN: Common failures and fixes for `deploy/*.ps1` and `.github/workflows/deploy-production.yml`.
> KU: کێشە باوەکان و چارەسەرکردنیان بۆ ناردنی بەرهەمهێنان.

---

## Quick index

1. [Frontend build fails](#1-frontend-build-fails)
2. [Cloud Run cold-start too slow](#2-cloud-run-cold-start--10s)
3. [Vercel deploy fails: "no framework"](#3-vercel--no-framework-detected)
4. [502 on /api/* through Vercel](#4-502-on-api-through-vercel)
5. [Sentry "DSN missing" in production](#5-sentry-dsn-missing-in-production)
6. [401 on every API call](#6-401-on-every-api-call)
7. [Workbox SW not registering](#7-workbox-service-worker-not-registering)
8. [gh secret set fails](#8-gh-secret-set-fails)
9. [gcloud builds submit "permission denied"](#9-gcloud-builds-submit--permission-denied)
10. [WIF auth fails in GitHub Actions](#10-wif-auth-fails-in-github-actions)
11. [Firestore queries fail with "index needed"](#11-firestore-queries-fail-with-index-needed)
12. [Cloud Run revision health checks fail](#12-cloud-run-revision-fails-health-check)

---

## 1. Frontend build fails

### a) `npm install` peer-dep conflict

```
npm ERR! ERESOLVE could not resolve
npm ERR! While resolving: vite-plugin-pwa@1.3.0
npm ERR! Found: vite@5.4.0
```

**Fix:**
```powershell
cd frontend
npm install --legacy-peer-deps
```

The Dockerfile also passes `--include=optional` so platform-specific deps resolve under Alpine.

### b) `vite-plugin-pwa` type error

Symptom: build crashes with `Type 'PartialPwaOptions' is missing properties 'workbox' ...`.

**Fix:** Check `frontend/pwa-config.ts` exports an object that matches the v1.x shape (it changed between 0.20.x → 1.3.x). The `manifest` and `workbox` keys are required.

### c) `Failed to resolve entry for package` for `i18n.config`

The legacy `frontend/src/i18n.ts` module was replaced by `i18n.config.ts` with `initI18n()` (see CLAUDE.md change log). If you see this error, ensure `frontend/src/main.tsx` does:

```ts
import { initI18n } from './i18n.config';
await initI18n();
```

---

## 2. Cloud Run cold-start > 10s

**Diagnose:**
```powershell
gcloud run services describe zoho-erp-backend `
  --region=me-central1 `
  --format='value(spec.template.metadata.annotations."autoscaling.knative.dev/minScale")'
```

**Fixes (cheapest first):**

1. **Set min-instances=1** to keep one warm:
   ```powershell
   gcloud run services update zoho-erp-backend `
     --region=me-central1 `
     --min-instances=1
   ```
   Cost: ~`$30-50/month` per instance.

2. **Reduce container size.** Check `gcloud builds log` — if it's > 500 MB, audit `backend/requirements.txt` for accidentally pulled `tensorflow`, `torch`, etc.

3. **Switch to gen2 execution env** (already on by default in 06-deploy-cloudrun.ps1):
   ```
   --execution-environment gen2
   ```

4. **Enable CPU always allocated** (`--cpu-throttling=false` — also default).

---

## 3. Vercel — "no framework detected"

Vercel sometimes ignores `framework` in `vercel.json` when the root directory is wrong.

**Fix:**
1. In Vercel dashboard → Project → Settings → General:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install --legacy-peer-deps`

2. Or re-link via the CLI:
   ```powershell
   cd frontend
   vercel link --project zoho-kurdish-erp --yes
   ```

---

## 4. 502 on /api/* through Vercel

**Cause:** the `${CLOUDRUN_URL}` rewrite in `vercel.json` resolves to an empty string when the env var is missing in the Vercel project.

**Diagnose:**
```powershell
vercel env ls production
# Look for CLOUDRUN_URL — must be set, and the value must start with https://
```

**Fix:**
```powershell
$cloudrunUrl = Get-Content .\deploy\cloudrun-url.txt -Raw
$cloudrunUrl.Trim() | vercel env add CLOUDRUN_URL production
vercel --prod --yes   # redeploy to pick up new env
```

Verify directly with curl:
```powershell
curl.exe -i "$frontendUrl/api/health"
# Should be 200 with status: ok
# If 502, the rewrite target is invalid
```

---

## 5. Sentry "DSN missing" in production

### Frontend
Sentry browser SDK reads `VITE_SENTRY_DSN` **at build time**, not runtime. If you set it in Vercel env vars but built locally without it, the bundle won't have it.

**Fix:** Set it in Vercel before triggering `vercel --prod`:
```powershell
vercel env add VITE_SENTRY_DSN production
# paste DSN, then redeploy
vercel --prod --yes
```

### Backend
Cloud Run reads `SENTRY_DSN` at startup from Secret Manager. Ensure the secret exists and has a version with a value:
```powershell
gcloud secrets versions add zoho-sentry-dsn --data-file=- --project=$project
# (paste DSN value)
```

Then bounce the revision:
```powershell
gcloud run services update zoho-erp-backend --region=me-central1
```

---

## 6. 401 on every API call

Most common cause: tenant middleware blocking because the JWT lacks a `tenant_id` claim.

**Diagnose:** check Cloud Run logs:
```powershell
gcloud logging read 'resource.type=cloud_run_revision AND severity>=WARNING' --limit 50
```

Look for `tenant_id missing from token` or `multi-tenant context not set`.

**Fixes:**
- Ensure Firebase custom claims are set: backend `auth.users.set_custom_claims(uid, {tenant_id: ...})`.
- Or temporarily disable enforcement: set Cloud Run env var `TENANT_ENFORCEMENT=permissive`.

---

## 7. Workbox Service Worker not registering

**Diagnose:**
```powershell
curl.exe -i "$frontendUrl/sw.js"
# Expect 200 with Service-Worker-Allowed: /
```

If 404: the Vite PWA plugin didn't write `dist/sw.js` during build.

**Fixes:**
1. Ensure `VitePWA(PWA_CONFIG)` is in `frontend/vite.config.ts` `plugins[]` (see CLAUDE.md change log).
2. Verify build output:
   ```powershell
   cd frontend
   npm run build
   dir dist\sw.js          # must exist
   ```
3. If `dist/sw.js` is missing, check `pwa-config.ts` `strategies` — must be `generateSW` or `injectManifest`.

---

## 8. `gh secret set` fails

```
HTTP 401: Bad credentials
```

**Fix:**
```powershell
gh auth login
gh auth status      # confirm scope includes 'repo'
```

If you need to set secrets for the GitHub Action across a fork/org, you may need:
```powershell
gh auth refresh -h github.com -s admin:org,repo
```

---

## 9. `gcloud builds submit` "permission denied"

```
ERROR: (gcloud.builds.submit) PERMISSION_DENIED: ...
```

The Cloud Build SA needs:

```powershell
$projectNumber = gcloud projects describe $project --format='value(projectNumber)'
$cbSa = "${projectNumber}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $project `
  --member=serviceAccount:$cbSa `
  --role=roles/cloudbuild.builds.editor

gcloud projects add-iam-policy-binding $project `
  --member=serviceAccount:$cbSa `
  --role=roles/run.admin

gcloud projects add-iam-policy-binding $project `
  --member=serviceAccount:$cbSa `
  --role=roles/artifactregistry.writer

gcloud projects add-iam-policy-binding $project `
  --member=serviceAccount:$cbSa `
  --role=roles/iam.serviceAccountUser
```

Also: the runner SA `github-deployer@<project>` (created by 06a) needs `roles/cloudbuild.builds.editor` — 06a applies this automatically.

---

## 10. WIF auth fails in GitHub Actions

```
Error: google-github-actions/auth failed
unable to find principal in provider
```

Two checks:

**a) Attribute condition matches the repo.** When you ran 06a without `-GithubRepo`, the condition allows any repo with a `repository_owner`. For production lock down:
```powershell
gcloud iam workload-identity-pools providers update-oidc github-provider `
  --location=global `
  --workload-identity-pool=github-pool `
  --attribute-condition="assertion.repository == 'OWNER/REPO'"
```

**b) Principal-set binding exists on the SA.**
```powershell
gcloud iam service-accounts get-iam-policy github-deployer@$project.iam.gserviceaccount.com
# Look for principalSet://iam.googleapis.com/projects/.../attribute.repository/OWNER/REPO
```

If missing, add it:
```powershell
$projectNumber = gcloud projects describe $project --format='value(projectNumber)'
gcloud iam service-accounts add-iam-policy-binding `
  "github-deployer@$project.iam.gserviceaccount.com" `
  --role=roles/iam.workloadIdentityUser `
  --member="principalSet://iam.googleapis.com/projects/$projectNumber/locations/global/workloadIdentityPools/github-pool/attribute.repository/OWNER/REPO"
```

---

## 11. Firestore queries fail with "index needed"

Cloud Run logs show:
```
The query requires an index. You can create it here: https://console.firebase.google.com/...
```

**Fix:** Either click the URL in the log (Firebase creates it for you), or deploy from `firestore.indexes.json`:
```powershell
firebase deploy --only firestore:indexes --project $project
```

The audit script `scripts/audit-firestore-queries.py` can pre-detect missing indexes.

---

## 12. Cloud Run revision fails health check

```
The user-provided container failed to start and listen on the port defined by the PORT environment variable.
```

**Diagnose:**
```powershell
gcloud run revisions list --service=zoho-erp-backend --region=me-central1 --limit=5
gcloud logging read 'resource.labels.service_name=zoho-erp-backend AND severity>=ERROR' --limit 50
```

Common causes:

1. **App binds to 8000 instead of `$PORT`.** Dockerfile uses `${PORT}` (8080 default). If your local dev hardcoded `--port 8000`, fix `app/main.py` to read `os.environ.get('PORT', '8080')`.

2. **Missing secret.** Startup crashes because `SECRET_KEY` is None. Verify:
   ```powershell
   gcloud secrets versions list zoho-secret-key --project=$project
   ```

3. **Migration on boot timed out.** `RUN_MIGRATIONS_ON_BOOT=true` — if migrations take > 60s, the health probe times out. Either disable for first deploy or increase `--timeout 600`.

4. **Memorystore Redis unreachable.** Cloud Run needs a VPC connector to reach Memorystore. See the existing `.github/workflows/deploy-cloudrun.yml` "Attach VPC + Redis" step:
   ```powershell
   gcloud run services update zoho-erp-backend `
     --region=me-central1 `
     --vpc-connector=erpiq-run-connector `
     --vpc-egress=private-ranges-only
   ```

---

## Logs

All deploy scripts write to `deploy/logs/<step>-<ISO-timestamp>.log`. When opening a support ticket or asking for help, attach the most recent log for the step that failed.

```powershell
Get-ChildItem deploy/logs/ | Sort LastWriteTime -Desc | Select -First 5
```

---

## Cost guards reminder

| Resource | Approx monthly cost |
|----------|-----|
| Cloud Run min-instances=1, 1 CPU, 1 GiB | ~$30–50 |
| Memorystore Redis 1 GB basic | ~$50 |
| Firestore (light usage) | < $5 |
| Vercel Pro (if needed) | $20/seat |
| Sentry Team plan | $26/mo |
| BigQuery (light RUM) | < $5 |

All deploy scripts require `-Confirm` before creating billable resources.
