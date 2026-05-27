#requires -Version 7.0
<#
.SYNOPSIS
    One-time Vercel project setup for Zoho ERP.
    ڕێکخستنی Vercel — جارێک.

.DESCRIPTION
    Links the frontend/ directory to a Vercel project, sets framework preset,
    root directory, and seeds production env vars.

.PARAMETER ProjectName
    Vercel project name. ناوی پڕۆژەی Vercel.
#>
[CmdletBinding()]
param(
    [string]$ProjectName = 'zoho-kurdish-erp',

    [string]$VercelToken = $env:VERCEL_TOKEN,

    [string]$CloudrunUrl,

    [string]$SentryDsn = $env:VITE_SENTRY_DSN,

    [string]$AppVersion = (Get-Date -Format 'yyyyMMdd')
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptRoot
$LogDir     = Join-Path $ScriptRoot 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$Timestamp  = Get-Date -Format 'yyyyMMddTHHmmss'
$LogFile    = Join-Path $LogDir "vercel-setup-$Timestamp.log"

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

Write-Banner -En "Vercel project setup" -Ku "ڕێکخستنی پڕۆژەی Vercel"

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Log "Install vercel CLI: npm i -g vercel" 'ERROR'
    throw "vercel CLI missing"
}

# Filter Vercel CLI banner/noise lines from output. The Vercel CLI on
# Windows emits a "Vercel CLI x.y.z" banner and sometimes node.exe lines
# to stderr that mix with the actual command output. Strip them.
function Get-VercelOutputClean {
    param([object[]]$Raw)
    $clean = $Raw | ForEach-Object { "$_" } | Where-Object {
        $_ -and
        $_ -notmatch '^\s*Vercel CLI' -and
        $_ -notmatch '^\s*node\.exe' -and
        $_ -notmatch '^\s*$'
    }
    return $clean
}

# -----------------------------------------------------------------------------
# Auth
# -----------------------------------------------------------------------------
Write-Log "Checking Vercel auth..."
$whoami = $null
try {
    if ($VercelToken) {
        $rawWho = & vercel whoami --token $VercelToken 2>&1
    } else {
        $rawWho = & vercel whoami 2>&1
    }
    $cleanWho = Get-VercelOutputClean -Raw $rawWho
    # Take the last non-empty line as the username
    $whoami = ($cleanWho | Select-Object -Last 1)
    if (-not $whoami) { $whoami = ($rawWho -join "`n") }
} catch { $whoami = "$_" }

if ($LASTEXITCODE -ne 0 -or $whoami -like '*Error*' -or $whoami -like '*not authenticated*' -or $whoami -like '*log in*') {
    Write-Log "Not authenticated. Run: vercel login" 'ERROR'
    throw "vercel auth required"
}
Write-Log "Authenticated as: $whoami"

# -----------------------------------------------------------------------------
# Link project
# -----------------------------------------------------------------------------
Write-Banner -En "Linking project" -Ku "گرێدانی پڕۆژە"
Push-Location (Join-Path $RepoRoot 'frontend')
try {
    $linkArgs = @('link', '--project', $ProjectName, '--yes')
    if ($VercelToken) { $linkArgs += @('--token', $VercelToken) }
    & vercel @linkArgs 2>&1 | Tee-Object -FilePath $LogFile -Append
    if ($LASTEXITCODE -ne 0) {
        throw "vercel link failed"
    }
} finally {
    Pop-Location
}

# -----------------------------------------------------------------------------
# Read project metadata
# -----------------------------------------------------------------------------
$vercelProjectFile = Join-Path $RepoRoot 'frontend\.vercel\project.json'
$projectId = $null
$orgId = $null
if (Test-Path $vercelProjectFile) {
    $projInfo = Get-Content $vercelProjectFile -Raw | ConvertFrom-Json
    $projectId = $projInfo.projectId
    $orgId     = $projInfo.orgId
    Write-Log "Project ID: $projectId"
    Write-Log "Org ID    : $orgId"
}

