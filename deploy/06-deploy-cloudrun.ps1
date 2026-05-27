#requires -Version 7.0
<#
.SYNOPSIS
    Deploy backend FastAPI to Google Cloud Run (me-central1).
    باکەندی FastAPI بنێرە بۆ Google Cloud Run.

.DESCRIPTION
    Builds the container with Cloud Build, pushes to Artifact Registry, and
    deploys a new Cloud Run revision. Idempotent — safe to re-run.
    کۆنتەینەرەکە بنیات دەنێت، دەینێرێت بۆ Artifact Registry، و وەشانێکی نوێ
    لە Cloud Run جێبەجێ دەکات. هیچ کاتێک حاڵەتی پێشوو ڕەش نەکراوەتەوە.

.PARAMETER Project
    The Google Cloud project ID. ناسنامەی پڕۆژەی GCP.

.PARAMETER ServiceName
    Cloud Run service name. ناوی خزمەتگوزاری Cloud Run.

.PARAMETER Region
    GCP region. ناوچەی GCP.

.PARAMETER Tag
    Image tag (defaults to current ISO date). تاگی وێنە (وەخۆڕایی ڕێکەوتی ئەمڕۆ).

.PARAMETER Confirm
    Confirm cost-incurring actions. پشتڕاستکردنەوەی کردارە خەرجیدارەکان.

.EXAMPLE
    .\deploy\06-deploy-cloudrun.ps1 -Project my-zoho-prod -Confirm
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Project,

    [string]$ServiceName = 'zoho-erp-backend',

    [string]$Region = 'me-central1',

    [int]$MinInstances = 1,

    [int]$MaxInstances = 20,

    [string]$Memory = '1Gi',

    [string]$Cpu = '2',

    [string]$Tag = (Get-Date -Format 'yyyyMMdd-HHmmss'),

    [switch]$Confirm
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# -----------------------------------------------------------------------------
# Setup: paths, logging
# -----------------------------------------------------------------------------
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptRoot
$LogDir     = Join-Path $ScriptRoot 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$Timestamp  = Get-Date -Format 'yyyyMMddTHHmmss'
$LogFile    = Join-Path $LogDir "cloudrun-deploy-$Timestamp.log"
$UrlFile    = Join-Path $ScriptRoot 'cloudrun-url.txt'

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format 'HH:mm:ss'), $Level, $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

function Write-Banner {
    param([string]$En, [string]$Ku)
    Write-Host ""
    Write-Host ("=" * 78) -ForegroundColor Cyan
    Write-Host " EN: $En" -ForegroundColor Cyan
    Write-Host " KU: $Ku" -ForegroundColor Cyan
    Write-Host ("=" * 78) -ForegroundColor Cyan
}

function Assert-CommandExists {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Log "Required command not found: $Name" 'ERROR'
        Write-Log "فەرمانە پێویستەکە نییە: $Name" 'ERROR'
        throw "Missing dependency: $Name"
    }
}

# -----------------------------------------------------------------------------
# Pre-flight
# -----------------------------------------------------------------------------
Write-Banner -En "Cloud Run deploy — start" -Ku "دەستپێکردنی Cloud Run deploy"
Write-Log "Project=$Project Service=$ServiceName Region=$Region Tag=$Tag"
Write-Log "Min=$MinInstances Max=$MaxInstances Memory=$Memory CPU=$Cpu"

Assert-CommandExists 'gcloud'

# Auth check
Write-Log "Verifying gcloud auth..."
$activeAccount = (& gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>&1) -join "`n"
if (-not $activeAccount -or $activeAccount -like '*ERROR*') {
    Write-Log "No active gcloud account. Run: gcloud auth login" 'ERROR'
    Write-Log "هیچ هەژمارێکی چالاکی gcloud نییە. ئەمە جێبەجێ بکە: gcloud auth login" 'ERROR'
    throw "gcloud not authenticated"
}
Write-Log "Active account: $activeAccount"

