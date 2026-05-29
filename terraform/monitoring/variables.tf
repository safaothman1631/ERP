# =============================================================================
# variables.tf — Inputs for the zoho observability stack (T-SF.5.x)
# =============================================================================
# These map 1:1 to the production runtime contract already established in the
# repo:
#   - GCP project: the Firebase project `zoho-83cda` (passed as project_id)
#   - Region:      me-central1 (matches deploy-production.yml REGION)
#   - Cloud Run:   service `zoho-erp-backend`
#   - RUM data:    BigQuery dataset (RUM_BIGQUERY_DATASET) + table `vitals_raw`
#
# Nothing here is secret. PagerDuty / Slack / email targets are passed in via
# *.auto.tfvars (git-ignored) or TF_VAR_* env so credentials never land in VCS.
# =============================================================================

variable "project_id" {
  type        = string
  description = "GCP project id hosting Cloud Run + Firestore + BigQuery (Firebase project zoho-83cda)."

  validation {
    condition     = length(var.project_id) > 0
    error_message = "project_id must be set (e.g. zoho-83cda)."
  }
}

variable "region" {
  type        = string
  description = "Primary region for Cloud Run and regional resources."
  default     = "me-central1"
}

variable "environment" {
  type        = string
  description = "Deployment environment label applied to dashboards/alerts."
  default     = "production"

  validation {
    condition     = contains(["production", "staging"], var.environment)
    error_message = "environment must be one of: production, staging."
  }
}

variable "cloud_run_service_name" {
  type        = string
  description = "Cloud Run service name for the backend API."
  default     = "zoho-erp-backend"
}

variable "frontend_base_url" {
  type        = string
  description = "Public base URL of the production frontend (Vercel) used by uptime checks and RUM regression dashboards."
  default     = "https://app.zoho-kurdish.iq"
}

variable "api_base_url" {
  type        = string
  description = "Public base URL of the production backend API used by uptime checks (without trailing slash)."
  default     = "https://api.zoho-kurdish.iq"
}

# ---- RUM / BigQuery -------------------------------------------------------

variable "rum_dataset_id" {
  type        = string
  description = "BigQuery dataset id that holds RUM vitals (matches RUM_BIGQUERY_DATASET). Created by bigquery.tf."
  default     = "rum"

  validation {
    condition     = can(regex("^[A-Za-z0-9_]+$", var.rum_dataset_id))
    error_message = "rum_dataset_id may only contain letters, numbers and underscores."
  }
}

variable "bigquery_location" {
  type        = string
  description = "BigQuery dataset location. Multi-region (EU/US) or a single region. Kept distinct from compute region because me-central1 BQ may be unavailable; choose the nearest supported location."
  default     = "EU"
}

variable "rum_table_expiration_days" {
  type        = number
  description = "Partition expiration (days) for the raw vitals table. 0 = never expire."
  default     = 90
}

variable "rum_agg_table_expiration_days" {
  type        = number
  description = "Partition expiration (days) for the daily rollup table. Kept long for trend analysis."
  default     = 730
}

# ---- Alerting / notification ---------------------------------------------

variable "notification_email" {
  type        = string
  description = "Primary email address for monitoring notifications. Empty disables the email channel."
  default     = ""
}

variable "pagerduty_service_key" {
  type        = string
  sensitive   = true
  description = <<-EOT
    PagerDuty Events API v2 integration/routing key. When empty, the PagerDuty
    notification channel is NOT created and alert policies fall back to the
    email channel only. Supply via TF_VAR_pagerduty_service_key.
    EXTERNAL BLOCKER: requires a PagerDuty account + service to exist.
  EOT
  default     = ""
}

variable "slack_auth_token" {
  type        = string
  sensitive   = true
  description = "Slack OAuth token for the Cloud Monitoring Slack channel. Empty disables the Slack channel."
  default     = ""
}

variable "slack_channel" {
  type        = string
  description = "Slack channel name (e.g. #alerts-prod) used when slack_auth_token is set."
  default     = "#alerts-prod"
}

# ---- SLO targets (mirror scripts/slo-thresholds.json) ---------------------

variable "slo_api_latency_p95_ms" {
  type        = number
  description = "API read-list p95 latency objective in milliseconds (alerts fire above this)."
  default     = 300
}

variable "slo_pos_checkout_p95_ms" {
  type        = number
  description = "POS checkout p95 latency objective in milliseconds."
  default     = 400
}

variable "slo_5xx_error_rate" {
  type        = number
  description = "Fraction (0-1) of 5xx responses that triggers the error-rate alert."
  default     = 0.01
}

variable "slo_availability_target" {
  type        = number
  description = "Availability objective (0-1). Drives error-budget burn alerts. 0.999 = three nines."
  default     = 0.999
}

variable "rum_lcp_p75_regression_ms" {
  type        = number
  description = "LCP p75 (ms) above which the web-vitals regression alert fires (Google 'good' threshold is 2500)."
  default     = 2500
}

variable "rum_inp_p75_regression_ms" {
  type        = number
  description = "INP p75 (ms) above which the interaction-latency alert fires (Google 'good' threshold is 200)."
  default     = 200
}

variable "cert_expiry_warning_days" {
  type        = number
  description = "Days-before-expiry at which the TLS certificate alert fires."
  default     = 20
}

# ---- Cost attribution -----------------------------------------------------

variable "billing_export_dataset_id" {
  type        = string
  description = "BigQuery dataset that holds the standard GCP billing export (detailed usage cost). Used by sql/observability/cost_per_tenant.sql. Empty = cost rollup view is skipped."
  default     = ""
}

variable "billing_export_table" {
  type        = string
  description = "Fully-qualified-ish billing export table name (without project), e.g. gcp_billing_export_resource_v1_XXXXXX."
  default     = ""
}

# ---- Labels ---------------------------------------------------------------

variable "extra_labels" {
  type        = map(string)
  description = "Additional resource labels merged onto every taggable resource."
  default     = {}
}
