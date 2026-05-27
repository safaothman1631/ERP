#Requires -Version 5.1
<#
.SYNOPSIS
    00-deploy-everything.ps1 - Master orchestrator for the Kurdish ERP deploy.
    سکریپتی سەرەکی بۆ ناردنی تەواوی سیستەم.

.DESCRIPTION
    Runs scripts 01..09 in order with phase gating, idempotency checks, resume
    support, dry-run mode, and bilingual (kurdi + English) progress output.

    Failure behavior: STOPS at the first non-zero exit code, prints a bilingual
    error block with the failing line / hint and the exact resume command, and
    exits non-zero so the wrapper itself is CI-friendly.

.PARAMETER Project
    GCP project ID (required for any phase that touches GCP/Cloud Run/Vercel).
    ناسنامەی پڕۆژەی GCP.

.PARAMETER RepoName
    GitHub repo name (used by 04-push-to-github.ps1). Defaults to 'zoho'.

.PARAMETER Phase
    Which slice of the pipeline to run:
        verify       = 01
        build        = 02 + 03
        push         = 04 + 05
        deploy       = 06a (if needed) + 06 + 07a (if needed) + 07
        verify-prod  = 08 + 09
        all          = everything in order [default]

.PARAMETER DryRun
    Print what WOULD run, then exit 0 without invoking any child script.

.PARAMETER FromStep
    Resume at step N (2..9). Steps before N are skipped silently.

.PARAMETER SkipTests
    Skip 03-run-tests.ps1. Use only for emergency redeploys when you already
    have green CI on the same commit.

.EXAMPLE
    .\00-deploy-everything.ps1 -Project erp-system-494716 -RepoName zoho

.EXAMPLE
    .\00-deploy-everything.ps1 -Project erp-system-494716 -FromStep 6

.EXAMPLE
    .\00-deploy-everything.ps1 -Phase verify -DryRun

.NOTES
    - PowerShell 5.1 AND 7+ compatible.
    - Idempotent: 06a skipped if gcp-resources-manifest.json has done=true,
      07a skipped if vercel-link.json exists. 06 and 07 are non-idempotent
      by design (every run ships a new revision).
    - Logs everything to deploy\logs\master-<ISO>.log
#>
[CmdletBinding()]
param(
    [string]$Project,
    [string]$RepoName = 'zoho',
    [ValidateSet('verify','build','push','deploy','verify-prod','all')]
    [string]$Phase = 'all',
    [switch]$DryRun,
    [int]$FromStep = 1,
    [switch]$SkipTests
)

# ===========================================================================
# Setup - kurdi: damezrandni bnabnema
# ===========================================================================
$ErrorActionPreference = 'Continue'  # we handle exit codes ourselves
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir
$LogsDir   = Join-Path $ScriptDir 'logs'
if (-not (Test-Path $LogsDir)) { New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null }

$IsoStamp  = (Get-Date -Format 'yyyyMMddTHHmmss')
$LogFile   = Join-Path $LogsDir "master-$IsoStamp.log"

# UTF-8 output for Kurdish/Arabic characters. ISE has no console handle.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
$OutputEncoding = [System.Text.Encoding]::UTF8

# ===========================================================================
# Helpers
# ===========================================================================
function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format 'HH:mm:ss'), $Level, $Message
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    switch ($Level) {
        'ERROR' { Write-Host $line -ForegroundColor Red }
        'WARN'  { Write-Host $line -ForegroundColor Yellow }
        'OK'    { Write-Host $line -ForegroundColor Green }
        'HEAD'  { Write-Host $line -ForegroundColor Cyan }
        default { Write-Host $line }
    }
}