# Project match
Write-Log "Verifying project..."
$currentProject = (& gcloud config get-value project 2>&1).Trim()
if ($currentProject -ne $Project) {
    Write-Log "Switching project from '$currentProject' to '$Project'" 'WARN'
    & gcloud config set project $Project 2>&1 | Tee-Object -FilePath $LogFile -Append | Out-Null
}

# Cost warning — min-instances > 0 is billable
if ($MinInstances -gt 0 -and -not $Confirm) {
    Write-Banner -En "Cost warning" -Ku "ئاگاداری خەرجی"
    Write-Host ""
    Write-Host "  EN: min-instances=$MinInstances will keep idle containers warm." -ForegroundColor Yellow
    Write-Host "      Estimated cost: ~`$30-50/month per always-on instance." -ForegroundColor Yellow
    Write-Host "  KU: min-instances=$MinInstances کۆنتەینەرەکان هەمیشە چالاک ڕادەگرێت." -ForegroundColor Yellow
    Write-Host "      خەرجی: نزیکەی ٣٠-٥٠ دۆلار/مانگ بۆ هەر یەکێک." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Re-run with -Confirm to accept charges." -ForegroundColor Yellow
    Write-Host "  دووبارە جێبەجێ بکە بە -Confirm بۆ پەسەندکردنی خەرجی." -ForegroundColor Yellow
    throw "Cost confirmation required. Add -Confirm to proceed."
}

# -----------------------------------------------------------------------------
# Required APIs
# -----------------------------------------------------------------------------
Write-Banner -En "Checking required APIs" -Ku "پشکنینی API پێویستەکان"
$requiredApis = @(
    'run.googleapis.com',
    'cloudbuild.googleapis.com',
    'artifactregistry.googleapis.com',
    'secretmanager.googleapis.com'
)

$enabled = (& gcloud services list --enabled --format='value(config.name)' --project=$Project 2>&1) -split "`n"
foreach ($api in $requiredApis) {
    if ($enabled -contains $api) {
        Write-Log "OK   $api"
    } else {
        Write-Log "ENABLE $api" 'WARN'
        & gcloud services enable $api --project=$Project 2>&1 | Tee-Object -FilePath $LogFile -Append | Out-Null
    }
}

# -----------------------------------------------------------------------------
# Build container
# -----------------------------------------------------------------------------
Write-Banner -En "Building container image" -Ku "بنیاتنانی وێنەی کۆنتەینەر"
$imageUri = "$Region-docker.pkg.dev/$Project/zoho-images/$ServiceName`:$Tag"
Write-Log "Image: $imageUri"

Push-Location $RepoRoot
try {
    & gcloud builds submit `
        --tag $imageUri `
        --timeout 20m `
        --project=$Project 2>&1 | Tee-Object -FilePath $LogFile -Append

    if ($LASTEXITCODE -ne 0) {
        Write-Log "Cloud Build failed (exit $LASTEXITCODE)" 'ERROR'
        Write-Log "Cloud Build شکستی هێنا" 'ERROR'
        throw "Cloud Build failed"
    }
} finally {
    Pop-Location
}

# -----------------------------------------------------------------------------
# Deploy to Cloud Run
# -----------------------------------------------------------------------------
Write-Banner -En "Deploying to Cloud Run" -Ku "ناردن بۆ Cloud Run"

$envVars = @(
    "ENVIRONMENT=production",
    "APP_VERSION=$Tag",
    "FIREBASE_PROJECT_ID=$Project",
    "RATE_LIMITING_ENABLED=true",
    "RUN_MIGRATIONS_ON_BOOT=true"
) -join ','

$secrets = @(
    "SECRET_KEY=zoho-secret-key:latest",
    "SENTRY_DSN=zoho-sentry-dsn:latest",
    "REDIS_URL=zoho-redis-url:latest"
) -join ','

& gcloud run deploy $ServiceName `
    --image $imageUri `
    --region $Region `
    --project=$Project `
    --platform managed `
    --allow-unauthenticated `
    --min-instances $MinInstances `
    --max-instances $MaxInstances `
    --memory $Memory `
    --cpu $Cpu `
    --concurrency 80 `
    --cpu-throttling=false `
    --execution-environment gen2 `
    --port 8080 `
    --set-env-vars $envVars `
    --set-secrets $secrets `
    --quiet 2>&1 | Tee-Object -FilePath $LogFile -Append

if ($LASTEXITCODE -ne 0) {
    Write-Log "Cloud Run deploy failed (exit $LASTEXITCODE)" 'ERROR'
    Write-Log "Cloud Run شکستی هێنا" 'ERROR'
    throw "Cloud Run deploy failed"
}

# -----------------------------------------------------------------------------
# Capture URL
# -----------------------------------------------------------------------------
Write-Banner -En "Capturing service URL" -Ku "وەرگرتنی URL خزمەتگوزاری"
$serviceUrl = (& gcloud run services describe $ServiceName `
    --region $Region `
    --project=$Project `
    --format='value(status.url)' 2>&1).Trim()

