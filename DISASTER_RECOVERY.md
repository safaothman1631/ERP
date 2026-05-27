# Disaster Recovery Runbook — ERPIQ / Zoho Kurdish ERP

> **Spec ref:** requirements.md §10.6 (R10.6), §5.9 (R5.9), tasks.md T-6.8
> **Owner:** Tech lead + DevOps
> **Last drill:** see §10 (drill log) — quarterly cadence

This runbook covers the end-to-end response when a major production
component fails or data is lost. It is **not** a step-by-step for
day-to-day incidents — those are in `docs/runbooks/*.md`.

## 1. RTO / RPO targets

| Tier | Recovery Time Objective (RTO) | Recovery Point Objective (RPO) |
|---|---|---|
| **User-facing service (Cloud Run + Vercel)** | **1 hour** | **5 minutes** |
| **Firestore (accounting + sales data)** | **1 hour** to PITR; 4 hours to full GCS-restore | **1 minute** (PITR) / 24 hours (GCS backup) |
| **POS offline queue (client-side IndexedDB)** | 1 hour after connectivity restored | N/A — client-resident |
| **Audit log + invoices (legal records)** | 4 hours | 1 hour |
| **RUM + analytics (non-critical)** | 24 hours | 24 hours |

The P6 target tightens the *service-tier* RTO/RPO. The legacy 24h /
4h numbers remain for the GCS backup path because that's the
fall-back when PITR is unavailable.

## 2. Incident severities

| Severity | Definition | First response |
|---|---|---|
| **SEV-1** | Customer-impacting outage; service unavailable; data integrity at risk. | Page on-call; bridge in 10 min; CEO informed in 30 min. |
| **SEV-2** | Degraded service; major feature unavailable; no data integrity risk. | Page on-call; bridge in 30 min. |
| **SEV-3** | Single-tenant impact OR latent risk (e.g. expiring cert). | Ticketed; same-business-day. |

A SEV-1 triggers this runbook. SEV-2 and SEV-3 use the per-component
runbooks.

## 3. First-15-minutes checklist

1. Open the `#incident` Slack channel and post `#incident sev=1 ts=<utc>`.
2. Open the Cloud Monitoring incident dashboard.
3. Assign roles on the bridge:
   * **Incident Commander (IC)** — keeps the bridge moving, makes go/no-go calls.
   * **Operator** — runs the commands.
   * **Scribe** — keeps a minute-by-minute log in `audit/incidents/<date>-<topic>.md`.
   * **Communications** — drafts customer comms.
4. Classify the failure (Cloud Run / Firestore / Vercel / Redis / DNS).
5. Decide: **isolated rollback** vs **full-region failover** vs **wait**.

## 4. Failure-class playbooks

### 4.1 Cloud Run — bad deploy

```bash
# List recent revisions
gcloud run revisions list --service=zoho-erp \
  --region=me-central1 --project=erp-system-494716 \
  --limit=10 --format='table(name, deploymentTime, active)'

# Roll back to the previous green revision (single command, instant)
gcloud run services update-traffic zoho-erp \
  --region=me-central1 --project=erp-system-494716 \
  --to-revisions=<PREV_REV_NAME>=100
```

ETA: 60-90 seconds. Verify with `curl /api/health`.

### 4.2 Cloud Run — region outage

If `me-central1` is in a confirmed GCP-side incident:

```bash
# Pre-warmed standby revision lives in asia-southeast1
gcloud run services update-traffic zoho-erp \
  --region=asia-southeast1 --project=erp-system-494716 \
  --to-latest

# Update DNS to point the API CNAME at the standby region
gcloud dns record-sets transaction start --zone=zoho-kurd-iq
gcloud dns record-sets transaction add \
  --zone=zoho-kurd-iq --name=api.erp.zoho.kurd.iq. --type=CNAME --ttl=60 \
  zoho-erp-asia.run.app.
gcloud dns record-sets transaction execute --zone=zoho-kurd-iq
```

Latency rises (50-90 ms additional from Iraq). Re-verify p95 in RUM after 5 minutes.

### 4.3 Firestore — accidental delete or bad migration