function Write-Banner {
    param([string]$Kurdi, [string]$English, [string]$Color = 'Cyan')
    $bar = '=' * 72
    Write-Host ''
    Write-Host $bar -ForegroundColor $Color
    Write-Host ("  {0}" -f $Kurdi)   -ForegroundColor $Color
    Write-Host ("  {0}" -f $English) -ForegroundColor $Color
    Write-Host $bar -ForegroundColor $Color
    Add-Content -Path $LogFile -Value $bar -Encoding UTF8
    Add-Content -Path $LogFile -Value "  $Kurdi"   -Encoding UTF8
    Add-Content -Path $LogFile -Value "  $English" -Encoding UTF8
    Add-Content -Path $LogFile -Value $bar -Encoding UTF8
}

function Format-Duration {
    param([TimeSpan]$Span)
    if ($Span.TotalSeconds -lt 60) { return ("{0:N1}s" -f $Span.TotalSeconds) }
    if ($Span.TotalMinutes -lt 60) { return ("{0:N1}m" -f $Span.TotalMinutes) }
    return ("{0:N2}h" -f $Span.TotalHours)
}

# ===========================================================================
# PowerShell version check - kurdi: pshknini PowerShell
# ===========================================================================
$psMajor = $PSVersionTable.PSVersion.Major
if ($psMajor -lt 7) {
    Write-Log "PowerShell $($PSVersionTable.PSVersion) detected. Scripts 06a, 07a, 09 require 7+." 'WARN'
    Write-Log "PowerShell 5.1 detected — تکایە PowerShell 7 دامەزرێنە لە https://aka.ms/powershell" 'WARN'
    Write-Log "Continuing with 5.1 — scripts that #Requires -Version 7.0 will fail loudly." 'WARN'
} else {
    Write-Log "PowerShell $($PSVersionTable.PSVersion) detected — OK." 'OK'
}

