# Deploy Checklist — single page / لیستی deploy — یەک لاپەڕە

> Print this page. Tick each line. Don't skip.
> ئەم لاپەڕە چاپ بکە. هەر لاینێک تیک بکە. ـ تێپەڕ مەکە.

---

## A) One-time setup / دامەزراندنی یەکجاری

```
[ ] 01-prereqs.ps1                         پاس بوو
       - node ≥ 20, python ≥ 3.11, gh, gcloud, vercel
       - report: deploy/prereqs-report.txt

[ ] 06a-setup-gcp-resources.ps1            یەکجاری
       - GCP project: ____________________
       - Artifact Registry repo: zoho-images
       - Workload Identity pool + provider
       - Service account: github-deployer@___.iam.gserviceaccount.com
       - Secret Manager secrets created (empty placeholders OK)

[ ] 07a-setup-vercel-project.ps1            یەکجاری
       - Vercel project: ____________________
       - VERCEL_PROJECT_ID:  ____________________
       - VERCEL_ORG_ID:      ____________________
       - CLOUDRUN_URL env var added in Vercel (production scope)

[ ] 05-setup-secrets.ps1                    یەکجاری
       - All 14 GitHub secrets set:
           [ ] GCP_PROJECT_ID
           [ ] GCP_WIF_PROVIDER
           [ ] GCP_SERVICE_ACCOUNT
           [ ] VERCEL_TOKEN
           [ ] VERCEL_ORG_ID
           [ ] VERCEL_PROJECT_ID
           [ ] CLOUDRUN_URL          (set after first deploy)
           [ ] SENTRY_AUTH_TOKEN
           [ ] SENTRY_ORG
           [ ] VITE_SENTRY_DSN
           [ ] LOAD_TEST_USER_EMAIL
           [ ] LOAD_TEST_USER_PASSWORD
           [ ] LOAD_TEST_TENANT_ID
           [ ] GH_TOKEN              (PAT with repo:read for ci-gate)
       - And all 8 Secret Manager secrets populated:
           [ ] zoho-secret-key            (≥ 32 chars random)
           [ ] zoho-sentry-dsn            (backend project DSN)
           [ ] zoho-redis-url             (Memorystore URL)
           [ ] field-encryption-key       (Fernet 32-byte b64)
           [ ] zoho-database-url          (Cloud SQL URL)
           [ ] smtp-password
           [ ] einvoice-api-key           (optional)
           [ ] fcm-server-key             (optional)
```

---

## B) Every deploy / هەر deploy ـێک

```
[ ] 02-install-and-build.ps1                پاس بوو
       - frontend: npm install --legacy-peer-deps + npm run build
       - bundle:   shell ≤ 350 KB confirmed
       - i18n:     no missing keys

[ ] 03-run-tests.ps1                        پاس بوو
       - pytest:   green (or known-skips documented)
       - vitest:   green
       - playwright e2e smoke: green

[ ] 04-push-to-github.ps1                   پاس بوو
       - branch: main (or release/*)
       - PR (if any) merged
       - repo URL: ____________________________

[ ] CI workflows green for this SHA
       - ci.yml          [ ]
       - ci-quality.yml  [ ]

[ ] 06-deploy-cloudrun.ps1                  پاس بوو
       - Cloud Run URL: ___________________________
       - Saved to: deploy/cloudrun-url.txt
       - latestReadyRevision = latestCreatedRevision ✓

[ ] 07-deploy-vercel.ps1                    پاس بوو
       - Vercel URL: _____________________________
       - Saved to: deploy/vercel-url.txt
       - CSP + HSTS headers present (curl -sI verified)

[ ] Sentry release tagged (auto from CI)
       - Frontend release: zoho-frontend@<sha>
       - Backend  release: zoho-backend@<sha>
```

---

## C) Post-deploy verification / پاش deploy

```
[ ] 08-smoke-test-production.ps1            هەموو پاس بوون
       - GET  /api/health        → 200, version=<sha>
       - GET  /                  → frontend renders
       - GET  /api/health (proxy through Vercel) → 200
       - POST /api/auth/login    → 200 with cookie

[ ] 09-post-deploy-checklist.ps1            هەموو item تیک کرا
       - Sentry FE test error landed             [ ]
       - Sentry BE test error landed             [ ]
       - RUM POST /api/rum/vitals visible        [ ]
       - BigQuery vitals_raw count > 0 (5 min)   [ ]
       - backup-verify.yml run green             [ ]

[ ] First scorecard regenerated and reviewed (post-deploy)
       - docs/world-class/scorecard.md updated
       - Overall score: ____ / 100
       - Posted to sticky issue #____

[ ] DNS configured / DNS ـ ڕێ کرا
       - <root domain>      → Vercel (CNAME or A)
       - api.<root domain>  → Cloud Run (Cloud Run custom domain mapping)
       - SSL certificates issued (Vercel auto + Cloud Run Google-managed)

[ ] CSP report-only watching for 14 days
       - /api/csp-report endpoint receiving reports
       - No noisy 'inline' or 'eval' reports (or all whitelisted)
       - Plan: enforce CSP on YYYY-MM-DD ____________________

[ ] Backup verification cron running
       - GH Actions schedule active in backup-verify.yml
       - Last run: ____________________ (green/red)

[ ] Alerts wired
       - Slack #zoho-prod-alerts:        test ping received  [ ]
       - PagerDuty (or eq.) Sentry hook: test triggered      [ ]
       - Email digest on scorecard drop: subscribed          [ ]
```

---

Signed: ______________________  Date: ______________________

Repo URL: __________________________________________________

Production frontend: _______________________________________

Production backend:  _______________________________________
