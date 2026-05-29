# Deploy Flow / ڕێچکەی deploy

> Visual map of the deploy process. Reference this when you're not sure
> what step comes next or who runs what.
> نەخشەی deploy. کاتێک نازانیت هەنگاوی داهاتوو چییە، ئەمە بخوێنەوە.

---

## 0. Legend / ڕێبەری نیشانە

```
 ▣  operator (you) runs this manually on Windows
 ⚙  GitHub Actions runs this automatically
 ☁  produces a cloud resource
 📄  produces a file under deploy/ or _deltas/
 ⏱  approximate duration
```

---

## 1. Big picture / پلانی گشتی

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    ONE-TIME SETUP — ~ 45 min total                       ║
║                    دامەزراندنی یەکجاری — ٤٥ خولەک                          ║
╚══════════════════════════════════════════════════════════════════════════╝

   01-prereqs.ps1 ──▶ 06a-setup-gcp ──▶ 07a-setup-vercel ──▶ 05-setup-secrets
        ▣ 2 min          ▣ ☁ 15 min        ▣ ☁ 5 min          ▣ 20 min
        📄 prereqs        📄 gcp-           📄 vercel-          (GitHub secrets +
        report            resources.txt     project.txt         Secret Manager)

╔══════════════════════════════════════════════════════════════════════════╗
║                    EVERY DEPLOY — ~ 25 min wall-clock                    ║
║                    هەر deploy ـێک — ٢٥ خولەک                              ║
╚══════════════════════════════════════════════════════════════════════════╝

   ┌──────────────────────────────────────────────────────────────────┐
   │  LOCAL (you, on Windows)                                          │
   │                                                                   │
   │   02-install-and-build ──▶ 03-run-tests ──▶ 04-push-to-github     │
   │       ▣ ⏱ 6 min               ▣ ⏱ 4 min       ▣ ⏱ 1 min            │
   │       📄 build evidence       📄 test reports                      │
   └──────────────────────────────┬───────────────────────────────────┘
                                  │  push to main
                                  ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  CI (GitHub Actions, automatic from here)                         │
   │                                                                   │
   │   ci.yml ──▶ ci-quality.yml ──▶ deploy-production.yml             │
   │     ⚙ ⏱ 5 min      ⚙ ⏱ 6 min        ⚙ ⏱ 14 min                       │
   │                                                                   │
   │   Inside deploy-production.yml:                                   │
   │     ci-gate ──▶ bundle-budget ──▶ deploy-backend  ──▶ deploy-fe   │
   │       ⚙ 10 s       ⚙ 2 min         ⚙ ☁ 6 min          ⚙ ☁ 3 min     │
   │                                  (Cloud Build +                   │
   │                                   blue/green rollout)             │
   │                                                                   │
   │     ──▶ smoke-test ──▶ post-deploy-scorecard ──▶ summary          │
   │            ⚙ 2 min        ⚙ 1 min                                  │
   └──────────────────────────────┬───────────────────────────────────┘
                                  │  prod is live
                                  ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  POST-DEPLOY (you, on Windows)                                    │
   │                                                                   │
   │   08-smoke-test-production ──▶ 09-post-deploy-checklist           │
   │       ▣ ⏱ 3 min                  ▣ ⏱ 5 min                          │
   │       📄 smoke-report.txt        📄 checklist.txt (signed)         │
   └──────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed sequence (with artifacts and owners)

| # | Step | Owner | Tool | Duration | Artifacts | Cloud resources touched |
|---|---|---|---|---|---|---|
| **One-time setup** |
| 1 | `01-prereqs.ps1` | Operator | PowerShell | 2 min | `deploy/prereqs-report.txt` | — |
| 2 | `06a-setup-gcp-resources.ps1` | Operator | PowerShell + gcloud | 15 min | `deploy/gcp-resources.txt` | GCP project, Artifact Registry, WIF pool, service account, Memorystore Redis, Secret Manager (placeholders) |
| 3 | `07a-setup-vercel-project.ps1` | Operator | PowerShell + vercel CLI | 5 min | `deploy/vercel-project.txt` | Vercel project, env vars |
| 4 | `05-setup-secrets.ps1` | Operator | PowerShell + gh + gcloud | 20 min | (no file — outputs masked) | GitHub repo secrets, GCP Secret Manager values |
| **Per-deploy — local** |
| 5 | `02-install-and-build.ps1` | Operator | PowerShell + npm | 6 min | `deploy/build-evidence.txt`, `frontend/dist/` | — |
| 6 | `03-run-tests.ps1` | Operator | PowerShell + pytest + vitest + playwright | 4 min | `deploy/test-report.txt` | — |
| 7 | `04-push-to-github.ps1` | Operator | PowerShell + git | 1 min | git commit on `main` | — |
| **Per-deploy — CI** |
| 8 | `ci.yml` | CI | GitHub Actions | 5 min | CI logs, test reports | — |
| 9 | `ci-quality.yml` | CI | GitHub Actions | 6 min | Lighthouse reports, axe reports, nav-sweep, route-walk | — |
| 10 | `deploy-production.yml` :: `ci-gate` | CI | gh CLI | 10 s | (gate decision) | — |
| 11 | `deploy-production.yml` :: `bundle-budget-gate` | CI | vite build + audit scripts | 2 min | `dist/` artifact | — |
| 12 | `deploy-production.yml` :: `deploy-backend` | CI | Cloud Build + gcloud run deploy | 6 min | Container image, Cloud Run revision (candidate → live) | Artifact Registry, Cloud Run, Cloud Build |
| 13 | `deploy-production.yml` :: `deploy-frontend` | CI | vite build + vercel-action | 3 min | Vercel production deployment | Vercel |
| 14 | `deploy-production.yml` :: `smoke-test` | CI | node + k6 | 2 min | `probe-evidence-*.json`, k6 stdout | (probes prod) |
| 15 | `deploy-production.yml` :: `post-deploy-scorecard` | CI | node | 1 min | `docs/world-class/scorecard.md`, sticky issue comment | (reads BQ + Sentry + GH Pulse) |
| **Per-deploy — post-deploy** |
| 16 | `08-smoke-test-production.ps1` | Operator | PowerShell + curl | 3 min | `deploy/smoke-report.txt` | (probes prod) |
| 17 | `09-post-deploy-checklist.ps1` | Operator | PowerShell (interactive) | 5 min | `deploy/post-deploy-checklist-YYYYMMDD.txt` (signed) | — |

