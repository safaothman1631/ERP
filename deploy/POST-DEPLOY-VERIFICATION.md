# Post-Deploy Verification / پشکنینی پاش deploy

> Day-1 operator playbook. Run top to bottom after the very first
> production deploy. Each section has an EN explanation followed by KU.
> پاش deploy یەکەم سەرتاپای ئەم فایلە جێبەجێ بکە.

---

## 0. The two URLs you'll need / دوو URL کە پێویستن

| Name | Where it comes from | Example |
|---|---|---|
| **Backend (Cloud Run)** | `deploy/cloudrun-url.txt` (written by `06-deploy-cloudrun.ps1`) | `https://zoho-erp-backend-xxxx-me-central1.a.run.app` |
| **Frontend (Vercel)** | `deploy/vercel-url.txt` (written by `07-deploy-vercel.ps1`) | `https://zoho-erp.vercel.app` |

> Export them for the rest of this doc:
> ```powershell
> $BACKEND = Get-Content deploy/cloudrun-url.txt
> $FRONT   = Get-Content deploy/vercel-url.txt
> ```
> KU: ئەم دوو URL ـە پاش deploy لە دۆخی deploy فۆڵدەرەکەدا تۆمار دەکرێن.

---

## 1. پاش deploy یەکەم چی بکەم / What to do right after the first deploy

EN — Do these in order. Each step takes < 1 minute. If any one fails, STOP
and consult `deploy/RUNBOOK-FIRST-INCIDENT.md`.

KU — بەم ڕیزە جێبەجێی بکە. هەر هەنگاوێک کەمتر لە یەک خولەکە. ئەگەر شکستی هێنا،
ڕاوەستە و سەردانی `RUNBOOK-FIRST-INCIDENT.md` بکە.

1. **Browse the frontend.** Open `$FRONT` in an incognito window. Confirm
   the login page loads, fonts render in Kurdish, no console errors.
   KU: لە دۆخی incognito دا `$FRONT` بکەرەوە، دڵنیابە کوردی دەردەکەوێت.
2. **Hit `/api/health` on the backend.**
   ```powershell
   Invoke-RestMethod "$BACKEND/api/health"
   ```
   Expect: `{ "status": "ok", "version": "<git-sha>", "environment": "production" }`.
   KU: پێویستە `status: ok` بدۆزرێتەوە.
3. **Log in once.** Use a known admin user. Confirm the session cookie is
   set with `Secure; HttpOnly; SameSite=Lax`.
   KU: یەک جار بچۆ ژوورەوە، cookie ـەکە پشت ڕاست بکەوە.
4. **Walk five core routes.** `/invoices`, `/items`, `/contacts`,
   `/banking`, `/reports`. Each must NOT render the 404 page.
5. **Check the receipt printer (POS).** Open `/pos`, scan a test item,
   trigger a sale. Receipt should preview in 80mm format.

---

## 2. چۆن دڵنیا دەبیت Cloud Run کاردەکات / Verify Cloud Run

EN:
```powershell
# 2.1 — service status (must be READY, with no failed revisions)
gcloud run services describe zoho-erp-backend --region me-central1 --format=yaml `
  | Select-String -Pattern "url|latestReadyRevision|conditions"

# 2.2 — live traffic split (100 % to the latest revision)
gcloud run services describe zoho-erp-backend --region me-central1 `
  --format="value(status.traffic)"

# 2.3 — tail logs (Ctrl-C when no errors after 60s)
gcloud beta run services logs tail zoho-erp-backend --region me-central1
```

KU: فەرمانی سەرەوە سێ شت دەکات: دۆخ، traffic، logs. هیچ شتێکی سوور نابێت
هەبێت لە کاتی پشکنیندا.

Common failures / کێشە ئاساییەکان:
- `latestReadyRevision != latestCreatedRevision` → new revision failed to
  go ready. Roll back per RUNBOOK §1.
- `traffic` shows two revisions → blue/green is mid-flight. Wait 5 min.

---

## 3. چۆن دڵنیا دەبیت Vercel کاردەکات / Verify Vercel

