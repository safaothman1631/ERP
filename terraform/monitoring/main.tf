# =============================================================================
# main.tf — Provider, backend, locals, notification channels, log-based
#           metrics, and uptime checks for the zoho observability stack.
# =============================================================================
# T-SF.5.1 (provisioning skeleton), 5.10 (uptime/synthetic), 5.12 (cert),
# 5.14 (scheduler health), 5.15 (notification routing).
#
# Apply procedure + required APIs documented in README.md.
# =============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0, < 7.0.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">= 5.0.0, < 7.0.0"
    }
  }

  # Remote state lives in a GCS bucket. Configure with a backend config file
  # at apply time: `terraform init -backend-config=backend.hcl`
  # (bucket/prefix are environment-specific, so they are NOT hard-coded here).
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# -----------------------------------------------------------------------------
# Locals
# -----------------------------------------------------------------------------

locals {
  common_labels = merge(
    {
      managed_by  = "terraform"
      component   = "observability"
      environment = var.environment
    },
    var.extra_labels,
  )

  # The Cloud Run revision/service label used across Cloud Monitoring filters.
  run_service_filter = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.cloud_run_service_name}\""

  # Hostnames stripped of scheme for uptime checks.
  api_host      = replace(replace(var.api_base_url, "https://", ""), "http://", "")
  frontend_host = replace(replace(var.frontend_base_url, "https://", ""), "http://", "")

  # Whether each optional notification channel is enabled.
  enable_email     = var.notification_email != ""
  enable_pagerduty = var.pagerduty_service_key != ""
  enable_slack     = var.slack_auth_token != ""
}

# -----------------------------------------------------------------------------
# Notification channels (T-SF.5.15)
# -----------------------------------------------------------------------------
# PagerDuty is the page-worthy path; email + Slack are the awareness path.
# Alert policies reference local.alert_channels / local.page_channels so the
# routing is defined in exactly one place.

resource "google_monitoring_notification_channel" "email" {
  count = local.enable_email ? 1 : 0

  display_name = "zoho-${var.environment}-email"
  type         = "email"
  labels = {
    email_address = var.notification_email
  }
  user_labels = local.common_labels
}

resource "google_monitoring_notification_channel" "pagerduty" {
  count = local.enable_pagerduty ? 1 : 0

  display_name = "zoho-${var.environment}-pagerduty"
  type         = "pagerduty"

  # PagerDuty integration key is a "sensitive label" in Cloud Monitoring.
  sensitive_labels {
    service_key = var.pagerduty_service_key
  }
  user_labels = local.common_labels
}

resource "google_monitoring_notification_channel" "slack" {
  count = local.enable_slack ? 1 : 0

  display_name = "zoho-${var.environment}-slack"
  type         = "slack"
  labels = {
    channel_name = var.slack_channel
  }
  sensitive_labels {
    auth_token = var.slack_auth_token
  }
  user_labels = local.common_labels
}

locals {
  # Every channel that exists, in priority order.
  _email_ids     = [for c in google_monitoring_notification_channel.email : c.id]
  _pagerduty_ids = [for c in google_monitoring_notification_channel.pagerduty : c.id]
  _slack_ids     = [for c in google_monitoring_notification_channel.slack : c.id]

  # Awareness alerts (warnings) → email + Slack.
  alert_channels = concat(local._email_ids, local._slack_ids)

  # Page-worthy alerts (critical) → PagerDuty if present, else fall back to
  # the awareness channels so a misconfigured account never silences a page.
  page_channels = length(local._pagerduty_ids) > 0 ? concat(local._pagerduty_ids, local._email_ids) : concat(local._email_ids, local._slack_ids)
}

# -----------------------------------------------------------------------------
# Log-based metrics (T-SF.5.4, 5.14, 5.16)
# -----------------------------------------------------------------------------
# The backend already emits structured JSON logs (observability/logging.py) and
# the scheduler logs job lifecycle events. We derive counter/distribution
# metrics from those logs so alerts can fire without a metrics pipeline.

