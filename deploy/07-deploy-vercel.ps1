#requires -Version 7.0
<#
.SYNOPSIS
    Deploy the frontend to Vercel.
    ناردنی فڕۆنتئێند بۆ Vercel.

.DESCRIPTION
    Builds + deploys the React/Vite frontend to Vercel production. Ensures the
    CLOUDRUN_URL env var is set so /api/* rewrites work.

.PARAMETER ProjectName
    Vercel project name. ناوی پڕۆژەی Vercel.

.PARAMETER CloudrunUrl
    Backend Cloud Run URL. Reads from deploy/cloudrun-url.txt if omitted.
#>
[CmdletBinding()]
param(
    [string]$ProjectName = 'zoho-kurdish-erp',

    [string]$CloudrunUrl,

    [string]$VercelToken = $env:VERCEL_TOKEN
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptRoot
$LogDir     = Join-Path $ScriptRoot 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$Timestamp  = Get-Date -Format 'yyyyMMddTHHmmss'
$LogFile    = Join-Path $LogDir "vercel-deploy-$Timestamp.log"
$UrlFile    = Join-Path $ScriptRoot 'vercel-url.txt'
$CloudrunUrlFile = Join-Path $ScriptRoot 'cloudrun-url.txt'

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

# -----------------------------------------------------------------------------
# Pre-flight
# -----------------------------------------------------------------------------
Write-Banner -En "Vercel deploy — start" -Ku "دەستپێکردنی Vercel deploy"

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Log "Vercel CLI not found. Install: npm i -g vercel" 'ERROR'
    Write-Log "Vercel CLI نییە. دایبمەزرێنە: npm i -g vercel" 'ERROR'
    throw "Missing vercel CLI"
}

# Resolve CloudrunUrl
if (-not $CloudrunUrl) {
    if (Test-Path $CloudrunUrlFile) {
        $CloudrunUrl = (Get-Content -Path $CloudrunUrlFile -Raw).Trim()
        Write-Log "Read CloudrunUrl from $CloudrunUrlFile : $CloudrunUrl"
    } else {
        Write-Log "CloudrunUrl missing and $CloudrunUrlFile does not exist" 'ERROR'
        Write-Log "Run 06-deploy-cloudrun.ps1 first, or pass -CloudrunUrl explicitly" 'ERROR'
        throw "CloudrunUrl required"
    }
}
if ($CloudrunUrl -notlike 'https://*') {
    throw "CloudrunUrl must start with https:// (got: $CloudrunUrl)"
}

# Vercel auth check
Write-Log "Checking Vercel auth..."
$whoami = $null
try {
    if ($VercelToken) {
        $whoami = (& vercel whoami --token $VercelToken 2>&1) -join "`n"
    } else {
        $whoami = (& vercel whoami 2>&1) -join "`n"
    }
} catch {
    $whoami = "$_"
}

if ($LASTEXITCODE -ne 0 -or $whoami -like '*Error*' -or $whoami -like '*not authenticated*') {
    Write-Log "Vercel not authenticated. Run: vercel login" 'ERROR'
    Write-Log "Or set VERCEL_TOKEN env var." 'ERROR'
    Write-Log "Vercel چالاک نییە. ئەمە جێبەجێ بکە: vercel login" 'ERROR'
    throw "Vercel auth required"
}
Write-Log "Vercel user: $whoami"

# -----------------------------------------------------------------------------
# Set environment variables (production scope)
# -----------------------------------------------------------------------------
Write-Banner -En "Setting Vercel env vars" -Ku "ڕێکخستنی env vars لە Vercel"

function Set-VercelEnv {
    param([string]$Key, [string]$Value, [string]$Scope = 'production')
    if (-not $Value) {
        Write-Log "Skip $Key (empty)" 'WARN'
        return
    }

    Push-Location (Join-Path $RepoRoot 'frontend')
    try {
        # Remove existing so we can re-set
        $rmArgs = @('env', 'rm', $Key, $Scope, '--yes')
        if ($VercelToken) { $rmArgs += @('--token', $VercelToken) }
        & vercel @rmArgs 2>&1 | Out-Null

        # Add new
        Write-Log "Setting $Key in $Scope scope"
        $addArgs = @('env', 'add', $Key, $Scope)
        if ($VercelToken) { $addArgs += @('--token', $VercelToken) }
        $Value | & vercel @addArgs 2>&1 | Tee-Object -FilePath $LogFile -Append | Out-Null
    } finally {
        Pop-Location
    }
}

Set-VercelEnv -Key 'CLOUDRUN_URL'      -Value $CloudrunUrl
Set-VercelEnv -Key 'VITE_API_BASE_URL' -Value $CloudrunUrl
if ($env:VITE_SENTRY_DSN)        { Set-VercelEnv -Key 'VITE_SENTRY_DSN'        -Value $env:VITE_SENTRY_DSN }
if ($env:VITE_APP_VERSION)       { Set-VercelEnv -Key 'VITE_APP_VERSION'       -Value $env:VITE_APP_VERSION }
if ($env:RUM_BIGQUERY_DATASET)   { Set-VercelEnv -Key 'RUM_BIGQUERY_DATASET'   -Value $env:RUM_BIGQUERY_DATASET }

# -----------------------------------------------------------------------------
# Deploy
# -----------------------------------------------------------------------------
Write-Banner -En "Deploying to Vercel (production)" -Ku "ناردن بۆ Vercel"

Push-Location (Join-Path $RepoRoot 'frontend')
try {
    $deployArgs = @('--prod', '--yes')
    if ($VercelToken) { $deployArgs += @('--token', $VercelToken) }

    $deployOutput = & vercel @deployArgs 2>&1
    $deployOutput | ForEach-Object {
        Write-Host $_
        Add-Content -Path $LogFile -Value $_
    }

    if ($LASTEXITCODE -ne 0) {
        throw "vercel deploy failed (exit $LASTEXITCODE)"
    }

    # Extract URL — last https:// line in output
    $deployedUrl = $deployOutput | Where-Object { $_ -match '^https://[^\s]+\.vercel\.app' } | Select-Object -Last 1
    if (-not $deployedUrl) {
        $deployedUrl = $deployOutput | Where-Object { $_ -match 'https://[^\s]+' } | Select-Object -Last 1
        if ($deployedUrl -match '(https://\S+)') { $deployedUrl = $matches[1] }
    }
    $deployedUrl = "$deployedUrl".Trim()

    if (-not $deployedUrl) {
        throw "Could not extract deployed URL from vercel output"
    }
} finally {
    Pop-Location
}

Set-Content -Path $UrlFile -Value $deployedUrl -Encoding UTF8
Write-Log "Deployed URL: $deployedUrl"
Write-Log "Saved to: $UrlFile"

# -----------------------------------------------------------------------------
# Smoke check
# -----------------------------------------------------------------------------
Write-Banner -En "Smoke check" -Ku "تاقیکردنەوەی خێرا"
try {
    $resp = Invoke-WebRequest -Uri $deployedUrl -Method Get -UseBasicParsing -TimeoutSec 30
    Write-Log "GET $deployedUrl -> $($resp.StatusCode)"
    if ($resp.StatusCode -ne 200) {
        Write-Log "Non-200 response" 'WARN'
    } elseif ($resp.Content -notlike '*<div id="root"*' -and $resp.Content -notlike '*id="root"*') {
        Write-Log "Response does not contain <div id=`"root`"> — index.html may be misconfigured" 'WARN'
    } else {
        Write-Log "Frontend smoke check OK"
    }
} catch {
    Write-Log "Smoke check failed: $_" 'WARN'
}

# -----------------------------------------------------------------------------
# Success
# -----------------------------------------------------------------------------
Write-Banner -En "Deploy complete" -Ku "ناردن تەواو بوو"
Write-Host ""
Write-Host "  ✔ EN: Frontend deployed successfully." -ForegroundColor Green
Write-Host "  ✔ KU: فڕۆنتئێند بە سەرکەوتوویی نێردرا." -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend URL: $deployedUrl" -ForegroundColor Cyan
Write-Host "  Backend URL : $CloudrunUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Next step / هەنگاوی داهاتوو:" -ForegroundColor White
Write-Host "    .\deploy\08-smoke-test-production.ps1 -FrontendUrl $deployedUrl -BackendUrl $CloudrunUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Log: $LogFile" -ForegroundColor Gray
Write-Host ""

exit 0
