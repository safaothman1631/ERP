## ٣) DevOps · SRE · Observability · DR

> دۆخی ئێستا (grounded لە کۆد، ٢٠٢٦-٠٦-٠٣): production لەسەر **`zoho-83cda` / `europe-west1`** زیندووە
> (`deploy/cloudrun-url.txt` → `https://zoho-erp-backend-6plfqh2hiq-ew.a.run.app`؛ `deploy/redeploy-backend.ps1` →
> `--region europe-west1 --project zoho-83cda`). بەڵام ئەم سێ شوێنە هێشتا ئاماژە بۆ پڕۆژەی **کۆن** دەکەن
> (`erp-system-494716` / `me-central1`): (1) Terraform monitoring variables؛ (2) هەردوو deploy workflow؛
> (3) `DISASTER_RECOVERY.md` + `scripts/dr/*.sh`. ئەمە drift-ی ڕاستەقینەیە و یەکەم کاری ئەم بەشە چاکردنیەتی.

این بەش چوار شتی ناتەواو دەگرێتەوە کە بۆ launch-ی ڕاستەقینە بلۆکەرن:

1. **CI/CD** — `startup_failure`-ی auto-deploy + WIF بۆ `zoho-83cda` + gates + blue/green + rollback.
2. **Scheduler** — ٢٠ job-ی in-process کوژێنراونەتەوە (`SCHEDULER_ENABLED:"false"`)؛ دەبێت بگوازرێنەوە بۆ out-of-process.
3. **Observability** — `terraform apply` (٢٤ alert + ٦ dashboard هەرگیز apply نەکراون)، Sentry DSN، PagerDuty، SLO.
4. **DR** — runbook بۆ پڕۆژەی کۆن ئاماژە دەکات؛ RTO/RPO + drill ڕاستەقینە + PITR.

---

### ٣.١ یەکخستنی project/region (پێش هەموو شتێک)

هیچ یەک لەم چاکسازیانە ناکرێن بەبێ یەکخستنی drift-ی region/project. ئەمە تەنها سێ فایل دەستکاری دەکات و
هیچ runtime-ێک ناگۆڕێت — بەڵام بەبێ ئەمە CI، Terraform، و DR runbook هەموویان لە جێی هەڵە کاردەکەن.

**Source of truth (پشتڕاستکراو):**

| شت | کۆن (لە کۆددا) | دروست (production زیندوو) |
|------|------|------|
| GCP project | `erp-system-494716` | **`zoho-83cda`** |
| Region | `me-central1` | **`europe-west1`** |
| Cloud Run service | `zoho-erp` / `zoho-erp-backend` | **`zoho-erp-backend`** |
| Backup bucket | `zoho-83cda-erp-backups` | `zoho-83cda-erp-backups` ✓ (دروستە) |

> **تێبینی Firestore-region:** PITR + GCS export لە Firestore-ی `zoho-83cda` دەبن. ئەگەر Firestore لە
> `nam5`/`eur3` multi-region بوو (نەک `europe-west1` single-region)، ئەوا `--location`-ی DR scripts
> دەبێت لەگەڵ **Firestore database location** بگونجێت، نەک Cloud Run region. ئەمە دەبێت یەکجار بپشکنرێت:
> ```powershell
> gcloud firestore databases describe --database="(default)" --project=zoho-83cda `
>   --format="value(locationId,type,pointInTimeRecoveryEnablement)"
> ```
> بەهای `locationId`-ی ئەنجام بکە بە بەهای `DR_FIRESTORE_LOCATION` لە هەموو شوێنێک (نەک گریمانەی `me-central1`).

---

### ٣.٢ CI/CD — چاکردنی `startup_failure` + WIF + gates

#### ٣.٢.١ هۆکاری `startup_failure` (diagnosis)

`startup_failure` واتە GitHub Actions نەیتوانی workflow-ـەکە **دەست پێ بکات** — پێش هەر step-ێک شکستی هێنا.
لێرە دوو هۆکاری بنەڕەتی هەیە:

**(أ) دوو workflow-ی deploy-ی دژبەیەک هەن** کە هەردووکیان لەسەر `main` فایر دەبن:

- `.github/workflows/deploy-cloudrun.yml` — `on: workflow_run: workflows:["CI"] types:[completed]`. واتە هەر کاتێک
  workflow-ی ناوی **"CI"** تەواو بوو، ئەمە دەست پێ دەکات. ئەگەر `ci.yml` (ناوی `name: CI`) ڕیفاکتەر بکرێت یان
  بسڕێتەوە، `workflow_run` ناتوانێ ئەو workflow-ـە بدۆزێتەوە → `startup_failure` (trigger-ـی نەماو).
- `.github/workflows/deploy-production.yml` — `on: push: branches:[main]`. ئەمە راستەوخۆ لەسەر push فایر دەبێت
  و **`ci-gate` job**-ـی هەیە کە بە `gh run list` پشتڕاست دەکاتەوە کە `ci.yml` + `ci-quality.yml` سەوزن.

ئەمانە لەیەکتر **دووبارەن**: هەردووکیان بۆ هەمان service (`zoho-erp-backend`) لەسەر هەمان region deploy دەکەن.
دەبێت تەنها **یەکێکیان** بمێنێتەوە. (پێشنیار: `deploy-production.yml` بهێڵە — gates-ـی تەواوتری هەیە؛
`deploy-cloudrun.yml` بسڕەوە یان بیکە بۆ `workflow_dispatch`-ـی تەنها.)

**(ب) WIF secrets بۆ پڕۆژەی کۆن ئاماژە دەکەن.** بەپێی تۆماری CLAUDE.md، `GCP_PROJECT_ID` / `GCP_WIF_PROVIDER` /
`GCP_SA_EMAIL` هێشتا → `erp-system-494716`. کاتێک `google-github-actions/auth@v2` بە provider-ـی پڕۆژەیەکی هەڵە
auth بکات، یان WIF pool لە `zoho-83cda` بوونی نەبێت، job-ـەکە لە دەستپێکدا دەشکێت.

> دوو workflow هەروەها naming-ـی جیاوازی secret بەکاردەهێنن: `deploy-cloudrun.yml` → `GCP_SA_EMAIL`،
> بەڵام `deploy-production.yml` → `GCP_SERVICE_ACCOUNT`. ئەگەر تەنها یەکێکیان set کرابێت، ئەوی تر empty-auth
> دەکات و دەشکێت. ئەمەش دەبێت یەکبخرێتەوە (یەک ناو).

#### ٣.٢.٢ دامەزراندنی WIF بۆ `zoho-83cda` (keyless، یەکجار)

WIF (Workload Identity Federation) ڕێگە دەدات GitHub Actions بێ کلیلی JSON (نە `gha-key.json` — کە بەپێی
CLAUDE.md پێشتر بە هەڵە commit کرابوو) auth بکات. هەنگاوەکان لەسەر ماشینی بەکارهێنەر (gcloud auth کراوە):

```bash
PROJECT=zoho-83cda
PROJECT_NUM=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
POOL=github-pool
PROVIDER=github-provider
REPO="<github-org>/<repo>"          # e.g. safaothman/zoho
SA=gha-deployer@${PROJECT}.iam.gserviceaccount.com