# ===========================================================================
# Step registry - kurdi: tumarkhanay hangawekan
# ===========================================================================
# Each step:
#   id       = numeric step id used by -FromStep
#   script   = filename in deploy\
#   phase    = which -Phase tag it belongs to
#   kurdi    = banner text (kurdi)
#   english  = banner text (English)
#   args     = scriptblock returning the argument array (so we can compose
#              with -Project / -RepoName / etc.)
#   skipIf   = scriptblock returning $true to skip (idempotency)
#   hint     = bilingual troubleshooting one-liner for failures
$Steps = @(
    @{
        id=1; script='01-prereqs.ps1'; phase='verify';
        kurdi='هەنگاوی ١ — پشکنینی پێداویستی';
        english='Step 01 — Prerequisites verify';
        args = { @() }
        skipIf = { $false }
        hint = "01-prereqs failed — تکایە prereqs-report.txt بخوێنەرەوە / read deploy\prereqs-report.txt for missing tools."
    },
    @{
        id=2; script='02-install-and-build.ps1'; phase='build';
        kurdi='هەنگاوی ٢ — npm install + build + pip install';
        english='Step 02 — Install + build';
        args = { @() }
        skipIf = { $false }
        hint = "02-build failed — check the LAST 50 lines of deploy\logs\build-*.log; usually npm peer-dep mismatch (try npm install --legacy-peer-deps manually)."
    },
    @{
        id=3; script='03-run-tests.ps1'; phase='build';
        kurdi='هەنگاوی ٣ — تێستەکان (Vitest + Playwright + pytest)';
        english='Step 03 — Test suite';
        args = { @() }
        skipIf = { $script:SkipTests.IsPresent }
        hint = "03-tests failed — read deploy\logs\tests-*.log; Playwright often needs `npx playwright install chromium` once."
    },
    @{
        id=4; script='04-push-to-github.ps1'; phase='push';
        kurdi='هەنگاوی ٤ — git push بۆ GitHub';
        english='Step 04 — Push to GitHub';
        args = { @('-RepoName', $script:RepoName) }
        skipIf = { $false }
        hint = "04-push failed — run `gh auth status`; if not logged in: `gh auth login`. Then re-run from step 4."
    },
    @{
        id=5; script='05-setup-secrets.ps1'; phase='push';
        kurdi='هەنگاوی ٥ — دانانی GitHub Actions secrets';
        english='Step 05 — GitHub Actions secrets';
        args = { @() }
        skipIf = { $false }
        hint = "05-secrets failed — fill in deploy\.env.deploy first (copy from .env.example); 16 secrets needed."
    },
    @{
        id=6; script='06a-setup-gcp-resources.ps1'; phase='deploy';
        kurdi='هەنگاوی ٦أ — ڕێکخستنی GCP (یەک جار)';
        english='Step 06a — One-time GCP project setup';
        args = {
            if (-not $script:Project) { throw "Phase 'deploy' requires -Project" }
            @('-Project', $script:Project, '-Confirm')
        }
        skipIf = {
            $manifest = Join-Path $script:ScriptDir 'gcp-resources-manifest.json'
            if (-not (Test-Path $manifest)) { return $false }
            try {
                $data = Get-Content $manifest -Raw -Encoding UTF8 | ConvertFrom-Json
                # done=true is the official signal; if absent, treat as "still incomplete".
                if ($data.PSObject.Properties.Name -contains 'done') { return [bool]$data.done }
                # Fallback: if all major resources are populated, assume done.
                return ($data.apis -and $data.artifact_repo -and $data.firestore -and $data.wif -and $data.service_account)
            } catch {
                return $false
            }
        }
        hint = "06a failed — confirm `gcloud auth login` AND `gcloud config set project <id>`; check IAM roles include Owner or Project Editor."
    },
    @{
        id=7; script='06-deploy-cloudrun.ps1'; phase='deploy';
        kurdi='هەنگاوی ٦ — Cloud Run deploy';
        english='Step 06 — Cloud Run deploy';
        args = {
            if (-not $script:Project) { throw "Phase 'deploy' requires -Project" }
            @('-Project', $script:Project)
        }
        skipIf = { $false }
        hint = "06 Cloud Run failed — read deploy\logs\cloudrun-deploy-*.log; common: `gcloud auth configure-docker me-central1-docker.pkg.dev` not run."
    },
    @{
        id=8; script='07a-setup-vercel-project.ps1'; phase='deploy';
        kurdi='هەنگاوی ٧أ — لینکی Vercel (یەک جار)';
        english='Step 07a — One-time Vercel project link';
        args = {
            $cloudrunUrlFile = Join-Path $script:ScriptDir 'cloudrun-url.txt'
            if (Test-Path $cloudrunUrlFile) {
                $url = (Get-Content $cloudrunUrlFile -Raw -Encoding UTF8).Trim()
                return @('-CloudrunUrl', $url)
            }
            return @()
        }
        skipIf = {
            $link = Join-Path $script:ScriptDir 'vercel-link.json'
            return (Test-Path $link)
        }
        hint = "07a failed — run `vercel login` first; check `vercel whoami`. Scope must match the project owner."
    },
    @{
        id=9; script='07-deploy-vercel.ps1'; phase='deploy';
        kurdi='هەنگاوی ٧ — Vercel deploy';
        english='Step 07 — Vercel deploy';
        args = { @() }
        skipIf = { $false }
        hint = "07 Vercel deploy failed — check frontend\.vercel\project.json exists; if not, re-run with -FromStep 8 (which runs 07a)."
    },
    @{
        id=10; script='08-smoke-test-production.ps1'; phase='verify-prod';
        kurdi='هەنگاوی ٨ — smoke test لە بەرهەمهێنان';
        english='Step 08 — Production smoke test';
        args = {
            $args = @()
            $crFile = Join-Path $script:ScriptDir 'cloudrun-url.txt'
            $vcFile = Join-Path $script:ScriptDir 'vercel-url.txt'
            if (Test-Path $crFile) { $args += @('-BackendUrl',  (Get-Content $crFile -Raw -Encoding UTF8).Trim()) }
            if (Test-Path $vcFile) { $args += @('-FrontendUrl', (Get-Content $vcFile -Raw -Encoding UTF8).Trim()) }
            return $args
        }
        skipIf = { $false }
        hint = "08 smoke failed — check cloudrun-url.txt and vercel-url.txt point to fresh URLs; check Cloud Run service is not in error state in console."
    },
    @{
        id=11; script='09-post-deploy-checklist.ps1'; phase='verify-prod';
        kurdi='هەنگاوی ٩ — لیستی پاش-deploy';
        english='Step 09 — Post-deploy checklist';
        args = {
            $args = @()
            if ($script:Project) { $args += @('-Project', $script:Project) }
            $vcFile = Join-Path $script:ScriptDir 'vercel-url.txt'
            if (Test-Path $vcFile) { $args += @('-FrontendUrl', (Get-Content $vcFile -Raw -Encoding UTF8).Trim()) }
            return $args
        }
        skipIf = { $false }
        hint = "09 checklist is informational — exit non-zero only means one of the manual checks was declined; review the output."
    }
)