---

## 3. Failure branches / لقەکانی شکست

```
                          deploy-production.yml
                                  │
        ┌─────────────────────────┼────────────────────────┐
        │                         │                        │
   ci-gate FAILS         deploy-backend FAILS      smoke-test FAILS
   (ci.yml red)          (Cloud Build err,         (health probe,
                          revision not ready)       k6 thresholds)
        │                         │                        │
        ▼                         ▼                        ▼
   STOP. Fix CI on    blue/green NEVER shifts.    PROD IS LIVE but
   feature branch.    Old revision keeps 100%.    degraded. Decide:
   Re-trigger main.   See RUNBOOK §3.1 to roll    1) Roll back, OR
                      Cloud Run forward later.    2) Hotfix forward.
                                                  See RUNBOOK §3.
```

Key safety property: `deploy-bluegreen.sh` only shifts traffic AFTER the
candidate passes health checks. A bad image cannot reach end users — it
just stays at 0% traffic until you delete it.

KU: ئەگەر candidate ـ شکستی هێنا، هیچ traffic ـ بەرەو ـ revision نوێ ناڕوات،
بەکارهێنەران چ کێشەیەکیان لێ نایێت.

---

## 4. Side workflows / workflow ـی لاوەکی

```
PR opened ──▶ preview-deploy.yml ──▶ Vercel preview URL on sticky comment
              scorecard-on-pr.yml ──▶ maintainability delta sticky comment
              ci.yml + ci-quality.yml ──▶ gate the merge

Nightly ────▶ backup-verify.yml ──▶ Firestore restore drill
              weekly-health-check.yml ──▶ scorecard + Slack digest

On-demand ──▶ load-test.yml ──▶ k6 sustained load (NOT in deploy path)
              bundle-diff.yml ──▶ side-by-side bundle comparison
```

---

## 5. Where the data flows / ڕێگەی داتا

```
   Browser  ─POST─▶  /api/rum/vitals  ─▶  rum_ingest.py  ─▶  BigQuery vitals_raw
      │                  (FE)               (BE async)             │
      │                                                             │
      └──Sentry SDK──▶ sentry.io (zoho-frontend project)            │
                                                                    ▼
   FastAPI ──sentry-sdk──▶ sentry.io (zoho-backend project)   scorecard.mjs
      │                                                             │
      ├──Cloud Logging──▶ gcloud logs                               │
      ├──Cloud Trace──▶ trace explorer                              │
      └──Cloud Monitoring──▶ alert policies ──▶ Slack #zoho-prod-alerts

   GitHub PR ──▶ scorecard-on-pr.yml ──▶ sticky comment
   GitHub main ──▶ deploy-production.yml ──▶ scorecard.md ──▶ sticky issue
```

---

## 6. Cost-incurring steps / هەنگاوەکانی خەرجی

| Step | Cost driver | Approx monthly cost |
|---|---|---|
| Cloud Run `--min-instances=1` | always-on container | ~$30–50 per instance |
| Cloud Run requests | pay-per-request | ~$10–30 (varies by load) |
| Artifact Registry storage | image bytes | ~$1–5 |
| Cloud Build | build minutes | ~$0.003/build-min — negligible |
| Memorystore Redis (basic 1 GB) | always-on | ~$35 |
| BigQuery (RUM) | storage + queries | ~$2–10 |
| Cloud SQL (small) | always-on | ~$25 |
| Vercel Pro | flat | $20 per seat |
| Sentry Team | flat | $26 |
| **Total day-1 floor** | | **~$150/month** |

KU: کۆی خەرجی ڕۆژی یەکەم ~ ١٥٠ دۆلار/مانگ، بەپێی ـ load زیاد دەبێت.

---

## 7. Glossary / فەرهەنگ

- **WIF** — Workload Identity Federation. GitHub → GCP without static keys.
- **blue/green** — Two running versions; shift traffic gradually so a bad
  release affects 1% of users before 100%. (See `scripts/deploy-bluegreen.sh`.)
- **candidate** — A Cloud Run revision with a tag but no traffic yet.
- **scorecard** — `docs/world-class/scorecard.md` — a per-deploy roll-up of
  bundle size, RUM CWV, Sentry crash rate, test stability, doc freshness.
- **sticky comment** — A PR/issue comment that the bot edits in place
  instead of posting new ones each run.
- **RUM** — Real User Monitoring; client-side Web Vitals streamed to BQ.