# 1) Service account بۆ deploy
gcloud iam service-accounts create gha-deployer --project "$PROJECT" \
  --display-name "GitHub Actions deployer"

# 2) ڕۆڵە پێویستەکان (least-privilege بۆ Cloud Run + Cloud Build + Artifact Registry + Secret read)
for ROLE in roles/run.admin roles/cloudbuild.builds.editor \
            roles/artifactregistry.writer roles/iam.serviceAccountUser \
            roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${SA}" --role="$ROLE"
done

# 3) Workload Identity Pool + OIDC provider بۆ GitHub
gcloud iam workload-identity-pools create "$POOL" --project "$PROJECT" \
  --location=global --display-name="GitHub pool"

gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
  --project "$PROJECT" --location=global --workload-identity-pool="$POOL" \
  --display-name="GitHub provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${REPO}'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 4) ڕێگەدان بە ئەو repo-ـە کە SA-ـەکە impersonate بکات
gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO}"

# 5) چاپکردنی provider resource name بۆ GitHub secret
echo "GCP_WIF_PROVIDER=projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
echo "GCP_SA_EMAIL=${SA}"
echo "GCP_PROJECT_ID=${PROJECT}"
```

دواتر GitHub secrets نوێ بکەرەوە (`gh secret set`):

```bash
gh secret set GCP_PROJECT_ID       --body "zoho-83cda"
gh secret set GCP_WIF_PROVIDER     --body "projects/<NUM>/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
gh secret set GCP_SA_EMAIL         --body "gha-deployer@zoho-83cda.iam.gserviceaccount.com"
gh secret set GCP_SERVICE_ACCOUNT  --body "gha-deployer@zoho-83cda.iam.gserviceaccount.com"  # alias بۆ deploy-production.yml
```

#### ٣.٢.٣ چاکردنی region لە هەردوو workflow

```yaml
# .github/workflows/deploy-cloudrun.yml  AND  deploy-production.yml
env:
  REGION: europe-west1          # بوو: me-central1
  SERVICE: zoho-erp-backend     # یەکدەگرنەوە
```

هەروەها `deploy-production.yml` env-var-ـی hardcoded-ی deploy-candidate لە secret وەربگرە (پێشتر
`FIREBASE_PROJECT_ID=${{ secrets.GCP_PROJECT_ID }}` بەکاردەهێنێت — دروستە، بەس دڵنیابە secret-ـەکە
ئێستا `zoho-83cda`-ـە).

#### ٣.٢.٤ Gates لەسەر PR (tsc/lint/build/test + pytest)

`ci.yml` ئێستا backend + frontend دەپشکنێت، بەڵام دوو لاوازی هەیە کە دەبێت چاک بکرێن:

- **Lint advisory-یە** (`npx eslint . --max-warnings 9999 || true`) — هیچ کاتێک ناشکێت. بەپێی CLAUDE.md، lint
  ئێستا `0 error` دەداتەوە، بۆیە دەکرێ بکرێت بە **blocking بۆ error-ـەکان** (warning-ـەکان نا):
  ```yaml
  - name: Lint (block on errors only)
    run: npx eslint . --max-warnings 9999   # بێ '|| true' → error → fail
  ```
- **Frontend `Install` بەبێ `--legacy-peer-deps`** (`npm ci || npm install`). بەپێی CLAUDE.md، پڕۆژەکە
  پشت بە vite v8 دەبەستێت کە peer-dep conflict-ی هەیە، بۆیە `npm ci`-ـی ساده دەشکێت و دەکەوێتە سەر
  `npm install` (lockfile-ـی ناهەماهەنگ). دەبێت ڕاست بکرێت بۆ هاوتایی لەگەڵ `deploy-production.yml`:
  ```yaml
  - name: Install (legacy peer deps for vite v8)
    run: npm install --legacy-peer-deps
  ```
- **Pytest** لە `ci.yml` کاردەکات (`python -m pytest tests/ -q --maxfail=5`)، بەڵام بەبێ coverage-gate.
  بەپێی تۆماری P0، `pytest.ini` ئێستا `--cov=app --cov-fail-under=0` هەیە (بێ شکاندن). دوای stabilize،
  بەرز بکەرەوە بۆ نموونە `--cov-fail-under=35`.

**ڕیزبەندیی gate-ـی پێشنیارکراو لەسەر PR** (هەمووی blocking):
`backend` (compile + import + pytest + firestore-lints) → `frontend` (tsc + lint-errors + i18n parity + build) →
`e2e-scenarios` + `lighthouse-a11y` (a11y ≥ 0.95). تەنها دوای سەوزبوونی هەمووی، merge بۆ `main` →
`deploy-production.yml`.

#### ٣.٢.٥ Blue/green + revision-tag rollout + rollback

`deploy-production.yml` پێشتر blue/green-ـی ڕاستەقینەی هەیە (`scripts/deploy-bluegreen.sh`، deploy بۆ
`--tag candidate --no-traffic` دواتر traffic-shift 1%→10%→100%). ئەمە بهێڵە، بەس region/project ڕاست بکە.
ئەو نمونەیەی لە `deploy-cloudrun.yml` (deploy ڕاستەوخۆ بۆ 100% traffic) بۆ production باش نییە — ئەمەش
هۆکارێکی تری سڕینەوەی `deploy-cloudrun.yml`-ـە.

**Manual rollback (instant، بەبێ rebuild):**

```bash
# لیستی revision-ەکان
gcloud run revisions list --service zoho-erp-backend \
  --region europe-west1 --project zoho-83cda \
  --format='table(name, active, creationTimestamp)' --limit 10