# ===========================================================================
# Phase filter - kurdi: filtri qonax
# ===========================================================================
function Test-PhaseMatch {
    param([string]$StepPhase, [string]$RequestedPhase)
    if ($RequestedPhase -eq 'all') { return $true }
    return ($StepPhase -eq $RequestedPhase)
}

# ===========================================================================
# Dispatch
# ===========================================================================
Write-Banner -Kurdi "ناردنی سیستەم — Master Orchestrator" -English "Kurdish ERP Master Deploy Orchestrator" -Color 'Magenta'

Write-Log "Log file: $LogFile" 'INFO'
Write-Log "Phase: $Phase | FromStep: $FromStep | DryRun: $($DryRun.IsPresent) | SkipTests: $($SkipTests.IsPresent)" 'INFO'
if ($Project)  { Write-Log "Project:  $Project"  'INFO' }
if ($RepoName) { Write-Log "RepoName: $RepoName" 'INFO' }

$Overall = [System.Diagnostics.Stopwatch]::StartNew()
$Results = New-Object System.Collections.Generic.List[object]
$FailedAt = $null

foreach ($step in $Steps) {
    $sid     = $step.id
    $sName   = $step.script
    $sPhase  = $step.phase

    # Phase filter
    if (-not (Test-PhaseMatch -StepPhase $sPhase -RequestedPhase $Phase)) {
        continue
    }
    # FromStep filter
    if ($sid -lt $FromStep) {
        Write-Log "Skipping step $sid ($sName) — before -FromStep $FromStep" 'INFO'
        continue
    }

    Write-Banner -Kurdi $step.kurdi -English $step.english

    # Idempotency skip
    $shouldSkip = $false
    try {
        $shouldSkip = & $step.skipIf
    } catch {
        Write-Log "skipIf check threw for step $sid — proceeding to run. Error: $_" 'WARN'
        $shouldSkip = $false
    }
    if ($shouldSkip) {
        Write-Log "Step $sid ($sName) marked as already-done — skipping (idempotent)." 'OK'
        Write-Log "هەنگاوی $sid پێشتر تەواو بووە — تێپەڕاند" 'OK'
        $Results.Add([pscustomobject]@{ Id=$sid; Script=$sName; Status='SKIPPED'; Duration='--'; ExitCode=0 })
        continue
    }

    # Compose args
    $scriptArgs = @()
    try {
        $scriptArgs = & $step.args
        if ($null -eq $scriptArgs) { $scriptArgs = @() }
    } catch {
        Write-Log "Failed to build args for step $sid — $_" 'ERROR'
        $FailedAt = $step
        break
    }

    $scriptPath = Join-Path $ScriptDir $sName
    if (-not (Test-Path $scriptPath)) {
        Write-Log "Script not found: $scriptPath" 'ERROR'
        Write-Log "سکریپت نەدۆزرایەوە — $scriptPath" 'ERROR'
        $FailedAt = $step
        break
    }

    # Dry-run: print and continue
    if ($DryRun) {
        $argStr = ($scriptArgs -join ' ')
        Write-Log "[DRY-RUN] Would run: $sName $argStr" 'INFO'
        $Results.Add([pscustomobject]@{ Id=$sid; Script=$sName; Status='DRY-RUN'; Duration='--'; ExitCode=0 })
        continue
    }

    # Run it
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Log "Running: $sName $($scriptArgs -join ' ')" 'HEAD'

    # We invoke through pwsh-compatible call:  & $scriptPath @args
    # Capture exit code via $LASTEXITCODE which child scripts set on `exit N`.
    $global:LASTEXITCODE = 0
    try {
        & $scriptPath @scriptArgs
    } catch {
        Write-Log "Step $sid threw a terminating error: $_" 'ERROR'
        $global:LASTEXITCODE = 1
    }
    $sw.Stop()
    $exitCode = $global:LASTEXITCODE
    $dur = Format-Duration -Span $sw.Elapsed

    if ($exitCode -ne 0) {
        Write-Log "Step $sid ($sName) FAILED with exit code $exitCode after $dur" 'ERROR'
        $Results.Add([pscustomobject]@{ Id=$sid; Script=$sName; Status='FAIL'; Duration=$dur; ExitCode=$exitCode })
        $FailedAt = $step
        break
    }

    Write-Log "Step $sid ($sName) OK in $dur" 'OK'
    $Results.Add([pscustomobject]@{ Id=$sid; Script=$sName; Status='OK'; Duration=$dur; ExitCode=0 })
}

