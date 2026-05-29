# =============================================================================
# Redeploy the backend to Cloud Run with the LATEST code (rebuilds the image).
#
# Run this from anywhere (it cd's to the repo root itself):
#     powershell -ExecutionPolicy Bypass -File deploy\redeploy-backend.ps1
#
# WHY: an env-var update (`gcloud run services update --update-env-vars ...`)
# reuses the SAME image, so it does NOT pick up code changes. Code fixes (e.g.
# the audit `created_at` type-safety fix) only go live with `--source .`, which
# rebuilds via Cloud Build (~5-10 min) and creates a new revision.
#
# This deploy also:
#   - keeps SCHEDULER_ENABLED=false (from cloudrun-deploy-env.yaml) so the
#     in-process scheduler can't re-wedge the Firestore channel (login stays up)
#   - pins --min-instances 1 so there are no cold-start 502s while you test.
# =============================================================================

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)   # -> repo root
Write-Host "repo root: $(Get-Location)`n"

gcloud run deploy zoho-erp-backend `
  --source . `
  --region me-central1 `
  --project zoho-83cda `
  --allow-unauthenticated `
  --memory 1Gi --cpu 1 --min-instances 1 --max-instances 3 --timeout 300 `
  --env-vars-file cloudrun-deploy-env.yaml `
  --set-secrets "SECRET_KEY=zoho-secret-key:latest,FIELD_ENCRYPTION_KEY=field-encryption-key:latest"

if ($LASTEXITCODE -ne 0) { Write-Host "`nDEPLOY FAILED (exit $LASTEXITCODE)" -ForegroundColor Red; exit 1 }

$URL = (gcloud run services describe zoho-erp-backend --region me-central1 --project zoho-83cda --format='value(status.url)').Trim()
Write-Host "`n=============================================================================" -ForegroundColor Green
Write-Host "DEPLOYED. New revision is live at: $URL" -ForegroundColor Green
Write-Host "  /api/live : $(curl.exe -s -m 25 `"$URL/api/live`")"
Write-Host "=============================================================================" -ForegroundColor Green
Write-Host "Next: tell Claude 'تەواو' and it will verify /api/platform/audit no longer 500s."
