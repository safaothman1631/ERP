#!/usr/bin/env bash
# Create Secret Manager entry for Cloud Run RATE_LIMIT_STORAGE_URI (run once).
set -euo pipefail
PROJECT="${GCP_PROJECT_ID:-erp-system-494716}"
REDIS_URI="${REDIS_URI:?Set REDIS_URI e.g. redis://10.0.0.3:6379/0}"

echo -n "$REDIS_URI" | gcloud secrets create redis-rate-limit-uri \
  --project="$PROJECT" \
  --data-file=- \
  --replication-policy=automatic 2>/dev/null || \
  echo -n "$REDIS_URI" | gcloud secrets versions add redis-rate-limit-uri \
  --project="$PROJECT" \
  --data-file=-

gcloud run services update zoho-erp \
  --region europe-west1 \
  --project "$PROJECT" \
  --update-secrets "RATE_LIMIT_STORAGE_URI=redis-rate-limit-uri:latest"

echo "OK: RATE_LIMIT_STORAGE_URI attached to zoho-erp"