$Overall.Stop()

# ===========================================================================
# Summary - kurdi: kortebezhin
# ===========================================================================
Write-Banner -Kurdi "کۆتایی — Summary" -English "Run Summary" -Color 'Magenta'

$Results | Format-Table -AutoSize | Out-String | ForEach-Object {
    Write-Host $_
    Add-Content -Path $LogFile -Value $_ -Encoding UTF8
}

$totalDur = Format-Duration -Span $Overall.Elapsed

if ($FailedAt) {
    Write-Host ''
    Write-Host '====================================================================' -ForegroundColor Red
    Write-Host ("  X  هەنگاوی {0} سەرکەوتوو نەبوو — {1}" -f $FailedAt.id, $FailedAt.script) -ForegroundColor Red
    Write-Host ("  X  Step {0} FAILED — {1}" -f $FailedAt.id, $FailedAt.script) -ForegroundColor Red
    Write-Host ''
    Write-Host ("     چاکسازی پێشنیار / Hint:") -ForegroundColor Yellow
    Write-Host ("     {0}" -f $FailedAt.hint) -ForegroundColor Yellow
    Write-Host ''
    Write-Host ("     بەردەوام بوون / Resume with:") -ForegroundColor Cyan
    $resumeProj = if ($Project) { " -Project $Project" } else { "" }
    Write-Host ("     .\00-deploy-everything.ps1{0} -FromStep {1}" -f $resumeProj, $FailedAt.id) -ForegroundColor Cyan
    Write-Host ''
    Write-Host ("     لۆگ / Full log:  {0}" -f $LogFile) -ForegroundColor Cyan
    Write-Host '====================================================================' -ForegroundColor Red
    Write-Log "TOTAL TIME (with failure): $totalDur" 'ERROR'
    exit 1
}

Write-Host ''
Write-Host '====================================================================' -ForegroundColor Green
Write-Host "  OK  هەموو هەنگاوەکان تەواو بوون — All requested steps completed" -ForegroundColor Green
Write-Host ("  OK  Total time / کاتی گشتی:  {0}" -f $totalDur) -ForegroundColor Green
Write-Host ("  OK  Log file:  {0}" -f $LogFile) -ForegroundColor Green
Write-Host '====================================================================' -ForegroundColor Green
Write-Log "TOTAL TIME: $totalDur" 'OK'
exit 0
