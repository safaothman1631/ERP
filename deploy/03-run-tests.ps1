#Requires -Version 5.1
<#
.SYNOPSIS
    03-run-tests.ps1 - Run the full test suite (Vitest + Playwright + pytest).

.DESCRIPTION
    Frontend:
      - npm test -- --run (Vitest)
      - npm test -- --run --coverage (produces coverage/coverage-summary.json)
      - Playwright smoke: npm run nav:sweep (fallback: playwright test --grep @smoke)
    Backend:
      - pytest --cov=app --cov-report=xml --cov-report=term (writes backend/coverage.xml)
      - python -c "from app.main import app; print(len(app.routes))" smoke test

.NOTES
    Exit 0 = all tests pass.
    Exit 1 = any test failure.
    Idempotent and resumable.
#>

# ===========================================================================
# Setup
# ===========================================================================
$ErrorActionPreference = 'Continue'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir
$LogsDir   = Join-Path $ScriptDir 'logs'

if (-not (Test-Path $LogsDir)) { New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null }

$Timestamp = (Get-Date -Format 'yyyyMMdd-HHmmss')
$LogFile = Join-Path $LogsDir "tests-$Timestamp.log"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$FrontendDir = Join-Path $RepoRoot 'frontend'
$BackendDir  = Join-Path $RepoRoot 'backend'

# ===========================================================================
# Result tracker - kurdi: tomarkrdni hamu encamekan
# ===========================================================================
$Results = New-Object System.Collections.Generic.List[object]
$AnyFail = $false

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $line = "[$([DateTime]::Now.ToString('HH:mm:ss'))] [$Level] $Message"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    if ($Level -eq 'ERROR') { Write-Host $line -ForegroundColor Red }
    elseif ($Level -eq 'WARN') { Write-Host $line -ForegroundColor Yellow }
    elseif ($Level -eq 'OK') { Write-Host $line -ForegroundColor Green }
    else { Write-Host $line }
}

# Run a test step, capture output, record pass/fail
function Run-TestStep {
    param(
        [string]$Section,
        [string]$Description,
        [string]$Cwd,
        [string]$Exe,
        [string[]]$Args
    )
    Write-Log "==> [$Section] $Description" -Level 'INFO'
    Push-Location $Cwd
    try {
        $out = & $Exe @Args 2>&1
        $out | ForEach-Object {
            Add-Content -Path $LogFile -Value $_ -Encoding UTF8
            Write-Host $_
        }
        $rc = $LASTEXITCODE
        if ($rc -eq 0) {
            Write-Log "[OK] $Section: $Description" -Level 'OK'
            $Results.Add([pscustomobject]@{ Section=$Section; Step=$Description; Status='PASS'; ExitCode=$rc })
            return $true
        } else {
            Write-Log "[X] $Section: $Description (exit $rc)" -Level 'ERROR'
            $Results.Add([pscustomobject]@{ Section=$Section; Step=$Description; Status='FAIL'; ExitCode=$rc })
            $script:AnyFail = $true
            return $false
        }
    } finally {
        Pop-Location
    }
}

# Read coverage % from frontend coverage-summary.json
function Get-FrontendCoverage {
    $summary = Join-Path $FrontendDir 'coverage\coverage-summary.json'
    if (Test-Path $summary) {
        try {
            $json = Get-Content $summary -Raw | ConvertFrom-Json
            $pct = $json.total.lines.pct
            return [string]$pct
        } catch {
            return 'n/a'
        }
    }
    return 'n/a'
}

# Read coverage % from backend coverage.xml (cobertura format)
function Get-BackendCoverage {
    $xml = Join-Path $BackendDir 'coverage.xml'
    if (Test-Path $xml) {
        try {
            [xml]$cov = Get-Content $xml
            $rate = $cov.coverage.'line-rate'
            return ('{0:N1}' -f ([double]$rate * 100))
        } catch {
            return 'n/a'
        }
    }
    return 'n/a'
}

# ===========================================================================
# Banner
# ===========================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  03-run-tests.ps1 - jebejekirdni testekan" -ForegroundColor Cyan
Write-Host "  Full Test Suite" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Log "Starting tests at $Timestamp"
Write-Log "Log: $LogFile"
Write-Host ""