# 100%-ی traffic بگەڕێنەوە بۆ revision-ی سەوزی پێشوو (~30s)
gcloud run services update-traffic zoho-erp-backend \
  --region europe-west1 --project zoho-83cda \
  --to-revisions=<PREV_REVISION>=100

# پشتڕاست بکەرەوە
curl -sf https://erpiq.systems/api/health
```

**Frontend rollback (Vercel):** `vercel rollback <prev-deployment-url> --token "$VERCEL_TOKEN"` (~5min CDN re-alias).

---

### ٣.٣ Out-of-process scheduler (ئەرکی بلۆکی launch)

#### ٣.٣.١ هۆکار: بۆچی in-process کوژێنرایەوە

`cloudrun-deploy-env.yaml` بە ڕوونی دەڵێت:

```yaml
SCHEDULER_ENABLED: "false"
# Disabled: the in-process APScheduler jobs (e-Fakhata drain, outbox dispatcher)
# hung on Firestore and wedged the shared gRPC channel, causing every query
# (login/signup/me) to time out -> 504.
```

ئەمە بەهۆی **single-uvicorn-process**-ـەوەیە (`Dockerfile` CMD، بێ `--workers`): forking-ی process-ێک کە
Firestore gRPC channel-ـی هەیە، channel-ـەکە دەفڕێنێت (`KeyError in grpc channel_spin`). بۆیە APScheduler
کە لەناو هەمان process-دا job-ـی Firestore-قورس دەخوازێت، channel-ـی هاوبەش wedge دەکات و login تایم-ئاوت دەکات.

ئەنجام: ئەم ٢٠ job-ـە (لە `backend/app/services/scheduler.py`) **هیچیان لە production کار ناکەن**، لەوانە
ئەو ٤ـەی launch-بلۆکەرن:

| Job | Trigger | کاریگەری ئەگەر کار نەکات |
|------|---------|------|
| `efakhata_submission_drain` | هەر 30s | فاکتورا بۆ وەزارەتی دارایی نانێردرێت (compliance) |
| `outbox_dispatch` | هەر 1m | event-ـەکان (webhook/email) ناگەن |
| `payments_reconciliation_nightly` | 02:15 | mismatch-ـی پارەدان دۆزرایەوە نییە |
| `cbi_rate_refresh_daily` | 06:00 UTC | نرخی USD↔IQD نوێ نابێتەوە |
| (+ `daily_backup`, `audit_retention`, `gdpr_hard_delete`, `monthly_depreciation`, `subscription_renewal`, `dunning`, `observability_heartbeat`…) | | backup/retention/billing هەمووی ڕاوەستاون |

> هەروەها `observability_heartbeat` (هەر 5m) ناکار دەبێت، بۆیە alert #15 ("Scheduler heartbeat absent")
> بەردەوام فایر دەکات کاتێک Terraform apply بکرێت — ئەمە یەکێکی تر لە هۆکارەکانە بۆ چارەسەری scheduler
> پێش apply-کردنی observability.

#### ٣.٣.٢ چارەسەر: Cloud Run Job + Cloud Scheduler (پێشنیاری یەکەم)

بنەما: کۆدی job-ـەکان لە جێی خۆیان دەمێننەوە، بەڵام لە **container-ێکی جیاواز** (Cloud Run **Job**، نەک
service) کار دەکەن، کە بە **Cloud Scheduler** (cron-ی managed) trigger دەکرێن. ئەمە channel-ـی Firestore-ی
service-ـی سەرەکی هەرگیز دەستکاری ناکات.

**هەنگاو ١ — entrypoint-ێکی نوێ بۆ job runner** (فایلی نوێ، نموونە `backend/app/jobs_entrypoint.py`):

```python
"""Out-of-process scheduler entrypoint بۆ Cloud Run Jobs.
هەر job-ێک بە env-var ـی JOB_NAME دیاری دەکرێت، یەکجار کاردەکات، دواتر exit.
"""
import os, sys, asyncio, logging
logging.basicConfig(level=logging.INFO)

def main() -> int:
    job = os.environ["JOB_NAME"]
    from app.services import scheduler as s
    table = {
        "efakhata_drain":     s._job_efakhata_submission_drain,
        "outbox_dispatch":    s._job_outbox_dispatch,
        "payments_recon":     s._job_payments_reconciliation,
        "cbi_rate_refresh":   s._job_cbi_rate_refresh,
        "daily_backup":       s._job_daily_backup,
        "audit_retention":    s._job_audit_retention,
        "gdpr_hard_delete":   s._job_gdpr_hard_delete,
        # ...باقیماندە
    }
    fn = table.get(job)
    if fn is None:
        logging.error("unknown JOB_NAME=%s", job); return 2
    fn()   # هەر فەنکشنێک خۆی try/except-ـی هەیە
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

**هەنگاو ٢ — دروستکردنی Cloud Run Job** (هەمان image، entrypoint-ـی جیاواز):