Use **Point-in-Time Recovery (PITR)** — restores to any timestamp in the past 7 days, granularity 1 minute.

```bash
# Find when the bad write happened (timestamp T_bad)
gcloud logging read \
  'protoPayload.serviceName="firestore.googleapis.com"
   protoPayload.methodName=~"BatchWrite|Commit"
   timestamp > "T_bad - 5min"' \
  --limit 50

# Restore to T_bad - 1 minute, into a new database
gcloud firestore databases restore \
  --source-database=projects/erp-system-494716/databases/(default) \
  --source-snapshot-time="2026-05-27T14:32:00Z" \
  --destination-database=zoho-restore-$(date +%s) \
  --project=erp-system-494716
```

ETA: 30-60 minutes depending on tenant size. Verify the restore database has the expected docs (sample 10), then promote: backend reconfigured via secret swap, or selective re-import.

### 4.4 Firestore — full disaster (PITR unavailable, e.g., older than 7 days)

Fall back to nightly GCS export:

```bash
# Find the most recent good export
gsutil ls gs://zoho-83cda-erp-backups/firestore/

# Restore into a new database
gcloud firestore import \
  gs://zoho-83cda-erp-backups/firestore/2026-05-26/ \
  --database=zoho-restore-gcs \
  --project=erp-system-494716
```

ETA: 1-4 hours for tenants up to 500k docs (R5.9 budget).

### 4.5 Vercel — bad deploy

```bash
# List recent deployments
vercel deployments ls --token "$VERCEL_TOKEN"

# Roll back by aliasing the prior deployment's domain
vercel rollback <prev-deployment-url> --token "$VERCEL_TOKEN"
```

ETA: 60-90 seconds. CDN re-aliases globally within ~5 minutes.

### 4.6 Vercel — region outage

Vercel's edge has its own failover; from our side, no action required. Watch the CWV dashboard for the regional impact.

### 4.7 Redis — outage

See `docs/runbooks/redis-down.md`. Service degrades but continues; not a SEV-1 unless prolonged > 1 hour or paired with another failure.

### 4.8 DNS — registrar / Cloud DNS failover

