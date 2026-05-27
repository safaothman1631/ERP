#!/usr/bin/env bash
# Enable shared Redis rate limits on zoho-erp (run after Memorystore is READY).
set -euo pipefail
PROJECT="${GCP_PROJECT_ID:-erp-system-494716}"
REGION="${CLOUD_RUN_REGION:-europe-west1}"
SERVICE="${CLOUD_RUN_SERVICE:-zoho-erp}"
HOST="${REDIS_HOST:-10.89.110.3}"
URI="redis://${HOST}:6379/0?socket_connect_timeout=2&socket_timeout=2"

gcloud run services update "$SERVICE" \
  --region "$REGION" \
  --project "$PROJECT" \
  --vpc-connector=erpiq-run-connector \
  --vpc-egress=private-ranges-only \
  --update-env-vars "RATE_LIMIT_STORAGE_URI=${URI}"

echo "OK: Redis rate limit enabled. Smoke: curl -s \$URL/api/health"