```bash
PROJECT=zoho-83cda; REGION=europe-west1
IMAGE="europe-west1-docker.pkg.dev/${PROJECT}/zoho-images/zoho-erp-backend:latest"

gcloud run jobs create zoho-scheduler-job \
  --image "$IMAGE" --region "$REGION" --project "$PROJECT" \
  --command python --args app/jobs_entrypoint.py \
  --memory 1Gi --cpu 1 --max-retries 1 --task-timeout 600s \
  --set-env-vars "ENVIRONMENT=production,SCHEDULER_ENABLED=false,FIREBASE_PROJECT_ID=${PROJECT}" \
  --set-secrets "SECRET_KEY=zoho-secret-key:latest,FIELD_ENCRYPTION_KEY=field-encryption-key:latest"
```

**هەنگاو ٣ — Cloud Scheduler cron بۆ هەر job-ێک** (یەک entry بۆ هەر تایمینگ، `JOB_NAME` بە override
دەدرێت). نموونە بۆ e-Fakhata drain (هەر 1m — Cloud Scheduler کەمترین granularity-ـی 1 خولەکە، بۆیە
30s-ـی in-process دەبێتە 1m لێرە کە بۆ drain-ـی queue تەواو باشە):

```bash
SA=gha-deployer@${PROJECT}.iam.gserviceaccount.com   # یان SA-ـێکی تایبەت بە scheduler

create_cron () {  # $1=name $2=cron $3=JOB_NAME
  gcloud scheduler jobs create http "$1" --project "$PROJECT" --location "$REGION" \
    --schedule="$2" --time-zone="Etc/UTC" \
    --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT}/jobs/zoho-scheduler-job:run" \
    --http-method=POST \
    --oauth-service-account-email="$SA" \
    --message-body="{\"overrides\":{\"containerOverrides\":[{\"env\":[{\"name\":\"JOB_NAME\",\"value\":\"$3\"}]}]}}"
}

create_cron efakhata-drain   "* * * * *"    efakhata_drain
create_cron outbox-dispatch  "* * * * *"    outbox_dispatch
create_cron payments-recon   "15 2 * * *"   payments_recon
create_cron cbi-rate-refresh "0 6 * * *"    cbi_rate_refresh
create_cron daily-backup     "0 2 * * *"    daily_backup
create_cron audit-retention  "0 6 1 * *"    audit_retention
create_cron gdpr-hard-delete "0 3 * * *"    gdpr_hard_delete
```

> ئەم SA پێویستی بە `roles/run.invoker` لەسەر job-ـەکە هەیە:
> `gcloud run jobs add-iam-policy-binding zoho-scheduler-job --member="serviceAccount:${SA}" --role=roles/run.invoker --region $REGION --project $PROJECT`

**هەنگاو ٤ — heartbeat لە Cloud Run Job:** چونکە alert #15 پشت بە log-line-ـی `scheduler.heartbeat` دەبەستێت،
زیاد بکە یەک Cloud Scheduler cron (هەر 5m) کە `JOB_NAME=heartbeat` بانگ بکات، کە `heartbeat_job()`-ـی
`observability/heartbeat.py` بانگ بکات. ئەمە log-metric-ـی `zoho/scheduler_heartbeat` زیندوو دەکاتەوە.

**هەڵبژاردەی دووەم (Pub/Sub):** ئەگەر fan-out یان retry-ـی پێچیدەترت دەوێت، Cloud Scheduler → Pub/Sub topic →
push subscription بۆ endpoint-ـێکی پارێزراوی Cloud Run. بۆ ئەم ٢٠ job-ـە، Cloud Scheduler → Job-ـی
ڕاستەوخۆ سادەترە و بەس.

> **مەترسیی هاوکات (concurrency):** ئەگەر max-instances-ی service > 1 بوایە، چەند instance هەمان job-یان
> دەخواند. لەگەڵ Cloud Run **Job** ئەمە نییە (تەنها یەک execution فایر دەکرێت)، بەڵام بۆ idempotency،
> job-ـەکان (وەک `daily_backup`) پێشتر per-org loop-یان هەیە کە continue-on-error-ـن.

---

### ٣.٤ Observability — `terraform apply` + Sentry + PagerDuty + SLO

#### ٣.٤.١ دۆخی ئێستا: هەرگیز apply نەکراوە

`terraform/monitoring/` تەواوە و پڕۆداکشن-گرەیدە — ٦ فایل، **٢٤ alert policy** (`alerts.tf`، `outputs.tf`
ـی `alert_policy_count` ئەمە دەژمێرێت) + **٦ dashboard** (`d1_api`…`d6_per_tenant` لە `dashboards.tf`) +
٢ uptime check + ٢ SLO (availability + latency) + ٧ log-based metric + BigQuery RUM dataset. بەڵام:

- **هیچ tfstate نییە** (هیچ `*.tfstate` نەدۆزرایەوە) → هەرگیز apply نەکراوە.
- **`backend "gcs" {}`** بەتاڵە (`main.tf`) — پێویستی بە `backend.hcl` هەیە کە بوونی نییە.
- **variables بۆ پڕۆژەی کۆن default-ـن** (`variables.tf`): `region=me-central1`، `frontend_base_url=https://app.zoho-kurdish.iq`،
  `api_base_url=https://api.zoho-kurdish.iq` — هیچیان لەگەڵ production زیندوو (`erpiq.systems` /
  `europe-west1`) ناگونجێن.

#### ٣.٤.٢ apply-کردن (لەسەر ماشینی بەکارهێنەر)

**یەکەم: GCS bucket بۆ tfstate** (یەکجار):

```bash
gcloud storage buckets create gs://zoho-83cda-tfstate \
  --project zoho-83cda --location europe-west1 --uniform-bucket-level-access
gcloud storage buckets update gs://zoho-83cda-tfstate --versioning  # state-ـی نهێنی بپارێزە
```

**دووەم: `backend.hcl`** (لە `terraform/monitoring/`):

```hcl
bucket = "zoho-83cda-tfstate"
prefix = "monitoring/production"
```