if (-not $serviceUrl -or $serviceUrl -notlike 'https://*') {
    Write-Log "Could not capture service URL: $serviceUrl" 'ERROR'
    throw "Service URL capture failed"
}

Set-Content -Path $UrlFile -Value $serviceUrl -Encoding UTF8
Write-Log "Service URL: $serviceUrl"
Write-Log "Saved to: $UrlFile"

# -----------------------------------------------------------------------------
# Optional: Sentry release tag
# -----------------------------------------------------------------------------
$sentryScript = Join-Path $RepoRoot 'scripts\sentry-release-tag.sh'
if ((Test-Path $sentryScript) -and $env:SENTRY_AUTH_TOKEN) {
    Write-Banner -En "Tagging Sentry release" -Ku "تاگکردنی وەشانی Sentry"
    $env:APP_VERSION = $Tag
    $gitSha = (& git rev-parse HEAD 2>&1).Trim()
    if ($gitSha -and $gitSha -notlike '*fatal*') { $env:GIT_SHA = $gitSha }
    $env:SENTRY_ENVIRONMENT = 'production'

    # Try wsl bash → git-bash → skip
    $bashCmd = $null
    if (Get-Command wsl -ErrorAction SilentlyContinue) { $bashCmd = 'wsl' }
    elseif (Get-Command bash -ErrorAction SilentlyContinue) { $bashCmd = 'bash' }

    if ($bashCmd) {
        try {
            if ($bashCmd -eq 'wsl') {
                & wsl bash ./scripts/sentry-release-tag.sh 2>&1 | Tee-Object -FilePath $LogFile -Append
            } else {
                Push-Location $RepoRoot
                & bash ./scripts/sentry-release-tag.sh 2>&1 | Tee-Object -FilePath $LogFile -Append
                Pop-Location
            }
        } catch {
            Write-Log "Sentry tag failed (non-fatal): $_" 'WARN'
        }
    } else {
        Write-Log "No bash available for Sentry tag; skipping" 'WARN'
    }
} else {
    Write-Log "Sentry tagging skipped (SENTRY_AUTH_TOKEN not set or script missing)"
}

# -----------------------------------------------------------------------------
# Success
# -----------------------------------------------------------------------------
Write-Banner -En "Deploy complete" -Ku "ناردن تەواو بوو"
Write-Host ""
Write-Host "  ✔ EN: Backend deployed successfully." -ForegroundColor Green
Write-Host "  ✔ KU: باکەند بە سەرکەوتوویی نێردرا." -ForegroundColor Green
Write-Host ""
Write-Host "  Service URL / URL ی خزمەتگوزاری:" -ForegroundColor White
Write-Host "    $serviceUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Next step / هەنگاوی داهاتوو:" -ForegroundColor White
Write-Host "    .\deploy\07-deploy-vercel.ps1 -CloudrunUrl $serviceUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Log file: $LogFile" -ForegroundColor Gray
Write-Host ""

exit 0
