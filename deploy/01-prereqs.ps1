#Requires -Version 5.1
<#
.SYNOPSIS
    01-prereqs.ps1 - Verify all prerequisites for deploying the Kurdish ERP system.

.DESCRIPTION
    Checks installed versions of node, npm, python, git, gh, gcloud, vercel, docker.
    Verifies login status for gh, gcloud, vercel.
    Warns on missing env vars (GH_TOKEN, GCP_PROJECT_ID, VERCEL_TOKEN).
    Writes a snapshot to deploy/prereqs-report.txt.

.NOTES
    - Idempotent: safe to re-run.
    - Exit 0 = all hard-required tools present and logged in.
    - Exit 1 = one or more required tools missing.
#>

# ===========================================================================
# Setup - kurdi: damezrandni bnabnema (paths, log, encoding)
# ===========================================================================
$ErrorActionPreference = 'Continue'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir
$LogsDir   = Join-Path $ScriptDir 'logs'
$ReportFile = Join-Path $ScriptDir 'prereqs-report.txt'

if (-not (Test-Path $LogsDir)) { New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null }

$Timestamp = (Get-Date -Format 'yyyyMMdd-HHmmss')
$LogFile = Join-Path $LogsDir "prereqs-$Timestamp.log"

# UTF-8 output for proper rendering of Kurdish/Arabic characters
# Wrap in try/catch — fails harmlessly in PowerShell ISE which doesn't have a console handle
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
  # ISE has no console handle — non-fatal
}
$OutputEncoding = [System.Text.Encoding]::UTF8

# ===========================================================================
# Helpers - kurdi: hawkari functions bo cap u nuusin
# ===========================================================================
function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $line = "[$([DateTime]::Now.ToString('HH:mm:ss'))] [$Level] $Message"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    if ($Level -eq 'ERROR') { Write-Host $line -ForegroundColor Red }
    elseif ($Level -eq 'WARN') { Write-Host $line -ForegroundColor Yellow }
    elseif ($Level -eq 'OK') { Write-Host $line -ForegroundColor Green }
    else { Write-Host $line }
}

