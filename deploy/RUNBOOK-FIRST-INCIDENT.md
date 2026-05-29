# Runbook — First Production Incident / یارمەتیی کێشەی یەکەمی production

> Keep this open in a tab. When the page is on fire, you don't want to be
> reading docs cold.
> ئەم فایلە لە tab ـێکدا کراوە بهێڵە. کاتێک سیستەم بەشێوەی نائاسایی هەڵدەکات،
> پێویست ناکات لە سفرەوە بگەڕێیت.

---

## 1. Signs of an incident / نیشانەکانی incident

| Signal | Where you'll see it | Severity hint |
|---|---|---|
| **5xx burst** | Cloud Monitoring / Cloud Run dashboard, Slack `#zoho-prod-alerts` | SEV1 if > 5% for 5 min |
| **Sentry error spike** | Sentry email alert, project dashboard for `zoho-backend` / `zoho-frontend` | SEV1 if new error type with > 50 events/h |
| **RUM CWV regression** | World-class scorecard, BigQuery `vitals_raw` p75 LCP > 3s | SEV2 if sustained > 30 min |
| **/api/health failure** | Cloud Run uptime check, external probe | SEV1 |
| **Vercel 5xx** | Vercel dashboard, frontend monitoring | SEV2 (frontend) / SEV1 (proxy down) |
| **Backup verify red** | `backup-verify.yml` workflow fails | SEV3 → SEV2 if 2+ days red |
| **DB connection pool exhaustion** | Logs: `pool exhausted`, `connection refused` | SEV1 |
| **Auth/JWT broken** | Spike in `401`, support tickets, Sentry `JWTError` | SEV1 |

KU: ئەم نیشانانە چاو لێبکە، چ شتێک سوور بێت یا کوژراوە.

---

## 2. Severity tiers / پلەکانی SEV

| Tier | Definition | Who you wake | Initial response time |
|---|---|---|---|
| **SEV1** | Production fully or partly DOWN, OR data loss risk, OR security incident | On-call engineer + Safa (founder) immediately | 5 min |
| **SEV2** | Major feature degraded, but users can still transact (e.g. reports broken, slow checkout) | On-call within business hours; founder notified | 30 min |
| **SEV3** | Cosmetic / minor (e.g. one rarely-used module 500s) | Open ticket; fix in next business day | 24 h |

> **Founder contact:** `safaothman1631@gmail.com` — escalate to phone if no
> response within 10 min of a SEV1.

KU: SEV1 یاخود SEV2 — تەلەفۆن بکە. SEV3 — تەنها تیکێت بنووسە.

---

## 3. First five minutes / یەکەم پێنج خولەک

EN — Don't debug. Roll back. Always.

KU — تەرکیز لەسەر تاقیکردنەوە مەکە. یەکسەر بگەڕێرەوە بۆ revision کۆن.

### 3.1 Roll back Cloud Run

```powershell
# List recent revisions (latest first)
gcloud run revisions list --service zoho-erp-backend --region me-central1 `
  --format="table(metadata.name, metadata.creationTimestamp, status.conditions[0].status)" `
  --sort-by=~metadata.creationTimestamp `
  --limit 5

# Identify the last KNOWN-GOOD revision (e.g. zoho-erp-backend-00042-abc).
# Shift 100% of traffic back to it:
$GOOD_REVISION = "zoho-erp-backend-00042-abc"   # <-- paste here

gcloud run services update-traffic zoho-erp-backend `
  --region me-central1 `
  --to-revisions "${GOOD_REVISION}=100"
```

Confirm:
```powershell
gcloud run services describe zoho-erp-backend --region me-central1 `
  --format="value(status.traffic)"
```
Must show `100%` on `$GOOD_REVISION`. Hit `/api/health`. Confirm green.
KU: دڵنیابە ١٠٠٪ ـی traffic بۆ ـ revision کۆن دەچێت.

### 3.2 Roll back Vercel

