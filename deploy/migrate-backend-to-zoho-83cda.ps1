# =============================================================================
# Migrate the backend (Cloud Run) onto zoho-83cda — PowerShell runbook (Windows).
# Native PowerShell version of migrate-backend-to-zoho-83cda.sh (no bash/WSL needed).
#
# Run from the repo root (PowerShell):
#     powershell -ExecutionPolicy Bypass -File deploy\migrate-backend-to-zoho-83cda.ps1
#
# Pre-launch / demo-data only. All prep already done by Claude:
#   - APIs enabled on zoho-83cda (run, cloudbuild, artifactregistry, secretmanager)
#   - Fresh secrets created: zoho-secret-key, field-encryption-key
#   - Code committed + pushed; frontend builds clean.
# The NEW service has its OWN url; the frontend still points at the old backend
# until you repoint it (printed at the end) -> ZERO production impact until cutover.
# =============================================================================

$PROJECT = 'zoho-83cda'
$REGION  = 'me-central1'
$SERVICE = 'zoho-erp-backend'

# repo root = parent of this script's deploy/ folder
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host "repo root: $(Get-Location)"
Write-Host "target:    project=$PROJECT region=$REGION service=$SERVICE`n"

function Assert-Ok($msg) { if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: $msg (exit $LASTEXITCODE)" -ForegroundColor Red; exit 1 } }

# --- 1. Let the Cloud Run runtime SA read the two secrets -------------------
Write-Host "[1/4] granting secretAccessor to the runtime service account..."
$PNUM = (gcloud projects describe $PROJECT --format='value(projectNumber)').Trim()
Assert-Ok "could not read project number"
$SA = "serviceAccount:$PNUM-compute@developer.gserviceaccount.com"
foreach ($s in 'zoho-secret-key','field-encryption-key') {
  gcloud secrets add-iam-policy-binding $s --member=$SA --role='roles/secretmanager.secretAccessor' --project $PROJECT --quiet | Out-Null
  Assert-Ok "secretAccessor grant on $s"
  Write-Host "   OK  $s -> $SA"
}

# --- 2. Deploy the backend (new service, 100% on its OWN url) ---------------
Write-Host "`n[2/4] building + deploying backend to $PROJECT (Cloud Build, ~5-10 min)..."
gcloud run deploy $SERVICE --source . --region $REGION --project $PROJECT `
  --allow-unauthenticated --memory 1Gi --cpu 1 --min-instances 0 --max-instances 3 --timeout 300 `
  --env-vars-file cloudrun-deploy-env.yaml `
  --set-secrets "SECRET_KEY=zoho-secret-key:latest,FIELD_ENCRYPTION_KEY=field-encryption-key:latest" `
  --quiet
Assert-Ok "Cloud Run deploy"
$URL = (gcloud run services describe $SERVICE --region $REGION --project $PROJECT --format='value(status.url)').Trim()

# --- 3. Smoke-test the new service ------------------------------------------
Write-Host "`n[3/4] smoke-testing $URL"
Write-Host "   /api/live    : $(curl.exe -s -m 25 `"$URL/api/live`")"
Write-Host "   /api/metrics : $(curl.exe -s -m 25 `"$URL/api/metrics`")  (expect route_count 2338)"

# --- 4. Deploy the F-3 firestore rules fix ----------------------------------
Write-Host "`n[4/4] deploying firestore rules (F-3 HR create binding)..."
firebase deploy --only firestore:rules --project $PROJECT
Assert-Ok "firebase rules deploy"

Write-Host "`n============================================================================="
Write-Host "DONE. Backend live on $PROJECT at:" -ForegroundColor Green
Write-Host "      $URL" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT - send that URL back to Claude to finish the cutover (frontend repoint),"
Write-Host "or do it yourself: point vercel.json /api/* (CLOUDRUN_URL) at the new URL,"
Write-Host "commit + push (Vercel redeploys), verify https://erpiq.systems, then retire old:"
Write-Host "   gcloud run services delete zoho-erp --region europe-west1 --project erp-system-494716"
Write-Host "   gcloud run services delete zoho-erp-backend --region me-central1 --project erp-system-494716"
Write-Host "============================================================================="