EN:
```bash
# 3.1 — check headers (CSP-Report-Only + HSTS must be present)
curl -sI "$FRONT" | grep -iE "content-security|strict-transport|x-frame"

# 3.2 — confirm the production deployment URL matches what vercel reported
vercel ls zoho-erp-frontend --token "$VERCEL_TOKEN" | head -n 5

# 3.3 — verify CDN cache: hit twice; second request must be HIT/cached
curl -sI "$FRONT/assets/index.css" | grep -iE "cache-control|age|x-vercel-cache"
```

KU: سێ شت پشکنین: header های ئەمنیەتی، URL ـی production، cache.

---

## 4. چۆن دڵنیا دەبیت /api/* ـ routes ـ کاردەکات / Verify the /api proxy

EN: Vercel rewrites `/api/*` → `${CLOUDRUN_URL}/api/*`. From the **frontend
origin**, NOT the backend origin:
```bash
curl -s "$FRONT/api/health" | jq .
# Must return the same JSON as $BACKEND/api/health
```
If the response is HTML 404 from Vercel, `CLOUDRUN_URL` env var was not set
in the Vercel project. Fix with:
```bash
vercel env add CLOUDRUN_URL production
# (paste the Cloud Run URL when prompted, then redeploy)
```

KU: ئەگەر HTML 404 وەرگرت، `CLOUDRUN_URL` لە Vercel دانەنراوە.

---

## 5. چۆن Sentry ـ تاقی دەکەیت / Sentry sanity test (deliberate error)

EN: Trigger one error from the frontend and one from the backend; both must
land in their respective Sentry projects within 30 seconds.

**Frontend:** Open browser devtools on `$FRONT` and run:
```js
window.__SENTRY_TEST_BOOM__ = () => { throw new Error("Sentry FE test " + Date.now()); };
window.__SENTRY_TEST_BOOM__();
```
Then refresh the Sentry web UI for `zoho-frontend` → Issues. The error
should appear, tagged with `release: <git-sha>` and `environment: production`.

**Backend:** Hit the dev-only test endpoint (only enabled if
`ENVIRONMENT=development`), OR temporarily exec into the container:
```powershell
gcloud run services proxy zoho-erp-backend --port 8080 --region me-central1
# In another shell:
curl -X POST http://localhost:8080/api/_sentry/boom?token=$env:SENTRY_TEST_TOKEN
```
If the boom endpoint isn't enabled in production (which is the safe
default), use a real user-flow error instead — e.g. POST an invalid invoice
payload — and confirm the validation error reaches Sentry.

KU: تاقیکاری Sentry. ئەرکی بکات کە یەک هەڵە دروست بکەیت و لە web UI ـ ـ
بیبینیت.

---

## 6. چۆن RUM داتا کۆ دەکات / RUM data collection

EN: The frontend ships `frontend/src/observability/vitals.ts`, which
batches Web Vitals and POSTs to `/api/rum/vitals`. The backend's
`rum_ingest.py` streams to BigQuery when `RUM_BIGQUERY_DATASET` is set.

Verify in three places:

1. **Browser network tab** — open `$FRONT`, navigate to `/dashboard`, wait
   5 seconds. A `POST /api/rum/vitals` should appear with payload
   `{ events: [{ metric: "LCP", ... }, ...] }`.
2. **Cloud Run logs** — `gcloud beta run services logs tail zoho-erp-backend
   --region me-central1 | Select-String "rum"`. Look for `rum.enqueue` lines.
3. **BigQuery** — if RUM_BIGQUERY_DATASET is set:
   ```bash
   bq query --use_legacy_sql=false \
     "SELECT COUNT(*) FROM \`$GCP_PROJECT_ID.$RUM_BIGQUERY_DATASET.vitals_raw\` \
      WHERE ts > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)"
   ```
   Must be > 0 after 5 minutes of real traffic.

KU: RUM لە سێ جێگەدا پشک دەکرێت: browser، Cloud Run logs، BigQuery.

---

## 7. چۆن backup verification cron کاردەکات / Backup verification cron

EN: The `backup-verify.yml` workflow runs nightly. To verify it on day 1
without waiting:
```bash
gh workflow run backup-verify.yml
gh run watch  # follow the run
```

Success criteria:
- Latest Firestore export was readable.
- Sample document round-trip restore succeeded.
- Email/Slack alert is suppressed (no failures).