# Backup verification failures (T-SF.5.4). backend/scripts/verify_latest_backup
# and backup_service.py emit a recognizable log line on failure.
resource "google_logging_metric" "backup_verify_failed" {
  name        = "zoho/backup_verify_failed"
  description = "Count of backup verification failures (DISASTER_RECOVERY backup-verify)."
  project     = var.project_id

  # Matches backup_service.py ("Integrity verification failed for org ...")
  # and the weekly backup-verify CI / verify_latest_backup.py failure lines.
  filter = <<-EOT
    severity>=ERROR
    AND (
      jsonPayload.message=~"[Ii]ntegrity verification (failed|timed out)"
      OR jsonPayload.message=~"backup.*verif.*fail"
      OR jsonPayload.message=~"[Bb]ackup file not found for verification"
      OR textPayload=~"[Ii]ntegrity verification (failed|timed out)"
    )
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    labels {
      key         = "tenant_id"
      value_type  = "STRING"
      description = "Tenant the backup belonged to, when known."
    }
  }
  label_extractors = {
    "tenant_id" = "EXTRACT(jsonPayload.tenant_id)"
  }
}

# Scheduler job failures (T-SF.5.14). services/scheduler.py logs job errors.
resource "google_logging_metric" "scheduler_job_failed" {
  name        = "zoho/scheduler_job_failed"
  description = "Count of APScheduler job failures, labelled by job id."
  project     = var.project_id

  filter = <<-EOT
    severity>=ERROR
    AND (
      jsonPayload.message=~"scheduler\\..*(failed|error)"
      OR jsonPayload.event=~"job_failed"
    )
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    labels {
      key         = "job_id"
      value_type  = "STRING"
      description = "APScheduler job id, when present in the log."
    }
  }
  label_extractors = {
    "job_id" = "EXTRACT(jsonPayload.job_id)"
  }
}

# Scheduler heartbeat (T-SF.5.14). The scheduler emits a periodic heartbeat
# line; absence of this metric is what the "scheduler down" alert detects.
resource "google_logging_metric" "scheduler_heartbeat" {
  name        = "zoho/scheduler_heartbeat"
  description = "Heartbeat emitted by the APScheduler tick; used for absence detection."
  project     = var.project_id

  filter = <<-EOT
    jsonPayload.message=~"scheduler.heartbeat"
    OR jsonPayload.event="scheduler_heartbeat"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

# Idempotency replay rate (T-SF.5.16) — middleware/idempotency_http.py logs
# replays. A spike can indicate a client retry storm or a broken integration.
resource "google_logging_metric" "idempotency_replay" {
  name        = "zoho/idempotency_replay"
  description = "Count of idempotency-key replays served from cache."
  project     = var.project_id

  filter = <<-EOT
    jsonPayload.message=~"idempotency.*replay"
    OR jsonPayload.event="idempotency_replay"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

# Rate-limit rejections (T-SF.5.16) — middleware/rate_limit.py logs 429s.
resource "google_logging_metric" "rate_limit_rejected" {
  name        = "zoho/rate_limit_rejected"
  description = "Count of requests rejected by the rate limiter (HTTP 429)."
  project     = var.project_id

  filter = <<-EOT
    jsonPayload.status_code="429"
    OR jsonPayload.message=~"rate_limit.*(reject|exceeded)"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    labels {
      key         = "tenant_id"
      value_type  = "STRING"
      description = "Tenant that was throttled, when known."
    }
  }
  label_extractors = {
    "tenant_id" = "EXTRACT(jsonPayload.tenant_id)"
  }
}

# POS offline-sync conflicts (T-SF.5.16 / D3). The POS sync path logs conflicts
# when a queued offline order collides on the server.
resource "google_logging_metric" "pos_sync_conflict" {
  name        = "zoho/pos_sync_conflict"
  description = "Count of POS offline-sync conflicts resolved on the server."
  project     = var.project_id

  filter = <<-EOT
    jsonPayload.message=~"pos.*sync.*conflict"
    OR jsonPayload.event="pos_sync_conflict"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

# e-Fakhata MoF submission rejections (business-critical compliance path).
resource "google_logging_metric" "efakhata_rejected" {
  name        = "zoho/efakhata_rejected"
  description = "Count of e-Fakhata submissions rejected by the MoF."
  project     = var.project_id

  filter = <<-EOT
    jsonPayload.message=~"efakhata.*(rejected|failed)"
    OR jsonPayload.event=~"efakhata_(rejected|failed)"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

# -----------------------------------------------------------------------------
# Uptime checks (T-SF.5.10) — black-box availability probes
# -----------------------------------------------------------------------------
# Lightweight liveness probes from Google's global checkers. The deep synthetic
# journey lives in scripts/observability/k6-synthetic.js (nightly CI). These
# uptime checks feed the availability/error-budget alerts.

resource "google_monitoring_uptime_check_config" "api_health" {
  display_name = "zoho-${var.environment}-api-health"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path           = "/api/health"
    port           = 443
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = local.api_host
    }
  }

  selected_regions = ["EUROPE", "ASIA_PACIFIC", "USA"]
}

resource "google_monitoring_uptime_check_config" "frontend_shell" {
  display_name = "zoho-${var.environment}-frontend-shell"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path           = "/"
    port           = 443
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = local.frontend_host
    }
  }

  selected_regions = ["EUROPE", "ASIA_PACIFIC", "USA"]
}