Production DNS is on **Cloud DNS** (project `erp-system-494716`, zone `zoho-kurd-iq`). If Cloud DNS is unavailable (rare; Google's DNS uptime SLA is 100%):

* Failover to a pre-configured secondary at AWS Route 53. Records are mirrored quarterly via `infra/dns-mirror.sh`.
* Update the registrar's nameservers to the Route 53 set (propagates in 5-15 min).

### 4.9 Secret compromise (e.g., SECRET_KEY leaked)

See `docs/security/secret-rotation.md` §5. Summary:

1. Disable the leaked secret version.
2. Mint a new version: `./scripts/rotate-secret.sh --secret SECRET_KEY`.
3. Cloud Run rolls automatically.
4. Force-logout all users (rotating `SECRET_KEY` invalidates all JWTs).
5. Audit Secret Manager access logs for the past 30 days.

## 5. Communications template

```
[Subject] Zoho ERP — Service notice
[Body]
We are aware of an issue affecting <feature> for some customers. Our
engineering team is investigating. We will update this status every
15 minutes.

Started: <UTC>
Affected: <approximate %>
Status: investigating | identified | mitigating | recovered
```

Channels: in-app banner via `/api/system/banner`; status page (`status.zoho.kurd.iq`); email to all tenant admins via SendGrid template `incident-v1`.

## 6. Backups

* **Firestore:** nightly export to `gs://zoho-83cda-erp-backups/firestore/<date>/`. Verified by `.github/workflows/backup-verify.yml`.
* **GCS lifecycle:** 90 days standard, 365 days nearline, 7 years coldline.
* **PITR:** enabled on `zoho-83cda` since 2026-05-26 (`POINT_IN_TIME_RECOVERY_ENABLED`).

```bash
# Verify PITR
gcloud firestore databases describe --database="(default)" --project=zoho-83cda \
  --format="value(pointInTimeRecoveryEnablement)"
```

* **Security rules** (`firestore.rules`): deploy via `firebase deploy --only firestore:rules --project PROJECT_ID`.

## 7. Post-incident

Within **48 hours** of resolution:

1. Scribe finalises `audit/incidents/<date>-<topic>.md` with the timeline.
2. IC drafts a blameless postmortem in `audit/incidents/postmortems/`.
3. Action items filed as GitHub issues with the `incident-followup` label.
4. The next on-call rotation reviews the postmortem at the weekly ops sync.

## 8. PITR drill checklist (quarterly)

1. Note current timestamp `T0` in runbook appendix.
2. In a non-prod clone (or staging org): create a labeled test document `drill-{quarter}`.
3. Restore Firestore to `T0 - 5 minutes` via gcloud (per-project procedure documented).
4. Verify the test document is absent; run the accounting smoke on the clone.
5. Record drill date, operator, and timings in §10 below.

## 9. Tabletop drill — full procedure (T-6.8)

The quarterly DR drill is a **tabletop exercise plus a real-side procedure** on staging. Walk through every step in §4 in scripted sequence:

1. **Pre-flight (1h before):**
   * Verify staging is healthy; freeze deploys for the drill window.
   * Ensure on-call is paged in.
2. **Scenario announcement:** IC declares "SEV-1: Cloud Run me-central1 unreachable" (or similar from the rotation list).
3. **Execute the playbook (§4.x) against staging.**
4. **Time each step:** start of step → command issued → verification green.
5. **Stop the clock** when `/api/health` on the failover region returns 200 from at least 3 geographic probes.
6. **Compare:** total time vs the RTO budget (§1). If we missed, file follow-ups.
7. **Restore staging** to pre-drill state.
8. **Write up** in `audit/dr/YYYY-Qn-drill.md`.

## 10. Drill log

### 10.1 PITR drill

| Quarter | Date | Operator | Result | Notes |
|---|---|---|---|---|
| 2026-Q2 | 2026-05-26 | platform | Documented procedure; staging drill scheduled | PITR enabled on zoho-83cda |
| 2026-Q3 | (planned) | TBD | (template: `audit/dr/2026-Q3-drill.md`) | |

### 10.2 Backup restore drill

Command: `python backend/scripts/backup_restore_drill.py --org-id ORG [--base-url URL --email E --password P]`

| Date | Operator | Result | Notes |
|---|---|---|---|
| 2026-05-26 | prelaunch_ops | PASS | firestore deploy zoho-83cda indexes+TTL (TTL state CREATING → ACTIVE) |
| 2026-05-26 | prelaunch_ops | PASS | backup `gs://zoho-83cda-erp-backups` org `064a4a1a…` (1575 docs) + reconcile 0 drift + smoke PASS |

### 10.3 Automated drill log

| Date | Operator | Result | Notes |
|---|---|---|---|
| 2026-05-26 | drill | PASS | org=`064a4a1a-487b-4835-a42a-4806ba8add72` |

## 11. Contacts

* **On-call:** platform team (PagerDuty rotation `zoho-platform`)
* **Tech lead:** Safa Othman
* **DevOps lead:** TBD (track in `OPERATIONS_RUNBOOK.md`)
* **Security lead:** TBD
* **Escalation:** Tech lead → CEO → Investor relations (if customer-impacting > 4h)
* **Vendor support:**
  * Google Cloud Premium Support (case opens from the GCP console)
  * Vercel Enterprise Support (`support@vercel.com`)
  * Sentry (`support@sentry.io`)

## 12. Appendix — quick-reference commands

```bash
# Status
curl -sf https://api.erp.zoho.kurd.iq/api/system/health | jq .

# Roll back Cloud Run
gcloud run services update-traffic zoho-erp --region me-central1 \
  --project erp-system-494716 --to-revisions PREV=100

# Roll back Vercel
vercel rollback <prev-deployment-url>

# Drain rate limiter (during a redis-down event)
gcloud run services update zoho-erp --region me-central1 --project erp-system-494716 \
  --update-env-vars RATE_LIMIT_DEFAULT_OFF=1

# Force-log-out everyone (last resort, e.g., compromised SECRET_KEY)
./scripts/rotate-secret.sh --secret SECRET_KEY
```