If it fails, check:
- `FIREBASE_STORAGE_BUCKET` env var is set (Cloud Run + GH secret).
- The backup service account has `roles/storage.objectViewer`.

KU: workflow ـی پشکنینی backup شەوانە ئەکار دەکات. بۆ تاقیکردنەوەی
دەستی، `gh workflow run backup-verify.yml`.

---

## 8. چۆن DR drill ـ یەکەم ـ ئەنجام دەدەیت / First disaster-recovery drill

EN: Run this AT MOST 24 hours after first deploy, in a maintenance window.
Total time: 30 min. The goal is to prove you can restore the system from
backups alone.

1. **Snapshot current state** — note revision name, current scorecard,
   user count.
2. **Simulate region loss** — scale Cloud Run min-instances to 0 in
   `me-central1`. Deploy the same image into a fallback region (e.g.
   `europe-west1`). Time how long it takes to point DNS or update the
   Vercel rewrite.
3. **Restore one Firestore collection** — pick a low-volume collection
   (e.g. `categories`), wipe it, restore from the last backup. Verify row
   count matches.
4. **Re-enable** — restore Cloud Run min-instances. Confirm /api/health is
   green.
5. **Document RTO/RPO** — write the measured numbers into
   `deploy/dr-drill-YYYY-MM-DD.md`. RTO < 1 h, RPO < 24 h are the
   day-1 targets.

KU: drill ـی DR یەکجار لە یەک ڕۆژدا ئەنجام بدە. ٣٠ خولەکە. ئامانج
دڵنیابوونە لە توانای گەڕاندنەوە.

---

## 9. چۆن alert ـی Slack/email ـ بەزدارت دەکات / Wire Slack / email alerts

EN: Production needs at least three alert rails:

| Channel | Trigger | How to wire |
|---|---|---|
| **PagerDuty** (or equivalent) | Sentry error rate > 5/min for 5 min | Sentry → Project Settings → Alerts → Issue Frequency. Webhook to PagerDuty. |
| **Slack #zoho-prod-alerts** | Cloud Run 5xx > 1% for 2 min | Cloud Monitoring → Alerting Policy → Notification channel = Slack webhook. |
| **Email digest** | Daily scorecard drop > 5 points | The `post-deploy-scorecard` job posts to a sticky issue; subscribe maintainers to that issue. |

Step-by-step Slack webhook:
1. `slack.com/apps/A0F7XDUAZ-incoming-webhooks` → create webhook for
   `#zoho-prod-alerts`. Copy the URL.
2. In Cloud Monitoring → Alerting → Edit notification channels → New Slack
   channel → paste URL. Name it `prod-slack`.
3. Create policy "Cloud Run 5xx burst": metric `run.googleapis.com/request_count`
   filtered by `response_code_class = "5xx"`, condition: > 1% for 2 minutes.
4. Confirm by sending a test alert: `gcloud alpha monitoring policies test
   <policy-id>`.

KU: سێ ڕێگای ئاگادارکردنەوە پێویستن — PagerDuty بۆ گرنگ، Slack بۆ ناوەند،
ئیمەیڵ بۆ کەم.

---

## 10. Sign-off checklist / لیستی پشتڕاستکردنەوەی کۆتایی

Tick each line when verified. Keep this page filed for audit.

```
[ ] /api/health returns 200 with version=<sha>          (§1.2)
[ ] Frontend renders, Kurdish fonts work                (§1.1)
[ ] Five core routes resolve                            (§1.4)
[ ] Cloud Run service READY, 100% traffic on latest     (§2.1-2.2)
[ ] CSP-Report-Only + HSTS headers present              (§3.1)
[ ] /api/* proxy through Vercel works                   (§4)
[ ] Sentry receives a deliberate FE error (release tag) (§5)
[ ] Sentry receives a deliberate BE error               (§5)
[ ] RUM POST /api/rum/vitals visible in network         (§6.1)
[ ] BigQuery vitals_raw count > 0                       (§6.3)
[ ] backup-verify.yml ran green                         (§7)
[ ] DR drill completed; RTO/RPO documented              (§8)
[ ] Slack alert channel receives test ping              (§9)
```

Signed: ______________________  Date: ______________________
