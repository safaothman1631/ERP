# Pre-launch ops — phases 1–3 (database-foundation-excellence)
# Usage:
#   .\scripts\prelaunch_ops.ps1 -Phase firestore
#   .\scripts\prelaunch_ops.ps1 -Phase staging -OrgId <ORG> -BaseUrl https://... -Email ... -Password ...
#   .\scripts\prelaunch_ops.ps1 -Phase redis
#   .\scripts\prelaunch_ops.ps1 -Phase all -OrgId <ORG> ...

param(
    [ValidateSet("firestore", "staging", "redis", "all")]
    [string]$Phase = "all",
    [string]$OrgId = "",
    [string]$BaseUrl = "",
    [string]$Email = "",
    [string]$Password = "",
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Invoke-FirestorePhase {
    python tools/verify_firestore_ttl.py
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    python tools/verify_firestore_indexes.py
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    if (-not $SkipDeploy) {
        if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) {
            Write-Host "WARN: firebase CLI not found — run GitHub workflow prelaunch-ops or install firebase-tools"
        } else {
            firebase deploy --only firestore:rules,firestore:indexes --project zoho-83cda --non-interactive
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
    }

    python tools/verify_firestore_ttl_gcloud.py --project zoho-83cda
    exit $LASTEXITCODE
}

function Invoke-StagingPhase {
    if (-not $OrgId) {
        Write-Host "FAIL: -OrgId required for staging phase"
        exit 1
    }
    $env:PYTHONPATH = Join-Path $Root "backend"
    python backend/scripts/backup_restore_drill.py --org-id $OrgId
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    if ($BaseUrl -and $Email -and $Password) {
        python backend/scripts/prelaunch_smoke.py --base-url $BaseUrl --email $Email --password $Password
        exit $LASTEXITCODE
    }
    Write-Host "SKIP: prelaunch_smoke (set -BaseUrl -Email -Password for HTTP smoke)"
    exit 0
}

function Invoke-RedisPhase {
    if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
        Write-Host "SKIP: gcloud not installed — set RATE_LIMIT_STORAGE_URI on Cloud Run manually"
        exit 0
    }
    $uri = gcloud run services describe zoho-erp `
        --region europe-west1 `
        --project erp-system-494716 `
        --format="value(spec.template.spec.containers[0].env)" 2>$null
    if ($uri -match "RATE_LIMIT_STORAGE_URI") {
        Write-Host "OK: RATE_LIMIT_STORAGE_URI present on zoho-erp"
        exit 0
    }
    Write-Host "WARN: RATE_LIMIT_STORAGE_URI not set on Cloud Run zoho-erp"
    Write-Host "      Create Secret Manager secret redis-rate-limit-uri and redeploy with deploy-cloudrun.yml"
    exit 0
}

switch ($Phase) {
    "firestore" { Invoke-FirestorePhase }
    "staging"   { Invoke-StagingPhase }
    "redis"     { Invoke-RedisPhase }
    "all" {
        Invoke-FirestorePhase
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Invoke-StagingPhase
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        Invoke-RedisPhase
    }
}