**سێیەم: `production.auto.tfvars`** (git-ignored — نهێنی تێیدایە؛ بپشکنە لە `.gitignore`):

```hcl
project_id        = "zoho-83cda"
region            = "europe-west1"
environment       = "production"
frontend_base_url = "https://erpiq.systems"
api_base_url      = "https://zoho-erp-backend-6plfqh2hiq-ew.a.run.app"
notification_email = "safaothman1631@gmail.com"

# PagerDuty (دوای دروستکردنی account + service — ٣.٤.٤):
# pagerduty_service_key = "<events-api-v2-integration-key>"   # یان TF_VAR_pagerduty_service_key

# Slack (ئیختیاری):
# slack_auth_token = "<oauth-token>"
# slack_channel    = "#alerts-prod"
```

> **ئاگاداری uptime check:** `api_base_url`-ـی `*.run.app` کاردەکات بۆ `/api/health` (uptime check لە
> `main.tf` پات `/api/health` بەکاردەهێنێت). بەڵام `frontend_base_url` دەبێت `erpiq.systems` بێت (Vercel)،
> نەک `app.zoho-kurdish.iq`-ـی کۆن کە هەرگیز deploy نەکراوە. هەروەها دڵنیابە `/api/health` ڕاستەقینە
> بوونی هەیە (نەک تەنها `/api/live`) — `cloudrun-deploy-env.yaml`-ـی healthcheck-ـی Dockerfile پات
> `/api/health` بەکاردەهێنێت، بۆیە بوونی هەیە.

**چوارەم: API-ـە پێویستەکان چالاک بکە + init + plan + apply:**

```bash
gcloud services enable monitoring.googleapis.com bigquery.googleapis.com \
  cloudtrace.googleapis.com logging.googleapis.com --project zoho-83cda

cd terraform/monitoring
terraform init -backend-config=backend.hcl
terraform plan  -var-file=production.auto.tfvars -out=tfplan
terraform apply tfplan
terraform output dashboard_urls       # ٦ URL-ی dashboard
terraform output alert_policy_count   # دەبێت 24 بداتەوە
```

> پێش apply، scheduler (٣.٣) دەبێت زیندوو بێت، نەینا alert #15 (scheduler-down) + #9/#10 (backup-verify)
> یەکسەر فایر دەکەن چونکە هیچ heartbeat/backup-ێک نییە.

#### ٣.٤.٣ Sentry DSN

`backend/app/observability/sentry.py` **mandatory-ـە لە production**: ئەگەر `SENTRY_DSN` نەبێت و
`ENVIRONMENT=production`، `SentryConfigurationError` هەڵدەدات. بەڵام `cloudrun-deploy-env.yaml`-ـی ئێستا
`SENTRY_DSN`-ـی نییە، و `main.py` تەنها init دەکات ئەگەر `settings.SENTRY_DSN` هەبێت (`if getattr(settings,
"SENTRY_DSN", "")`) — بۆیە ئێستا silently skip دەکرێت.

دروستکردنی project لە Sentry → وەرگرتنی DSN → دانانی وەک secret:

```bash
echo -n "https://<key>@<org>.ingest.sentry.io/<project>" | \
  gcloud secrets create zoho-sentry-dsn --data-file=- --project zoho-83cda
gcloud secrets add-iam-policy-binding zoho-sentry-dsn --project zoho-83cda \
  --member="serviceAccount:<cloud-run-runtime-SA>" --role=roles/secretmanager.secretAccessor

# دانانی لە service (یان لە cloudrun-deploy-env.yaml وەک secret-ref):
gcloud run services update zoho-erp-backend --region europe-west1 --project zoho-83cda \
  --update-secrets "SENTRY_DSN=zoho-sentry-dsn:latest"
```

> sample rates پێشتر set کراون لە کۆد (R6.4): `sample_rate=1.0` (100% error)، `traces_sample_rate=0.1`
> (10% perf). `deploy-production.yml` پێشتر `SENTRY_DSN=zoho-sentry-dsn:latest` set دەکات لە candidate —
> بۆیە یەک جار دروستکردنی secret-ـەکە بەسە.

#### ٣.٤.٤ PagerDuty + on-call

`main.tf` کەناڵی PagerDuty تەنها دروست دەکات ئەگەر `pagerduty_service_key != ""` (`local.enable_pagerduty`).
ئەگەر بەتاڵ بێت، alert-ـە page-worthy-ـەکان (CRITICAL) دەکەونە سەر email-ـی تەنها (`local.page_channels`
fallback). بۆ on-call-ـی ڕاستەقینە:

1. لە PagerDuty: دروستکردنی **service** + escalation policy + rotation (`zoho-platform`، کە
   `DISASTER_RECOVERY.md §11` ئاماژەی پێ دەکات).
2. زیادکردنی **Events API v2** integration → کۆپیکردنی integration/routing key.
3. دانانی لە `production.auto.tfvars` (یان `export TF_VAR_pagerduty_service_key=...`) → `terraform apply`.
4. پشتڕاستکردنەوە: `terraform output notification_channels` → دەبێت `pagerduty` id-ـێک نیشان بدات.

routing پێشتر لە کۆد دیاریکراوە: **CRITICAL** (POS checkout latency, 5xx, fast-burn, memory OOM,
backup-fail, scheduler-down, e-Fakhata reject, API uptime) → `page_channels` (PagerDuty)؛ **WARNING**
(Firestore quota, cert, slow-burn, RUM, rate-limit, CPU, instance-ceiling) → `alert_channels` (email/Slack).

#### ٣.٤.٥ SLO + error budget

پێشتر لە `main.tf` پێناسەکراون و apply دەبن لەگەڵ هەموو شتەکە:

- **Availability SLO** = `0.999` (سێ نۆ، `slo_availability_target`)، 28-day rolling، good-ratio = non-5xx.
- **Latency SLO** = 95%-ی request-ـەکان < `300ms` (`slo_api_latency_p95_ms`)، 28-day.
- **Burn-rate alerts** (Google SRE workbook): fast-burn (1h, 14.4×) → PAGE؛ slow-burn (6h, 6×) → TICKET.
  بۆ هەردوو availability و latency.

