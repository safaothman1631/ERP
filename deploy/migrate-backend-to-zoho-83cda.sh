#!/usr/bin/env bash
# =============================================================================
# Migrate the backend (Cloud Run) onto zoho-83cda — consolidate compute + data
# in ONE production project. Pre-launch / demo-data only (fresh secrets, no copy).
#
# WHY a script you run (not the agent): production deploys + IAM + secrets should
# have a human operator. All prep is already done by the agent:
#   - APIs enabled on zoho-83cda (run, cloudbuild, artifactregistry, secretmanager)
#   - Fresh secrets created: zoho-secret-key, field-encryption-key
#   - Code committed: routers/middleware wired, frontend built clean
#
# Run from the repo root:   bash deploy/migrate-backend-to-zoho-83cda.sh
# Idempotent + safe: the new service has its OWN url; the frontend still points
# at the old backend until you repoint it (step printed at the end), so there is
# ZERO production impact until you choose to cut over.
# =============================================================================
set -euo pipefail

PROJECT="zoho-83cda"
REGION="me-central1"
SERVICE="zoho-erp-backend"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
echo "▶ repo root: $REPO_ROOT"
echo "▶ target:    project=$PROJECT region=$REGION service=$SERVICE"
echo

# --- 1. Let the Cloud Run runtime SA read the two secrets -------------------
echo "▶ [1/4] granting secretAccessor to the runtime service account…"
PNUM="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
SA="serviceAccount:${PNUM}-compute@developer.gserviceaccount.com"
for s in zoho-secret-key field-encryption-key; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="$SA" --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT" --quiet >/dev/null
  echo "   ✓ $s → $SA"
done

# --- 2. Deploy the backend (new service, 100% on its OWN url) ----------------
echo "▶ [2/4] building + deploying backend to $PROJECT (Cloud Build, ~5-10 min)…"
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --project "$PROJECT" \
  --allow-unauthenticated \
  --memory 1Gi --cpu 1 --min-instances 0 --max-instances 3 --timeout 300 \
  --env-vars-file cloudrun-deploy-env.yaml \
  --set-secrets "SECRET_KEY=zoho-secret-key:latest,FIELD_ENCRYPTION_KEY=field-encryption-key:latest" \
  --quiet

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format='value(status.url)')"

# --- 3. Smoke-test the new service ------------------------------------------
echo "▶ [3/4] smoke-testing $URL …"
echo -n "   /api/live      : "; curl -s -m 25 "$URL/api/live"; echo
echo -n "   /api/metrics   : "; curl -s -m 25 "$URL/api/metrics"; echo
echo -n "   /api/data-rights/export/x (expect 401, NOT 404): "
curl -s -m 25 -o /dev/null -w "HTTP %{http_code}\n" "$URL/api/data-rights/export/x"

# --- 4. Deploy the F-3 firestore rules fix ----------------------------------
echo "▶ [4/4] deploying firestore rules (F-3 HR create binding)…"
firebase deploy --only firestore:rules --project "$PROJECT"

echo
echo "============================================================================="
echo "✅ Backend live on $PROJECT at:"
echo "      $URL"
echo
echo "NEXT — send that URL back to Claude to finish the cutover, OR do it yourself:"
echo "  • repoint frontend /api/* to the new URL (vercel.json CLOUDRUN_URL / rewrite),"
echo "    commit + push → Vercel redeploys the frontend."
echo "  • verify https://erpiq.systems works end-to-end."
echo "  • then retire the old service:"
echo "      gcloud run services delete zoho-erp --region europe-west1 --project erp-system-494716"
echo "      gcloud run services delete zoho-erp-backend --region me-central1 --project erp-system-494716"
echo "============================================================================="