# ===========================================================================
# FRONTEND - Vitest
# ===========================================================================
Write-Host "--- FRONTEND: Vitest ---" -ForegroundColor Magenta
if (Test-Path $FrontendDir) {
    # vitest run (without coverage first - faster signal)
    Run-TestStep -Section 'frontend' -Description 'vitest --run' -Cwd $FrontendDir -Exe 'npm' -Args @('test','--','--run') | Out-Null

    # vitest with coverage (the scorecard needs coverage-summary.json)
    Run-TestStep -Section 'frontend' -Description 'vitest --run --coverage' -Cwd $FrontendDir -Exe 'npm' -Args @('test','--','--run','--coverage') | Out-Null

    # Playwright install (idempotent)
    Write-Host "--- FRONTEND: Playwright install (idempotent) ---" -ForegroundColor Magenta
    Run-TestStep -Section 'frontend' -Description 'playwright install chromium' -Cwd $FrontendDir -Exe 'npx' -Args @('playwright','install','--with-deps','chromium') | Out-Null

    # Playwright smoke - try nav:sweep first, fallback to @smoke tag
    Write-Host "--- FRONTEND: Playwright smoke ---" -ForegroundColor Magenta
    $sweepOK = Run-TestStep -Section 'frontend' -Description 'npm run nav:sweep' -Cwd $FrontendDir -Exe 'npm' -Args @('run','nav:sweep')
    if (-not $sweepOK) {
        Write-Log "nav:sweep failed - trying fallback @smoke" -Level 'WARN'
        Run-TestStep -Section 'frontend' -Description 'playwright test --grep @smoke (fallback)' -Cwd $FrontendDir -Exe 'npx' -Args @('playwright','test','--grep','@smoke') | Out-Null
    }
} else {
    Write-Log "frontend/ not found - skipping frontend tests" -Level 'ERROR'
    $AnyFail = $true
}

# ===========================================================================
# BACKEND - pytest
# ===========================================================================
Write-Host ""
Write-Host "--- BACKEND: pytest ---" -ForegroundColor Magenta
if (Test-Path $BackendDir) {
    $VenvPython = Join-Path $BackendDir 'venv\Scripts\python.exe'
    $VenvPytest = Join-Path $BackendDir 'venv\Scripts\pytest.exe'

    if (-not (Test-Path $VenvPython)) {
        Write-Log "venv not found - run 02-install-and-build.ps1 first" -Level 'ERROR'
        $AnyFail = $true
    } else {
        # pytest with coverage
        Run-TestStep -Section 'backend' -Description 'pytest --cov=app --cov-report=xml --cov-report=term' `
            -Cwd $BackendDir -Exe $VenvPython `
            -Args @('-m','pytest','--cov=app','--cov-report=xml','--cov-report=term') | Out-Null

        # smoke import
        Write-Host "--- BACKEND: smoke import ---" -ForegroundColor Magenta
        Run-TestStep -Section 'backend' -Description 'smoke: from app.main import app' `
            -Cwd $BackendDir -Exe $VenvPython `
            -Args @('-c','from app.main import app; print(f"OK: {len(app.routes)} routes")') | Out-Null
    }
} else {
    Write-Log "backend/ not found - skipping backend tests" -Level 'ERROR'
    $AnyFail = $true
}

# ===========================================================================
# Summary table - kurdi: pukhtey encamekan
# ===========================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Summary / pukhte" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$frontCov = Get-FrontendCoverage
$backCov  = Get-BackendCoverage

$frontPass = ($Results | Where-Object { $_.Section -eq 'frontend' -and $_.Status -eq 'PASS' }).Count
$frontFail = ($Results | Where-Object { $_.Section -eq 'frontend' -and $_.Status -eq 'FAIL' }).Count
$backPass  = ($Results | Where-Object { $_.Section -eq 'backend'  -and $_.Status -eq 'PASS' }).Count
$backFail  = ($Results | Where-Object { $_.Section -eq 'backend'  -and $_.Status -eq 'FAIL' }).Count

"{0,-12} {1,-8} {2,-8} {3,-10} {4}" -f 'Section','Passed','Failed','Skipped','Coverage%' | Write-Host
('-' * 60) | Write-Host
"{0,-12} {1,-8} {2,-8} {3,-10} {4}" -f 'frontend', $frontPass, $frontFail, '-', $frontCov | Write-Host
"{0,-12} {1,-8} {2,-8} {3,-10} {4}" -f 'backend',  $backPass,  $backFail,  '-', $backCov  | Write-Host
Write-Host ""

# Detailed step listing
Write-Host "--- Step details ---" -ForegroundColor Cyan
$Results | ForEach-Object {
    $color = if ($_.Status -eq 'PASS') { 'Green' } else { 'Red' }
    Write-Host ("  [{0}] {1}: {2}" -f $_.Status, $_.Section, $_.Step) -ForegroundColor $color
}
Write-Host ""
Write-Host "Log: $LogFile"
Write-Host ""

if ($AnyFail) {
    Write-Host "[X] hendek test shkti henan - logakan bxwenrawe" -ForegroundColor Red
    Write-Host "Some tests failed - review the log above." -ForegroundColor Red
    exit 1
} else {
    Write-Host "[OK] hamu testekan derbazbun" -ForegroundColor Green
    Write-Host "All tests passed - ready for step 4." -ForegroundColor Green
    Write-Host "Next: .\deploy\04-push-to-github.ps1 -RepoName 'zoho'" -ForegroundColor Cyan
    exit 0
}