# -----------------------------------------------------------------------------
# Set env vars
# -----------------------------------------------------------------------------
Write-Banner -En "Setting production env vars" -Ku "ڕێکخستنی env vars"

function Set-EnvVar {
    param([string]$Key, [string]$Value)
    if (-not $Value) {
        Write-Log "Skip $Key (no value)" 'WARN'
        return
    }
    Push-Location (Join-Path $RepoRoot 'frontend')
    try {
        $rmArgs = @('env', 'rm', $Key, 'production', '--yes')
        if ($VercelToken) { $rmArgs += @('--token', $VercelToken) }
        & vercel @rmArgs 2>&1 | Out-Null

        $addArgs = @('env', 'add', $Key, 'production')
        if ($VercelToken) { $addArgs += @('--token', $VercelToken) }
        Write-Log "Setting $Key"
        $Value | & vercel @addArgs 2>&1 | Tee-Object -FilePath $LogFile -Append | Out-Null
    } finally {
        Pop-Location
    }
}

if ($CloudrunUrl) { Set-EnvVar -Key 'CLOUDRUN_URL'     -Value $CloudrunUrl }
if ($CloudrunUrl) { Set-EnvVar -Key 'VITE_API_BASE_URL' -Value $CloudrunUrl }
if ($SentryDsn)   { Set-EnvVar -Key 'VITE_SENTRY_DSN'   -Value $SentryDsn }
if ($AppVersion)  { Set-EnvVar -Key 'VITE_APP_VERSION'  -Value $AppVersion }

# -----------------------------------------------------------------------------
# Reminder: framework preset + root directory
# -----------------------------------------------------------------------------
Write-Banner -En "Manual settings — Vercel dashboard" -Ku "ڕێکخستنی دەستی"
Write-Host ""
Write-Host "  EN: In the Vercel dashboard, set:" -ForegroundColor Yellow
Write-Host "  KU: لە Vercel dashboard، ئەمانە ڕێک بخە:" -ForegroundColor Yellow
Write-Host ""
Write-Host "    Framework Preset : Vite" -ForegroundColor White
Write-Host "    Root Directory   : frontend" -ForegroundColor White
Write-Host "    Build Command    : npm run build" -ForegroundColor White
Write-Host "    Output Directory : dist" -ForegroundColor White
Write-Host "    Install Command  : npm install --legacy-peer-deps" -ForegroundColor White
Write-Host ""
Write-Host "  (vercel.json already overrides these; manual settings are a backstop.)" -ForegroundColor Gray

# -----------------------------------------------------------------------------
# Output IDs for GitHub Action secrets
# -----------------------------------------------------------------------------
Write-Banner -En "GitHub Action secrets" -Ku "نهێنیەکان بۆ GitHub Action"
Write-Host ""
Write-Host "  Add these to GitHub:" -ForegroundColor Cyan
Write-Host ""
if ($orgId)     { Write-Host "    VERCEL_ORG_ID     = $orgId" -ForegroundColor Yellow }
if ($projectId) { Write-Host "    VERCEL_PROJECT_ID = $projectId" -ForegroundColor Yellow }
Write-Host "    VERCEL_TOKEN      = (your CLI token, generate at vercel.com/account/tokens)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Via gh:" -ForegroundColor White
if ($orgId)     { Write-Host "    gh secret set VERCEL_ORG_ID --body '$orgId'" -ForegroundColor Gray }
if ($projectId) { Write-Host "    gh secret set VERCEL_PROJECT_ID --body '$projectId'" -ForegroundColor Gray }
Write-Host "    gh secret set VERCEL_TOKEN --body '<paste-token>'" -ForegroundColor Gray
Write-Host ""

Write-Log "Setup complete"
Write-Host "  ✔ EN: Setup complete." -ForegroundColor Green
Write-Host "  ✔ KU: ڕێکخستن تەواو بوو." -ForegroundColor Green
Write-Host ""

exit 0