Vercel keeps every deployment forever. Promote a previous one:
```bash
vercel ls zoho-erp-frontend --token "$VERCEL_TOKEN"
# Find the last-known-good deployment URL (e.g. https://...-abc.vercel.app)
vercel promote https://zoho-erp-frontend-abc.vercel.app --token "$VERCEL_TOKEN"
```

### 3.3 Announce in `#zoho-prod-alerts`

Template (paste and edit):
```
:rotating_light: SEV<X> opened at <time> — <one-line description>
- Symptom: <e.g. /api/invoices returns 502, started ~10 min ago>
- Impact: <e.g. ~50% of users can't create invoices>
- Action: rolled Cloud Run back to <revision>, investigating.
- Incident commander: <your name>
```

KU: شتێک ساکارە بنووسە لە Slack. هەموو شتێک نەکە ـ تەنها ئاگاداربە.

---

## 4. Sentry release triage / شیکارکردنی Sentry

EN: Once stable, find the error that triggered the rollback:

1. Open Sentry → `zoho-backend` (or `zoho-frontend`) → Releases.
2. Find the release tagged with the deployed SHA (matches `APP_VERSION`).
3. Look at "First seen in this release" — those are your suspects.
4. Click into the top issue. Read the stack trace. Check the breadcrumbs
   for the request path and tenant.
5. Compare with the previous release. If the issue is new, you have a
   regression. If it's an older issue that suddenly spiked, you have a
   load/data change.

```bash
# Useful CLI shortcut:
sentry-cli releases info "$GIT_SHA" \
  --org zoho-org --project zoho-backend
```

KU: لە Sentry هەڵە سەرەکیەکە بدۆزەرەوە. لە stack trace ـ بخوێنەرەوە.

---

## 5. RUM data for deploy-attributable regressions / شیکاری RUM

EN: A regression that doesn't show up in Sentry (slow but not erroring)
will show up in RUM:

```sql
-- BigQuery: compare p75 LCP for the last 24h vs the prior 24h
WITH windows AS (
  SELECT
    IF(ts > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR), 'now', 'before') AS bucket,
    appVersion,
    metric,
    value
  FROM `${PROJECT}.${DATASET}.vitals_raw`
  WHERE ts > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 48 HOUR)
    AND metric = 'LCP'
)
SELECT
  bucket,
  appVersion,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75_lcp
FROM windows
GROUP BY 1, 2
ORDER BY 1, 2;
```

If `p75_lcp` jumped > 500 ms between the two windows AND the new
`appVersion` matches the deploy SHA, the deploy is the cause. Roll back.

KU: ئەگەر LCP لە دوای deploy خراپ بوو، ئەو deploy ـە هۆکارە.

---

## 6. User-facing statement / نووسینێک بۆ بەکارهێنەران

EN — Templates. Adapt as needed.

**During (SEV1):**
> EN: We're aware of an issue affecting [feature] and are actively
> working on it. Updates every 15 minutes. Status page: [link].
>
> KU: ئێمە ئاگاداری کێشەیەکین لە [بەش] و کارمان لەسەری دەکەین. هەر
> ١٥ خولەک ڕاپۆرتی نوێ. لاپەڕەی دۆخ: [بەستەر].

**Resolved (post-incident):**
> EN: The issue affecting [feature] is now resolved (resolved at [time]).
> Total impact: ~[N] users, ~[M] minutes. A full post-mortem will be
> shared in 48 hours.
>
> KU: کێشەکە چارەسەرکراوە (لە [کات] ـدا). ـ [N] بەکارهێنەر بۆ [M] خولەک
> کاریگەری لێبوون. پاش ٤٨ کاتژمێر ڕاپۆرتێکی تەواو بڵاو دەکرێتەوە.

KU: کورت بنووسە، ڕاست بنووسە، گومان دروست مەکە.

---

## 7. Post-incident: postmortem template / دوای incident

Create `postmortems/YYYY-MM-DD-<slug>.md`:

