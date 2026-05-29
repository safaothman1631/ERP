# =============================================================================
# bigquery.tf — RUM analytics warehouse (T-SF.5.5)
# =============================================================================
# Creates the `rum` dataset and the tables the RUM ingest service streams into,
# plus the rollup tables the dashboards/SQL read. Schemas mirror exactly the
# rows produced by backend/app/services/rum_ingest.py::_row_for and the daily
# rollup in sql/observability/rum_daily_agg.sql.
#
# Partitioning + clustering choices:
#   - vitals_raw is partitioned by ingest DAY on `ts` (the event timestamp) so
#     a day of data is one partition → cheap time-window scans, and we set a
#     partition expiration to control storage cost.
#   - clustered by (tenant_id, route, metric) — the three columns every RUM
#     query filters/groups on. Clustering keeps per-tenant + per-route scans
#     from reading the whole partition.
# =============================================================================

resource "google_bigquery_dataset" "rum" {
  dataset_id    = var.rum_dataset_id
  project       = var.project_id
  location      = var.bigquery_location
  friendly_name = "zoho RUM (${var.environment})"
  description   = "Real-User-Monitoring web-vitals raw stream + daily rollups. Streamed from /api/rum/vitals."

  # Tables created here set their own expiration; leave the dataset default
  # unset so we don't accidentally expire the rollup tables.
  delete_contents_on_destroy = false

  labels = local.common_labels
}

# ---- vitals_raw: streaming-insert target ---------------------------------
# Matches RUMIngestService._row_for exactly. `extra="ignore"` upstream means
# new client fields won't break ingest; add columns here when promoting them.

resource "google_bigquery_table" "vitals_raw" {
  dataset_id          = google_bigquery_dataset.rum.dataset_id
  project             = var.project_id
  table_id            = "vitals_raw"
  description         = "Raw Core Web Vitals events (one row per metric sample). Streaming-insert target of the RUM ingest service."
  deletion_protection = true

  time_partitioning {
    type          = "DAY"
    field         = "ts"
    expiration_ms = var.rum_table_expiration_days > 0 ? var.rum_table_expiration_days * 24 * 60 * 60 * 1000 : null
  }

  clustering = ["tenant_id", "route", "metric"]

  schema = jsonencode([
    {
      name        = "session_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Opaque per-session id generated client-side."
    },
    {
      name        = "tenant_id"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "org_id of the tenant; null on pre-auth routes (login/landing)."
    },
    {
      name        = "app_version"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "VITE_APP_VERSION of the build that emitted the event."
    },
    {
      name        = "route"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Client-side route path (window.location.pathname)."
    },
    {
      name        = "device_class"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "mobile-low | mobile-mid | mobile-high | tablet | desktop."
    },
    {
      name        = "network"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "slow-2g | 2g | 3g | 4g | wifi | unknown."
    },
    {
      name        = "metric"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "LCP | INP | CLS | TTFB | FCP."
    },
    {
      name        = "value"
      type        = "FLOAT"
      mode        = "REQUIRED"
      description = "Metric value (ms for timing metrics, unitless for CLS)."
    },
    {
      name        = "rating"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "good | needs-improvement | poor (web-vitals bucketing)."
    },
    {
      name        = "ts"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "Event capture time (client ms-epoch, ISO at ingest). Partition key."
    },
  ])

  labels = local.common_labels
}

# ---- vitals_daily: daily rollup target -----------------------------------
# Populated by sql/observability/rum_daily_agg.sql (scheduled query below).
# Partitioned by `day`, clustered by (tenant_id, route, metric) so the
# dashboards' per-tenant + per-route reads stay cheap.

resource "google_bigquery_table" "vitals_daily" {
  dataset_id          = google_bigquery_dataset.rum.dataset_id
  project             = var.project_id
  table_id            = "vitals_daily"
  description         = "Daily web-vitals rollup: p50/p75/p95 + sample counts per (day, tenant, route, metric, device_class)."
  deletion_protection = true

  time_partitioning {
    type          = "DAY"
    field         = "day"
    expiration_ms = var.rum_agg_table_expiration_days > 0 ? var.rum_agg_table_expiration_days * 24 * 60 * 60 * 1000 : null
  }

  clustering = ["tenant_id", "route", "metric"]

  schema = jsonencode([
    { name = "day", type = "DATE", mode = "REQUIRED", description = "Rollup day (UTC) derived from ts." },
    { name = "tenant_id", type = "STRING", mode = "NULLABLE", description = "Tenant org_id; null for anonymous routes." },
    { name = "app_version", type = "STRING", mode = "NULLABLE", description = "Build version (most-recent within the day)." },
    { name = "route", type = "STRING", mode = "REQUIRED", description = "Route path." },
    { name = "metric", type = "STRING", mode = "REQUIRED", description = "Vital name." },
    { name = "device_class", type = "STRING", mode = "REQUIRED", description = "Device bucket." },
    { name = "samples", type = "INTEGER", mode = "REQUIRED", description = "Number of samples in the bucket." },
    { name = "p50", type = "FLOAT", mode = "NULLABLE", description = "Median value." },
    { name = "p75", type = "FLOAT", mode = "NULLABLE", description = "75th percentile (the web-vitals reporting percentile)." },
    { name = "p95", type = "FLOAT", mode = "NULLABLE", description = "95th percentile." },
    { name = "good_rate", type = "FLOAT", mode = "NULLABLE", description = "Fraction of samples rated 'good'." },
  ])

  labels = local.common_labels
}