# -----------------------------------------------------------------------------
# Services & SLOs (T-SF.5.16) — error-budget objects the burn alerts read.
# -----------------------------------------------------------------------------
# A custom monitored service anchors request-based SLOs computed from Cloud Run
# request metrics. The burn-rate alert policies live in alerts.tf.

resource "google_monitoring_custom_service" "api" {
  service_id   = "zoho-api-${var.environment}"
  display_name = "zoho API (${var.environment})"

  telemetry {
    resource_name = "//run.googleapis.com/projects/${var.project_id}/locations/${var.region}/services/${var.cloud_run_service_name}"
  }

  user_labels = local.common_labels
}

# Availability SLO: fraction of non-5xx responses over a rolling 28-day window.
resource "google_monitoring_slo" "api_availability" {
  service      = google_monitoring_custom_service.api.service_id
  slo_id       = "api-availability"
  display_name = "API availability ${var.slo_availability_target * 100}%"

  goal                = var.slo_availability_target
  rolling_period_days = 28

  request_based_sli {
    good_total_ratio {
      total_service_filter = join(" AND ", [
        "metric.type=\"run.googleapis.com/request_count\"",
        "resource.type=\"cloud_run_revision\"",
        "resource.labels.service_name=\"${var.cloud_run_service_name}\"",
      ])
      bad_service_filter = join(" AND ", [
        "metric.type=\"run.googleapis.com/request_count\"",
        "resource.type=\"cloud_run_revision\"",
        "resource.labels.service_name=\"${var.cloud_run_service_name}\"",
        "metric.labels.response_code_class=\"5xx\"",
      ])
    }
  }
}

# Latency SLO: fraction of requests served under the read-list p95 target.
resource "google_monitoring_slo" "api_latency" {
  service      = google_monitoring_custom_service.api.service_id
  slo_id       = "api-latency"
  display_name = "API latency < ${var.slo_api_latency_p95_ms}ms"

  goal                = 0.95
  rolling_period_days = 28

  request_based_sli {
    distribution_cut {
      distribution_filter = join(" AND ", [
        "metric.type=\"run.googleapis.com/request_latencies\"",
        "resource.type=\"cloud_run_revision\"",
        "resource.labels.service_name=\"${var.cloud_run_service_name}\"",
      ])
      range {
        max = var.slo_api_latency_p95_ms
      }
    }
  }
}
