#!/usr/bin/env bash
# Pre-launch ops — phases 1–3
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PHASE="${1:-all}"
ORG_ID="${ORG_ID:-}"
BASE_URL="${BASE_URL:-}"
EMAIL="${EMAIL:-}"
PASSWORD="${PASSWORD:-}"
SKIP_DEPLOY="${SKIP_DEPLOY:-0}"

phase_firestore() {
  python tools/verify_firestore_ttl.py
  python tools/verify_firestore_indexes.py
  if [[ "$SKIP_DEPLOY" != "1" ]] && command -v firebase >/dev/null 2>&1; then
    firebase deploy --only firestore:rules,firestore:indexes --project zoho-83cda --non-interactive
  fi
  python tools/verify_firestore_ttl_gcloud.py --project zoho-83cda
}

phase_staging() {
  [[ -n "$ORG_ID" ]] || { echo "FAIL: ORG_ID required"; exit 1; }
  PYTHONPATH=backend python backend/scripts/backup_restore_drill.py --org-id "$ORG_ID"
  if [[ -n "$BASE_URL" && -n "$EMAIL" && -n "$PASSWORD" ]]; then
    python backend/scripts/prelaunch_smoke.py --base-url "$BASE_URL" --email "$EMAIL" --password "$PASSWORD"
  else
    echo "SKIP: prelaunch_smoke (set BASE_URL EMAIL PASSWORD)"
  fi
}

phase_redis() {
  if ! command -v gcloud >/dev/null 2>&1; then
    echo "SKIP: gcloud not installed"
    return 0
  fi
  if gcloud run services describe zoho-erp \
    --region europe-west1 --project erp-system-494716 \
    --format=json | grep -q RATE_LIMIT_STORAGE_URI; then
    echo "OK: RATE_LIMIT_STORAGE_URI on zoho-erp"
  else
    echo "WARN: set Secret redis-rate-limit-uri and redeploy Cloud Run"
  fi
}

case "$PHASE" in
  firestore) phase_firestore ;;
  staging) phase_staging ;;
  redis) phase_redis ;;
  all)
    phase_firestore
    phase_staging
    phase_redis
    ;;
  *) echo "Usage: $0 [firestore|staging|redis|all]"; exit 1 ;;
esac