```markdown
# Postmortem — <one-line title>

**Date:** YYYY-MM-DD
**Severity:** SEV<X>
**Duration:** HH:MM – HH:MM (UTC) — total <N> minutes
**Incident commander:** <name>
**Authors:** <names>

## Summary
<2-3 sentences: what broke, who saw it, how it was fixed.>

## Impact
- Users affected: <count or %>
- Features affected: <list>
- Data loss / corruption: <yes/no, scope>
- Revenue impact: <estimate>

## Timeline (UTC)
| Time | Event |
|---|---|
| HH:MM | <deploy/alert/action> |
| ... | ... |

## Root cause
<5-Whys analysis. Be specific. "Bug in X" is not a root cause; "We
allowed Y to ship without Z guard" is.>

## What went well
- <e.g. Sentry alerted within 30s>
- <e.g. rollback was one command>

## What went badly
- <e.g. nobody saw the Slack alert for 12 min>
- <e.g. the rollback procedure was missing for Vercel>

## Action items
| # | Action | Owner | Due | Severity |
|---|---|---|---|---|
| 1 | Add health probe to /api/<endpoint> | <name> | YYYY-MM-DD | high |
| 2 | Document Vercel rollback in runbook | <name> | YYYY-MM-DD | medium |

## Lessons
<Plain-language paragraph. What will we do differently?>

---
File this in `postmortems/`, link from the closed incident ticket, and
schedule a 30-min review meeting within 7 days.
```

KU: postmortem نووسین واتە فێربوون. بێ نووسین هیچ نەفێر دەبیت.

---

## 8. Pre-built rollback one-liners / فەرمانە یارمەتیدەرەکان

```powershell
# Roll Cloud Run to N-1
$REV = (gcloud run revisions list --service zoho-erp-backend --region me-central1 `
        --sort-by=~metadata.creationTimestamp --format="value(metadata.name)" --limit 2)[1]
gcloud run services update-traffic zoho-erp-backend --region me-central1 `
  --to-revisions "${REV}=100"

# Drain traffic from current revision to zero
gcloud run services update-traffic zoho-erp-backend --region me-central1 `
  --to-latest=0 --to-revisions "${REV}=100"

# Scale to zero (kill switch — use only if revisions are all bad)
gcloud run services update zoho-erp-backend --region me-central1 `
  --min-instances=0 --max-instances=0
# (Run service is now serving 0 traffic — frontend will get 5xx.)

# Re-enable after fix
gcloud run services update zoho-erp-backend --region me-central1 `
  --min-instances=1 --max-instances=20
```

```bash
# Vercel: list recent and promote last good
vercel ls zoho-erp-frontend --token "$VERCEL_TOKEN" | head -n 10
vercel promote <deployment-url> --token "$VERCEL_TOKEN"

# Vercel: temporary maintenance mode (manual)
# Create a vercel.json branch with all routes returning a 503 maintenance
# page, push to main, deploy.
```

---

## 9. Escalation tree / دار escalation

```
                ┌─────────────┐
                │ SEV1 detected│
                └──────┬───────┘
                       │
              ≤ 5 min  ▼
        ┌──────────────────────┐
        │ On-call engineer ack │
        └──────┬───────────────┘
               │ if no fix in 15 min, OR data loss risk
               ▼
       ┌────────────────────┐
       │ Page founder (Safa)│
       └──────┬─────────────┘
              │ if no fix in 30 min total
              ▼
     ┌─────────────────────┐
     │ Convene war-room    │  ← all hands; consider customer notice
     └─────────────────────┘
```

KU: ئەگەر هیچ کەس وەڵام نەدا، تەلەفۆن بکە بۆ ـ Safa.

---

## 10. Don't / مەکە

- Don't `git push --force` to main during an incident.
  KU: کاتی incident بە `--force` push مەکە.
- Don't disable monitoring to silence alerts.
  KU: بۆ بێدەنگکردنی Slack، monitoring لاد نەنیە.
- Don't deploy a "small fix" without a rollback plan.
  KU: deploy ـی نوێ بێ ـ rollback ـ مەکە.
- Don't talk to users without coordinating with the IC.
  KU: قسە لەگەڵ بەکارهێنەران نەکە بێ هاوبەشی IC.