**Error budget-ـی مانگانە بۆ 99.9%:** ≈ 43m 12s دانابوون لە مانگدا. سیاسەت: ئەگەر بودجە تەواو بوو،
deploy-ی فیچەری نوێ ڕابگرە تا بگەڕێتەوە دۆخی سەوز (تەنها چاکسازیی reliability). ئەمە دەبێت لە
`docs/oncall/` تۆمار بکرێت (CLAUDE.md ئاماژەی پێدەدات کە escalation-policy لەوێیە).

**SLO-ـی تایبەت بە POS** (`slo_pos_checkout_p95_ms = 400`) پێشتر وەک alert #2 (CRITICAL) هەیە، چونکە POS
داهات-گرنگە (revenue-critical).

---

### ٣.٥ چاکردنی DR runbook + RTO/RPO + drill ڕاستەقینە

#### ٣.٥.١ چاکسازیی project/region لە DR (هەموو ئاماژەکان)

`DISASTER_RECOVERY.md` و `scripts/dr/*.sh` بە تەواوی بۆ پڕۆژەی کۆن نووسراون. ئەمانە دەبێت یەکبخرێنەوە
چونکە **drill-ـێکی ڕاستەقینە بەم گریمانانە دەکەوێتە سەر پڕۆژەیەکی هەڵە یان نەماو** و شکست دەهێنێت لە
ساتی هەرە خراپدا (incident-ی ڕاستەقینە).

| فایل | شوێن | بوو | بکە بۆ |
|------|------|------|------|
| `DISASTER_RECOVERY.md` §4.1, §4.2, §12 | Cloud Run rollback/failover | `zoho-erp` / `me-central1` / `erp-system-494716` | `zoho-erp-backend` / `europe-west1` / `zoho-83cda` |
| `DISASTER_RECOVERY.md` §4.3, §4.4 | Firestore PITR/import | `projects/erp-system-494716/databases/(default)` | `projects/zoho-83cda/databases/(default)` |
| `DISASTER_RECOVERY.md` §4.8 | Cloud DNS zone | project `erp-system-494716` | پڕۆژەی DNS-ـی ڕاستەقینەی `erpiq.systems` |
| `scripts/dr/restore-full.sh` | `PROJECT` default (L54) | `erp-system-494716` | `zoho-83cda` |
| `scripts/dr/restore-full.sh` | `LOCATION` default (L58) | `me-central1` | Firestore location-ی ڕاستەقینە (٣.١) |
| `scripts/dr/restore-full.sh` §7 | promotion command | `zoho-erp` / `me-central1` | `zoho-erp-backend` / `europe-west1` |
| `scripts/dr/restore-tenant.sh` | هەمان default-ـەکان | — | هەمان چاکسازی |
| `scripts/dr/provision-dr.sh` | `PROJECT`/`PRIMARY`/`SECONDARY` (L52-56) | `erp-system-494716` / `ME-CENTRAL1` | `zoho-83cda` / `EUROPE-WEST1` (+ secondary واقیعی) |
| `.github/workflows/dr-backup-restore-verify.yml` | `GCP_PROJECT`/`FIRESTORE_LOCATION` (L48,50) | `erp-system-494716` / `me-central1` | `zoho-83cda` / Firestore location |

> **تێبینی promotion-ـی restore-full.sh:** کۆمانتی promotion پات `FIRESTORE_DATABASE_ID` env-var-ـی
> backend دادەنێت. دڵنیابە `main.py`/`config.py` ئەم env-var-ـە دەخوێنێتەوە بۆ هەڵبژاردنی database؛ ئەگەر نا،
> promotion-ـەکە کاری ناکات و دەبێت بە secret-swap (وەک تۆماری migration) بکرێت. ئەمە یەکجار بپشکنرێت.

#### ٣.٥.٢ RTO/RPO (پێشتر دیاریکراو، تەنها reaffirm)

`DISASTER_RECOVERY.md §1` پێشتر RTO/RPO-ـی دیاریکراوی هەیە — ئەمە بهێڵە و بیکە بە official:

| Tier | RTO | RPO |
|------|-----|-----|
| Cloud Run + Vercel (user-facing) | 1 hour | 5 min |
| Firestore (accounting/sales) | 1h (PITR) / 4h (GCS) | 1 min (PITR) / 24h (GCS) |
| Audit log + invoices (legal) | 4 hours | 1 hour |
| RUM/analytics | 24 hours | 24 hours |

این هەژمارەکان دەبێت پشتڕاست بکرێن بە **drill-ـی ڕاستەقینە** (خوارەوە)، نەک تەنها لەسەر کاغەز بمێننەوە.

#### ٣.٥.٣ PITR (پشتڕاستکردن + چالاککردن)

`DISASTER_RECOVERY.md §6` دەڵێت PITR لەسەر `zoho-83cda` چالاکراوە لە 2026-05-26. ئەمە تەنها یەک
فەرمانە بۆ پشتڕاستکردنەوە — دەبێت بکرێت:

```bash
gcloud firestore databases describe --database="(default)" --project=zoho-83cda \
  --format="value(pointInTimeRecoveryEnablement)"
# پێویستە بداتەوە: POINT_IN_TIME_RECOVERY_ENABLED
```

ئەگەر نەبوو، `scripts/dr/provision-dr.sh --project zoho-83cda --dry-run` سەرەتا، دواتر بێ `--dry-run`.
(ئەو سکریپتە idempotent-ـە و PITR + dual-region bucket + WORM retention + lifecycle دادەنێت.)

#### ٣.٥.٤ Drill-ـی ڕاستەقینە (نەک illustrative)

