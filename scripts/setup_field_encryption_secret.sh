#!/usr/bin/env bash
# Create field-encryption-key in Secret Manager and grant Cloud Run access.
set -euo pipefail
PROJECT="${GCP_PROJECT_ID:-erp-system-494716}"
SA="${CLOUD_RUN_SA:-271150392549-compute@developer.gserviceaccount.com}"

if [[ -z "${FIELD_ENCRYPTION_KEY:-}" ]]; then
  FIELD_ENCRYPTION_KEY="$(python3 -c 'import secrets,base64; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())')"
  echo "Generated new FIELD_ENCRYPTION_KEY (stored only in Secret Manager)."
fi

if gcloud secrets describe field-encryption-key --project="$PROJECT" &>/dev/null; then
  echo -n "$FIELD_ENCRYPTION_KEY" | gcloud secrets versions add field-encryption-key \
    --project="$PROJECT" --data-file=-
else
  echo -n "$FIELD_ENCRYPTION_KEY" | gcloud secrets create field-encryption-key \
    --project="$PROJECT" --data-file=- --replication-policy=automatic
fi

gcloud secrets add-iam-policy-binding field-encryption-key \
  --project="$PROJECT" \
  --member="serviceAccount:${SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet

echo "OK: field-encryption-key ready for Cloud Run"
