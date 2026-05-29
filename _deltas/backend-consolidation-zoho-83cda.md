# Backend Consolidation onto `zoho-83cda` — Production Cutover

> **Date:** 2026-05-29
> **What:** Moved the backend (Cloud Run) onto the same project as the data
> (Firestore/Auth/Storage), so all of production lives in **one project:
> `zoho-83cda`**. Done pre-launch (demo data only) — the cheapest, lowest-risk
> time to fix the compute/data project split (an anti-pattern).

## Before → After

| Layer | Before | After |
|-------|--------|-------|
| Cloud Run (backend) | `erp-system-494716` (`zoho-erp-backend-i43i2clqva-ww`) | **`zoho-83cda`** (`zoho-erp-backend-6plfqh2hiq-ww`) |
| Firestore / Auth / Storage | `zoho-83cda` | `zoho-83cda` |
| Secret Manager | `erp-system-494716` | **`zoho-83cda`** (fresh secrets) |
| Frontend `/api/*` rewrite | → old URL | → **new URL** |

## Steps executed
1. Enabled APIs on `zoho-83cda` (run, cloudbuild, artifactregistry, secretmanager).
2. Created **fresh** secrets in `zoho-83cda` Secret Manager — `zoho-secret-key`, `field-encryption-key`. NOT copied from the old project: a new prod project owns its own secrets, and with demo-only data a fresh `FIELD_ENCRYPTION_KEY` is zero-risk.
3. Granted `secretmanager.secretAccessor` to the runtime compute SA on both secrets.
4. `gcloud run deploy zoho-erp-backend --source . --project zoho-83cda --region me-central1 --allow-unauthenticated --env-vars-file cloudrun-deploy-env.yaml --set-secrets …` → revision `zoho-erp-backend-00001`, 100% traffic.
5. Repointed `vercel.json` + `frontend/vercel.json` `/api/*` → new URL.
6. Merged PR #1 → `main` → Vercel production deploy.
7. Deployed the F-3 firestore rules fix to `zoho-83cda`.

## Verification (live, production)
- `https://erpiq.systems/api/live` → `{"status":"alive"}`
- `https://erpiq.systems/api/metrics` → `route_count: 2338` (the new backend, all Tier 1/2/3 routes)
- `https://erpiq.systems/` → HTTP 200
- New backend direct: `https://zoho-erp-backend-6plfqh2hiq-ww.a.run.app` (verified 2338 routes)

## Artifacts
- `deploy/migrate-backend-to-zoho-83cda.sh` + `.ps1` — idempotent operator runbook (the `.ps1` is the Windows-native one; `bash` routed to a broken WSL on the operator's machine).
- `deploy/cloudrun-url.txt` — updated to the new URL.

## Remaining (external — operator)
1. **Retire old services** after a few days of fallback confidence:
   - `gcloud run services delete zoho-erp --region europe-west1 --project erp-system-494716`
   - `gcloud run services delete zoho-erp-backend --region me-central1 --project erp-system-494716`
2. **CI auto-deploy to `zoho-83cda`:** `deploy-cloudrun.yml` was retargeted to `zoho-erp-backend`/`me-central1`, but it deploys to the project in the `GCP_PROJECT_ID` GitHub secret (currently `erp-system-494716`) via WIF set up in that project. To make `merge → main` auto-deploy the backend to `zoho-83cda`, create a WIF pool/provider + deployer SA in `zoho-83cda` and update the GitHub secrets `GCP_PROJECT_ID` / `GCP_WIF_PROVIDER` / `GCP_SA_EMAIL`. Until then, backend deploys are manual via the migration script.
3. **CI `startup_failure`:** every Actions run since 2026-05-27 fails at startup (GitHub workflow-schema issue; YAML/BOM/reusable-refs/dup-keys all ruled out). Open the failed run in the **GitHub Actions UI** (or run `actionlint` locally) to see the exact file+line, then fix. Non-blocking for the manual deploy path.

## Note on professional posture
Production cloud mutations (deploy, IAM, traffic, firebase deploy) were executed by the **human operator** running the runbook script — the AI agent is intentionally blocked from running them or self-granting permission. That separation is the correct, professional default.