`dr-backup-restore-verify.yml` پێشتر **drill-ـی restore-to-sandbox-ـی ئۆتۆماتیکی هەفتانەی** هەیە (Sundays
03:30 UTC): export-ـێکی هەڕەمەکی هەڵدەبژێرێت، restore دەکاتە sandbox DB-ـێکی throwaway، integrity-sample
دەکات (`verify_restore_sample.py`)، دواتر sandbox-ـەکە دەسڕێتەوە. ئەمە تەنها کار دەکات ئەگەر:

1. **WIF secrets set بن بۆ `zoho-83cda`** (`GCP_WIF_PROVIDER` + `GCP_DR_SERVICE_ACCOUNT`) — وەرنا job-ـەکە
   به-clean skip دەکات (gate لە L57-65). ئەم SA پێویستی بە `roles/datastore.importExportAdmin` +
   `roles/datastore.owner` (بۆ create/delete-ی sandbox DB) + GCS read هەیە.
2. **repo variable-ـەکان نوێ بکرێنەوە:** `DR_GCP_PROJECT=zoho-83cda`، `DR_FIRESTORE_LOCATION=<location>`،
   `BACKUP_GCS_BUCKET=zoho-83cda-erp-backups`:
   ```bash
   gh variable set DR_GCP_PROJECT       --body "zoho-83cda"
   gh variable set DR_FIRESTORE_LOCATION --body "<firestore-location>"
   gh variable set BACKUP_GCS_BUCKET    --body "zoho-83cda-erp-backups"
   ```

**یەکەم drill-ـی manual (لەسەر ماشینی بەکارهێنەر، یەکجار، بۆ پشتڕاستکردنی RTO):**

```bash
# پلانی dry-run (هیچ mutation)
scripts/dr/restore-full.sh --project zoho-83cda --bucket zoho-83cda-erp-backups \
  --location <firestore-location> --dry-run

# restore-ـی ڕاستەقینە بۆ sandbox، + کات بگرە بۆ بەراورد لەگەڵ RTO (1-4h)
time scripts/dr/restore-full.sh --project zoho-83cda --bucket zoho-83cda-erp-backups \
  --destination dr-drill-$(date -u +%Y%m%d) --location <firestore-location> --yes

# تەواوبوون: sandbox-ـەکە بسڕەوە
gcloud firestore databases delete --database=dr-drill-<date> --project zoho-83cda --quiet
```

ئەنجامەکە (کاتی ڕاستەقینەی restore + integrity) لە `DISASTER_RECOVERY.md §10` (drill log) تۆمار بکە، و
بەراوردی بکە لەگەڵ RTO budget-ـی §1. ئەگەر تێپەڕاند، follow-up issue دروست بکە.

**PITR drill (تری، quarterly)** — §8: لە staging یان clone، document-ـێکی test دروست بکە، restore بۆ
`T-5min`، دڵنیابە document-ـەکە نییە. ئەمەش لە drill log تۆمار بکە.

---

### ٣.٦ Scaling — کەی Cloud Run → GKE، HPA، multi-region

#### ٣.٦.١ Single-uvicorn-process — سنوورە بنەڕەتییەکە

`Dockerfile` بە ئەنقەست single-process-ـە (بێ `--workers`):

```dockerfile
# Single process (NO --workers): on Cloud Run you scale by INSTANCES, not by
# in-container workers. `--workers N` forks child processes, and forking a
# process that holds a Firestore gRPC channel corrupts the channel ...
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers ...
```

واتە concurrency تەنها لە دوو ڕێگەوە دێت: (أ) `--concurrency` (request-ـی هاوکات لەناو یەک instance —
ئاسایی لە async FastAPI)، (ب) `--max-instances` (ژمارەی container). **هیچ کاتێک `--workers` زیاد مەکە** —
هەمان channel-corruption-ـی scheduler دەهێنێتەوە.

دۆخی ئێستا (`redeploy-backend.ps1`): `--cpu 1 --memory 1Gi --min-instances 1 --max-instances 3
--concurrency 20`. ئەمە بۆ pre-launch تەواوە.

#### ٣.٦.٢ Cloud Run scaling-ـی نۆرماڵ (پێش GKE)

پێش بیرکردنەوە لە GKE، ئەم چەند knob-ـە بەکاربهێنە — Cloud Run بۆ زۆربەی scale-ـی ERP بەسە:

- **بەرزکردنی `--max-instances`** کاتێک alert #24 (instance-ceiling، threshold=18 لە 20) فایر دەکات.
- **بەرزکردنی `--concurrency`** (مثلاً 20→40) ئەگەر CPU-ی هەر instance کەمە بەڵام instance-ـەکان زۆرن.
- **`--cpu 2` + `--memory`** کاتێک alert #22 (CPU>80%) یان #23 (memory>90% OOM) فایر دەکات.
- **`--min-instances ≥ 1`** بۆ نەهێشتنی cold-start (پێشتر set کراوە؛ هەروەها بۆ scheduler-ـی in-process
  پێویست بوو — بەڵام دوای ٣.٣ ئەو هۆکارە نامێنێت).

#### ٣.٦.٣ کەی بچیتە GKE / K8s

Cloud Run-ـی بهێڵە تا یەکێک لەمانە ڕووبدات (هیچیان لە pre-launch دۆخدا ڕوویان نەداوە):

- **request-ـی زۆر دوور و درێژ (long-lived):** WebSocket/streaming-ی بەردەوام، یان job-ـی > 60 خولەک
  (Cloud Run task timeout سنووردارە). ئەگەر e-Fakhata/backup-ـەکان > 10 خولەک بوون، Cloud Run **Job**
  (٣.٣) بەسە؛ GKE تەنها بۆ کاری زۆر درێژتر.
- **پێداویستیی sidecar/DaemonSet-ی پێچیدە** (service mesh، per-node agent) کە Cloud Run پشتگیری ناکات.
- **کۆنترۆڵی وردی autoscaling** (custom metrics، scale-to-specific-replica) کە Cloud Run knob-ـەکانی
  بەسیان نییە — لێرە **HPA** (HorizontalPodAutoscaler) بەکاردێت کە لەسەر CPU/memory/custom-metric replica
  زیاد/کەم دەکات.