function Test-Command {
    param([string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    return [bool]$cmd
}

function Get-CommandVersion {
    param([string]$Name, [string]$VersionArg = '--version')
    try {
        $output = & $Name $VersionArg 2>&1 | Out-String
        return $output.Trim().Split("`n")[0]
    } catch {
        return "(unknown)"
    }
}

# ===========================================================================
# Tool check struct - kurdi: tomarkrdni hamu pshknnekan
# ===========================================================================
$Results = New-Object System.Collections.Generic.List[object]
$HardFailures = 0

function Check-Tool {
    param(
        [string]$Name,
        [string]$DisplayName,
        [string]$MinVersion,
        [string]$InstallUrl,
        [bool]$Required = $true,
        [string]$VersionArg = '--version'
    )
    $exists = Test-Command -Name $Name
    $version = if ($exists) { Get-CommandVersion -Name $Name -VersionArg $VersionArg } else { '(not installed)' }
    $status = if ($exists) { 'OK' } else { if ($Required) { 'MISSING' } else { 'OPTIONAL-MISSING' } }
    $emoji  = if ($exists) { '[OK]' } else { if ($Required) { '[X]' } else { '[!]' } }

    Write-Log "$emoji $DisplayName : $version" -Level $(if ($exists) {'OK'} elseif ($Required) {'ERROR'} else {'WARN'})
    if (-not $exists) {
        Write-Log "    Install from: $InstallUrl" -Level 'WARN'
        if ($Required) { $script:HardFailures++ }
    }
    $Results.Add([pscustomobject]@{
        Tool = $DisplayName; Required = $Required; Installed = $exists; Version = $version; InstallUrl = $InstallUrl
    })
}

# ===========================================================================
# Banner - kurdi: serbastrwekan
# ===========================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  01-prereqs.ps1 - pshknini amerekan bo deploy" -ForegroundColor Cyan
Write-Host "  Prereqs Check for Kurdish ERP Deploy" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Log "Starting prereqs check at $Timestamp"
Write-Log "Repo root: $RepoRoot"
Write-Log "Log file:  $LogFile"
Write-Host ""

# ===========================================================================
# 1. Core dev tools - kurdi: amera bnaratiyakan
# ===========================================================================
Write-Host "--- 1. Core dev tools / amera bnaratiyakan ---" -ForegroundColor Cyan
Check-Tool -Name 'node'    -DisplayName 'Node.js (>=20)' -InstallUrl 'https://nodejs.org/' -MinVersion '20.0.0'
Check-Tool -Name 'npm'     -DisplayName 'npm'            -InstallUrl 'https://nodejs.org/'
Check-Tool -Name 'python'  -DisplayName 'Python (>=3.11)' -InstallUrl 'https://www.python.org/downloads/' -MinVersion '3.11'
Check-Tool -Name 'git'     -DisplayName 'Git'            -InstallUrl 'https://git-scm.com/download/win'

# ===========================================================================
# 2. Cloud CLIs - kurdi: amera cloud-iyakan
# ===========================================================================
Write-Host ""
Write-Host "--- 2. Cloud CLIs / amera cloud-iyakan ---" -ForegroundColor Cyan
Check-Tool -Name 'gh'      -DisplayName 'GitHub CLI'     -InstallUrl 'https://cli.github.com/'
Check-Tool -Name 'gcloud'  -DisplayName 'Google Cloud SDK' -InstallUrl 'https://cloud.google.com/sdk/docs/install' -VersionArg 'version'
Check-Tool -Name 'vercel'  -DisplayName 'Vercel CLI'     -InstallUrl 'https://vercel.com/docs/cli'

# ===========================================================================
# 3. Optional - kurdi: amera helbjardayi (docker)
# ===========================================================================
Write-Host ""
Write-Host "--- 3. Optional / helbjardayi ---" -ForegroundColor Cyan
Check-Tool -Name 'docker'  -DisplayName 'Docker Desktop' -InstallUrl 'https://docker.com/desktop' -Required $false

# ===========================================================================
# 4. Login status - kurdi: pshknini chuunajurewa
# ===========================================================================
Write-Host ""
Write-Host "--- 4. Login status / pshknini chuunajurewa ---" -ForegroundColor Cyan

# gh auth status
if (Test-Command 'gh') {
    $ghAuth = & gh auth status 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        Write-Log "[OK] gh: authenticated" -Level 'OK'
    } else {
        Write-Log "[X] gh: NOT authenticated -> run 'gh auth login'" -Level 'ERROR'
        $HardFailures++
    }
}

# gcloud auth
# PowerShell parses unquoted parentheses, so wrap the --format value in quotes.
if (Test-Command 'gcloud') {
    $gcloudAuth = & gcloud auth list "--filter=status:ACTIVE" "--format=value(account)" 2>&1 | Out-String
    if ($gcloudAuth -and $gcloudAuth.Trim()) {
        Write-Log "[OK] gcloud: logged in as $($gcloudAuth.Trim())" -Level 'OK'
    } else {
        Write-Log "[X] gcloud: NOT logged in -> run 'gcloud auth login'" -Level 'ERROR'
        $HardFailures++
    }
}

# vercel whoami
# Vercel CLI on Windows wraps node.exe and emits the CLI banner ("Vercel CLI x.y.z") to stderr.
# Filter to the LAST non-empty line that doesn't start with "Vercel CLI" — that's the username.
if (Test-Command 'vercel') {
    $vercelOut = & vercel whoami 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0 -and $vercelOut.Trim()) {
        $vercelUser = ($vercelOut -split "`n" `
            | ForEach-Object { $_.Trim() } `
            | Where-Object { $_ -and ($_ -notmatch '^Vercel CLI') -and ($_ -notmatch '^node\.exe') } `
            | Select-Object -Last 1)
        if (-not $vercelUser) { $vercelUser = $vercelOut.Trim() }
        Write-Log "[OK] vercel: logged in as $vercelUser" -Level 'OK'
    } else {
        Write-Log "[!] vercel: not logged in -> run 'vercel login' (or skip if not deploying frontend)" -Level 'WARN'
    }
}

# ===========================================================================
# 5. Env vars - kurdi: pshknini guzharakan
# ===========================================================================
Write-Host ""
Write-Host "--- 5. Environment variables (warnings only) ---" -ForegroundColor Cyan

$envVars = @('GH_TOKEN', 'GCP_PROJECT_ID', 'VERCEL_TOKEN')
foreach ($v in $envVars) {
    $val = [Environment]::GetEnvironmentVariable($v)
    if ($val) {
        Write-Log "[OK] env $v is set (value redacted)" -Level 'OK'
    } else {
        Write-Log "[!] env $v is NOT set (optional - can also be set in deploy\.env.deploy)" -Level 'WARN'
    }
}

# ===========================================================================
# 6. Report - kurdi: nuusini raport
# ===========================================================================
Write-Host ""
Write-Host "--- 6. Writing report / nuusini raport ---" -ForegroundColor Cyan

$reportLines = @()
$reportLines += "=== Prereqs Report - $Timestamp ==="
$reportLines += "Repo: $RepoRoot"
$reportLines += "Hard failures: $HardFailures"
$reportLines += ""
$reportLines += "{0,-25} {1,-10} {2,-10} {3}" -f 'Tool','Required','Installed','Version'
$reportLines += ('-' * 80)
foreach ($r in $Results) {
    $reportLines += "{0,-25} {1,-10} {2,-10} {3}" -f $r.Tool, $r.Required, $r.Installed, $r.Version
}
$reportLines += ""
$reportLines += "See full log at: $LogFile"

Set-Content -Path $ReportFile -Value $reportLines -Encoding UTF8
Write-Log "Report written to: $ReportFile" -Level 'OK'

# ===========================================================================
# 7. Final verdict - kurdi: encami koayi
# ===========================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
if ($HardFailures -eq 0) {
    Write-Host "  [OK] hamu pshkninekan derbazbun - amada bo hangawi 2" -ForegroundColor Green
    Write-Host "  All prereq checks passed - ready for step 2" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next: .\deploy\02-install-and-build.ps1" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "  [X] $HardFailures pshknin shkti henan - report bxwenrawe" -ForegroundColor Red
    Write-Host "  $HardFailures checks failed - see report" -ForegroundColor Red
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Report: $ReportFile" -ForegroundColor Yellow
    Write-Host "Log:    $LogFile" -ForegroundColor Yellow
    exit 1
}
