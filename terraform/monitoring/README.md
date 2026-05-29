# Observability provisioning (`terraform/monitoring`)

Terraform for the zoho ERP observability stack on Google Cloud: dashboards,
alert policies, SLOs, uptime checks, log-based metrics, notification routing,
and the BigQuery RUM warehouse. (Spec: SF5 — T-SF.5.1, 5.3, 5.4, 5.5, 5.10,
5.12, 5.14, 5.15, 5.16.)

> This module **only** manages monitoring resources. It does not manage the
> Cloud Run service, Firestore, DNS, or the app's runtime — those are owned by
> the deploy workflows (`.github/workflows/deploy-*.yml`). It *reads* their
> built-in metrics.

## What it creates

| File             | Resources |
|------------------|-----------|
| `main.tf`        | Providers + GCS backend, notification channels (email / PagerDuty / Slack), 7 log-based metrics, 2 uptime checks, a custom monitored service + 2 SLOs (availability, latency). |
| `dashboards.tf`  | 6 dashboards: **D1** API latency/error, **D2** Firestore, **D3** POS offline sync, **D4** RUM web-vitals, **D5** business KPIs, **D6** per-tenant (templated by `org_id`). |
| `alerts.tf`      | 24 alert policies (latency p95, POS checkout, 5xx rate, fast/slow error-budget burn ×2 SLOs, Firestore read/write quota, backup-verify fail + absence, cert expiry, API/frontend uptime, scheduler job-fail + down, RUM LCP/INP regression, RUM ingest stall, rate-limit spike, POS sync conflicts, e-Fakhata rejections, CPU/memory/instance saturation). |
| `bigquery.tf`    | `rum` dataset + `vitals_raw` (partitioned by `ts`, clustered by tenant/route/metric), `vitals_daily` rollup, `cost_per_tenant_daily`, and the two scheduled queries that populate the rollups. |
| `variables.tf`   | All inputs. |
| `outputs.tf`     | Dashboard URLs, dataset/table names, channel ids, SLO ids, policy count. |

The SQL the scheduled queries run lives in [`sql/observability/`](../../sql/observability):
`rum_daily_agg.sql` (daily web-vitals rollup) and `cost_per_tenant.sql`
(per-tenant cost attribution).

## Prerequisites

1. **Terraform** ≥ 1.5, **gcloud** authenticated as a principal with
   `roles/monitoring.editor`, `roles/bigquery.admin` (or `dataEditor` +
   `bigquery.jobUser`), `roles/bigquerydatatransfer.admin`, and
   `roles/logging.configWriter` on the project.
2. **Enabled APIs** on the project:
   ```bash
   gcloud services enable \
     monitoring.googleapis.com \
     logging.googleapis.com \
     bigquery.googleapis.com \
     bigquerydatatransfer.googleapis.com \
     --project zoho-83cda
   ```
3. **A GCS bucket for remote state** (created once, out of band):
   ```bash
   gsutil mb -l EU -p zoho-83cda gs://zoho-tfstate-monitoring
   gsutil versioning set on gs://zoho-tfstate-monitoring
   ```
4. **The runtime must emit the signals the log-based metrics match.** This
   module's `backup_verify_failed`, `scheduler_heartbeat`, `scheduler_job_failed`,
   `rate_limit_rejected`, `idempotency_replay`, `pos_sync_conflict`, and
   `efakhata_rejected` metrics are derived from structured-log lines. The app
   already emits most; the **scheduler heartbeat** comes from
   `backend/app/observability/heartbeat.py::heartbeat_job` — make sure it is
   registered on the scheduler (see the repo's sharedWiring notes).
5. The Cloud Run service must export the Prometheus `/metrics` surface to Cloud
   Monitoring (Managed Service for Prometheus / OTLP) for the dashboard tiles
   that reference `prometheus.googleapis.com/...`. The latency/error/SLO alerts
   use **Cloud Run built-in metrics** and work without that — the prometheus
   tiles are additive.

## Configuration

Create `backend.hcl` (state location) and `terraform.tfvars` (inputs). Both are
environment-specific; keep secrets out of VCS (use `*.auto.tfvars` in
`.gitignore` or `TF_VAR_*`).

`backend.hcl`:
```hcl
bucket = "zoho-tfstate-monitoring"
prefix = "monitoring/production"
```

`terraform.tfvars`:
```hcl
project_id        = "zoho-83cda"
region            = "me-central1"
environment       = "production"
frontend_base_url = "https://app.zoho-kurdish.iq"
api_base_url      = "https://api.zoho-kurdish.iq"

# BigQuery RUM (location must be a region/multi-region BQ supports).
rum_dataset_id    = "rum"
bigquery_location = "EU"

# Notifications (omit any you don't use).
notification_email = "oncall@zoho-kurdish.iq"
slack_auth_token   = ""            # set via TF_VAR_slack_auth_token
slack_channel      = "#alerts-prod"

# Cost attribution (optional — needs a GCP billing export in BigQuery).
# billing_export_dataset_id = "billing"
# billing_export_table      = "gcp_billing_export_resource_v1_0123AB_4567CD_89EF01"
```

PagerDuty key is **sensitive** — never put it in a committed file:
```bash
export TF_VAR_pagerduty_service_key="<pagerduty events v2 routing key>"
```

## Apply procedure

```bash
cd terraform/monitoring

# 1. Init with the remote-state backend.
terraform init -backend-config=backend.hcl

# 2. Review.
terraform fmt -check
terraform validate
terraform plan -out=monitoring.tfplan

# 3. Apply.
terraform apply monitoring.tfplan

# 4. Grab the dashboard URLs.
terraform output dashboard_urls
```

### Staging

Use a separate state prefix and tfvars:
```bash
terraform init -reconfigure -backend-config=bucket=zoho-tfstate-monitoring \
  -backend-config=prefix=monitoring/staging
terraform apply -var environment=staging -var-file=staging.tfvars
```

## Cost notes

- `vitals_raw` partitions expire after `rum_table_expiration_days` (default 90).
  The daily rollup (`vitals_daily`) is kept for `rum_agg_table_expiration_days`
  (default 730) so trends survive raw-data expiry.
- Queries that scan `vitals_raw` **must** filter on `DATE(ts)` to hit a single
  partition; `rum_daily_agg.sql` does this.
- The cardinality of every Cloud Monitoring metric label is bounded —
  `scripts/observability/check-cardinality.mjs` (run in CI) fails the build if a
  metric gains an unbounded label.

## What this module deliberately does NOT do (external blockers)

- **`terraform apply` against real GCP** — requires the project, enabled APIs,
  the state bucket, and IAM above. Provisioning is a human/cloud step.
- **PagerDuty** — you must create the PagerDuty service + Events v2 integration
  and supply `TF_VAR_pagerduty_service_key`. Without it, page-worthy alerts fall
  back to email/Slack.
- **Slack** — needs the Cloud Monitoring Slack app authorized in your workspace
  and the resulting `auth_token`.
- **Looker Studio** RUM report on `vitals_daily` (D4 links to it) is built in
  the Looker Studio UI; Terraform does not manage Looker Studio assets.
- **GCP billing export** to BigQuery must be enabled in the Cloud Billing
  console before the `cost_per_tenant` scheduled query has a source table.