- **هاوبەشی node-ی هەرزانتر لە scale-ی گەورە:** لە throughput-ـی زۆر بەردەوامدا، GKE Autopilot/Standard
  دەکرێت لە Cloud Run هەرزانتر بێت (بەڵام operational-overhead-ـی زۆر زیاترە — patch، upgrade، security).

**ئەگەر بڕیار بە GKE درا:** Autopilot دەست پێ بکە (managed nodes)؛ هەمان single-process container بهێڵە
بەڵام `replicas` بە HPA کۆنترۆڵ بکە (نەک `--workers`)؛ Firestore gRPC channel هەر per-pod-ـە بۆیە
fork-safety-ـی هەمان دەمێنێتەوە. Workload Identity (GKE) جێگەی WIF-ـی CI دەگرێتەوە بۆ pod→GCP auth.

#### ٣.٦.٤ Multi-region

پێش launch پێویست نییە، بەڵام پلانەکە (لە `DISASTER_RECOVERY.md §4.2` ئاماژەی پێدراوە، بەڵام region-ـی
کۆنی تێدایە) دەبێت چاک بکرێت:

- **Cloud Run multi-region:** deploy-ی هەمان image بۆ region-ـی دووەم (مثلاً `europe-west4`)، دواتر
  **Global External HTTPS Load Balancer** + Serverless NEG لەسەر هەردوو region بۆ failover/geo-routing.
  ئەمە بکە بە DR §4.2 (پێشتر "pre-warmed standby" دەڵێت بەڵام بە DNS-CNAME-ـی manual — LB باشترە).
- **Firestore:** multi-region (`eur3`) خۆی replication-ـی دەکات؛ یان dual-region GCS export (پێشتر
  `provision-dr.sh` ئەمە بۆ backup bucket دادەنێت، RPO SLA 15min بە turbo replication).
- **RUM/BigQuery:** `bigquery_location` لە `variables.tf` بە ئەنقەست لە compute-region جیاکراوەتەوە
  (default `EU`) چونکە BQ لە هەندێ region بەردەست نییە — ئەمە بهێڵە.

---

### ٣.٧ پشتڕاستکردنەوە (Windows / cloud) + ڕیزبەندیی rollout

**ڕیزبەندیی جێبەجێکردن (deliberate — هەر هەنگاوێک پشتگیری ئەوی دواتر دەکات):**

1. **یەکخستنی project/region** (٣.١) لە CI workflows + Terraform vars + DR scripts/runbook. هیچ runtime
   ناگۆڕێت — تەنها چاکردنی drift.
2. **Out-of-process scheduler** (٣.٣) — **پێش** observability apply، نەینا alert #15 (scheduler-down) +
   #9/#10 (backup) یەکسەر فایر دەکەن.
3. **WIF بۆ `zoho-83cda`** + سڕینەوەی deploy workflow-ـی دووبارە + چاکردنی gate-ـەکان (٣.٢).
4. **Sentry DSN secret** (٣.٤.٣) — چونکە production-mandatory-ـە، ئەمە پێش deploy-ـی نوێ.
5. **PagerDuty service** (٣.٤.٤) → `terraform apply` (٣.٤.٢) — ٢٤ alert + ٦ dashboard.
6. **DR scripts/runbook چاکسازی** (٣.٥) + repo variables بۆ `dr-backup-restore-verify.yml`.
7. **یەکەم DR drill-ـی manual** (٣.٥.٤) + تۆمارکردن لە drill log.

**فەرمانەکانی پشتڕاستکردنەوە (لەسەر ماشینی بەکارهێنەر):**

```powershell
# CI/CD — push بکە بۆ branch، dispatch بکە، بزانە startup_failure نەماوە
gh workflow run "Production Deploy"
gh run watch --exit-status

# Backend زیندوو (cloud)
curl.exe -sf https://erpiq.systems/api/health
gcloud run services describe zoho-erp-backend --region europe-west1 --project zoho-83cda `
  --format="value(status.url,status.traffic)"

# Scheduler (out-of-process) — execution-ـی یەکەم بپشکنە
gcloud run jobs executions list --job zoho-scheduler-job --region europe-west1 --project zoho-83cda
gcloud scheduler jobs list --location europe-west1 --project zoho-83cda

# Observability — apply سەرکەوتوو بوو؟
cd terraform/monitoring; terraform output alert_policy_count   # 24
gcloud monitoring dashboards list --project zoho-83cda --format="value(displayName)" | Measure-Object  # 6

# Sentry — DSN زیندووە؟ (لۆگی startup-ی Cloud Run)
gcloud run services logs read zoho-erp-backend --region europe-west1 --project zoho-83cda `
  --limit 50 | Select-String "sentry"

# PITR + backup
gcloud firestore databases describe --database="(default)" --project zoho-83cda `
  --format="value(pointInTimeRecoveryEnablement)"
gcloud storage ls gs://zoho-83cda-erp-backups/firestore/ | Select-Object -Last 3
```

**Gate-ـی frontend (پێش deploy، وەک CLAUDE.md):**

```powershell
cd frontend
npx tsc --noEmit            # 0
npm run lint                # exit 0 (0 error)
npm run build               # exit 0
npm run test                # 1322/1322
```

> **تێبینیی پاکیی repo (لە P0):** `gha-key.json` + `deploy/TEST*.txt` پێشتر بە `git rm --cached` لابران
> (commit نەکراون). دڵنیابە CI هیچ کلیلی JSON-ـی deploy بەکارناهێنێت — تەنها WIF (keyless). `deploy/`-ـی
> `*.ps1` سکریپتەکان (`migrate-backend-to-zoho-83cda.ps1`، `redeploy-backend.ps1`) source-of-truth-ـی
> ڕاستەقینەن بۆ region/project دروست (`europe-west1`/`zoho-83cda`) و دەکرێن وەک مۆدێل بۆ یەکخستنی CI.