# ---- cost_per_tenant_daily: cost attribution rollup ----------------------
# Populated by sql/observability/cost_per_tenant.sql when a billing export is
# configured. Created unconditionally so the dashboard table reference is
# stable, but the scheduled query is only created when billing export is set.

resource "google_bigquery_table" "cost_per_tenant_daily" {
  dataset_id          = google_bigquery_dataset.rum.dataset_id
  project             = var.project_id
  table_id            = "cost_per_tenant_daily"
  description         = "Daily GCP cost attributed per tenant (org_id) via resource labels + usage weighting."
  deletion_protection = true

  time_partitioning {
    type  = "DAY"
    field = "usage_day"
  }

  clustering = ["tenant_id", "service"]

  schema = jsonencode([
    { name = "usage_day", type = "DATE", mode = "REQUIRED", description = "Billing usage day (UTC)." },
    { name = "tenant_id", type = "STRING", mode = "NULLABLE", description = "Tenant org_id (from resource label) or 'shared' for unattributed." },
    { name = "service", type = "STRING", mode = "REQUIRED", description = "GCP service description (Cloud Run, Firestore, BigQuery, ...)." },
    { name = "sku", type = "STRING", mode = "NULLABLE", description = "Billing SKU description." },
    { name = "cost_usd", type = "FLOAT", mode = "REQUIRED", description = "Net cost in USD after credits." },
    { name = "credits_usd", type = "FLOAT", mode = "NULLABLE", description = "Credits applied (negative cost), surfaced separately." },
    { name = "usage_amount", type = "FLOAT", mode = "NULLABLE", description = "Raw usage units (e.g. request count, GB-month)." },
    { name = "usage_unit", type = "STRING", mode = "NULLABLE", description = "Unit of usage_amount." },
  ])

  labels = local.common_labels
}

# -----------------------------------------------------------------------------
# Scheduled queries (BigQuery Data Transfer Service)
# -----------------------------------------------------------------------------
# These run the .sql files in sql/observability on a schedule. The query text
# is loaded from disk so the SQL is the single source of truth and reviewable
# on its own. @run_date is supplied by BQ DTS at execution time.

# Daily RUM rollup → vitals_daily. Runs at 02:30 UTC after the prior day closes.
resource "google_bigquery_data_transfer_config" "rum_daily_agg" {
  display_name           = "zoho-rum-daily-agg-${var.environment}"
  project                = var.project_id
  location               = var.bigquery_location
  data_source_id         = "scheduled_query"
  schedule               = "every day 02:30"
  destination_dataset_id = google_bigquery_dataset.rum.dataset_id

  params = {
    query = templatefile("${path.module}/../../sql/observability/rum_daily_agg.sql", {
      project    = var.project_id
      dataset    = var.rum_dataset_id
      raw_table  = google_bigquery_table.vitals_raw.table_id
      agg_table  = google_bigquery_table.vitals_daily.table_id
    })
  }

  # @run_date param substitution happens server-side; nothing else needed.
  depends_on = [
    google_bigquery_table.vitals_raw,
    google_bigquery_table.vitals_daily,
  ]
}

# Per-tenant cost rollup → cost_per_tenant_daily. Only created when a billing
# export dataset is configured (otherwise there's no source table).
resource "google_bigquery_data_transfer_config" "cost_per_tenant" {
  count = var.billing_export_dataset_id != "" && var.billing_export_table != "" ? 1 : 0

  display_name           = "zoho-cost-per-tenant-${var.environment}"
  project                = var.project_id
  location               = var.bigquery_location
  data_source_id         = "scheduled_query"
  schedule               = "every day 05:00"
  destination_dataset_id = google_bigquery_dataset.rum.dataset_id

  params = {
    query = templatefile("${path.module}/../../sql/observability/cost_per_tenant.sql", {
      project        = var.project_id
      dataset        = var.rum_dataset_id
      dest_table     = google_bigquery_table.cost_per_tenant_daily.table_id
      billing_project = var.project_id
      billing_dataset = var.billing_export_dataset_id
      billing_table   = var.billing_export_table
    })
  }

  depends_on = [google_bigquery_table.cost_per_tenant_daily]
}
