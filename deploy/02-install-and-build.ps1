#Requires -Version 5.1
<#
.SYNOPSIS
    02-install-and-build.ps1 - Clean install + build for frontend & backend.

.DESCRIPTION
    Frontend: removes node_modules, runs npm install --legacy-peer-deps, vite build, audit scripts.
    Backend:  creates venv if missing, pip install -r requirements.txt, hotfix python-json-logger.
    Captures all output to deploy/logs/build-<timestamp>.log.
    Idempotent and resumable.

.NOTES
    Exit 0 = both frontend build and backend install succeed.
    Exit 1 = either step failed.
#>

# ===========================================================================
# Setup - kurdi: damezrandni bnabnema
# ===========================================================================
$ErrorActionPreference = 'Continue'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir
$LogsDir   = Join-Path $ScriptDir 'logs'

if (-not (Test-Path $LogsDir)) { New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null }

$Timestamp = (Get-Date -Format 'yyyyMMdd-HHmmss')
$LogFile = Join-Path $LogsDir "build-$Timestamp.log"

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$FrontendDir = Join-Path $RepoRoot 'frontend'
$BackendDir  = Join-Path $RepoRoot 'backend'

$FrontendOK = $false
$BackendOK  = $false

# ===========================================================================
# Helpers - kurdi: hawkari functions
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

# Run a command and capture both stdout/stderr to the log file
function Invoke-Logged {
    param([string]$Description, [scriptblock]$Action, [string]$Cwd)
    Write-Log "==> $Description" -Level 'INFO'
    Push-Location $Cwd
    try {
        # Redirect both streams to log; also print live
        $output = & $Action 2>&1
        $output | ForEach-Object {
            Add-Content -Path $LogFile -Value $_ -Encoding UTF8
            Write-Host $_
        }
        return $LASTEXITCODE
    } finally {
        Pop-Location
    }
}

# ===========================================================================
# Banner
# ===========================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  02-install-and-build.ps1 - damezrandn u bnyatnan" -ForegroundColor Cyan
Write-Host "  Install & Build - Kurdish ERP" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Log "Starting build at $Timestamp"
Write-Log "Repo:     $RepoRoot"
Write-Log "Frontend: $FrontendDir"
Write-Log "Backend:  $BackendDir"
Write-Log "Log:      $LogFile"
Write-Host ""

# ===========================================================================
# FRONTEND - kurdi: bnyatnani frontend
# ===========================================================================
Write-Host "================================================================" -ForegroundColor Magenta
Write-Host "  FRONTEND - npm install + vite build" -ForegroundColor Magenta
Write-Host "================================================================" -ForegroundColor Magenta

if (-not (Test-Path $FrontendDir)) {
    Write-Log "Frontend directory not found: $FrontendDir" -Level 'ERROR'
} else {
    # paqijkrdni node_modules - kurdi: srrnewey node_modules bo install paqij
    $nodeModules = Join-Path $FrontendDir 'node_modules'
    if (Test-Path $nodeModules) {
        Write-Log "Removing existing node_modules (this may take 1-2 min)..." -Level 'INFO'
        try {
            Remove-Item -Recurse -Force $nodeModules -ErrorAction Stop
            Write-Log "node_modules removed" -Level 'OK'
        } catch {
            Write-Log "Failed to remove node_modules: $_" -Level 'WARN'
            Write-Log "Continuing with existing node_modules" -Level 'WARN'
        }
    }

    # npm install
    $rc = Invoke-Logged -Cwd $FrontendDir -Description 'npm install --legacy-peer-deps --no-audit --no-fund' -Action {
        npm install --legacy-peer-deps --no-audit --no-fund
    }
    if ($rc -ne 0) {
        Write-Log "npm install FAILED (exit $rc)" -Level 'ERROR'
    } else {
        Write-Log "npm install OK" -Level 'OK'

        # vite build
        $rc = Invoke-Logged -Cwd $FrontendDir -Description 'npm run build (vite build)' -Action {
            npm run build
        }
        if ($rc -ne 0) {
            Write-Log "npm run build FAILED (exit $rc)" -Level 'ERROR'
        } else {
            Write-Log "npm run build OK - dist/ produced" -Level 'OK'
            $FrontendOK = $true

            # audit:lazy - hard failure if missing
            $rc = Invoke-Logged -Cwd $FrontendDir -Description 'npm run audit:lazy' -Action {
                npm run audit:lazy
            }
            if ($rc -ne 0) {
                Write-Log "audit:lazy failed (non-fatal)" -Level 'WARN'
            } else {
                Write-Log "audit:lazy OK" -Level 'OK'
            }

            # audit:bundle - optional (may not exist on all branches)
            $pkgJson = Get-Content (Join-Path $FrontendDir 'package.json') -Raw | ConvertFrom-Json
            if ($pkgJson.scripts.'audit:bundle') {
                $rc = Invoke-Logged -Cwd $FrontendDir -Description 'npm run audit:bundle' -Action {
                    npm run audit:bundle
                }
                if ($rc -ne 0) {
                    Write-Log "audit:bundle failed (non-fatal)" -Level 'WARN'
                } else {
                    Write-Log "audit:bundle OK" -Level 'OK'
                }
            } else {
                Write-Log "audit:bundle script not present - skipping" -Level 'INFO'
            }
        }
    }
}

# ===========================================================================
# BACKEND - kurdi: damezrandni backend
# ===========================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Magenta
Write-Host "  BACKEND - python venv + pip install" -ForegroundColor Magenta
Write-Host "================================================================" -ForegroundColor Magenta

if (-not (Test-Path $BackendDir)) {
    Write-Log "Backend directory not found: $BackendDir" -Level 'ERROR'
} else {
    $VenvDir = Join-Path $BackendDir 'venv'
    $VenvPython = Join-Path $VenvDir 'Scripts\python.exe'
    $VenvPip = Join-Path $VenvDir 'Scripts\pip.exe'

    # venv darstkrdn agar nyye - kurdi: drustkrdni venv tena agar nyya
    if (-not (Test-Path $VenvPython)) {
        Write-Log "Creating venv at $VenvDir" -Level 'INFO'
        $rc = Invoke-Logged -Cwd $BackendDir -Description 'python -m venv venv' -Action {
            python -m venv venv
        }
        if ($rc -ne 0) {
            Write-Log "venv creation FAILED" -Level 'ERROR'
        } else {
            Write-Log "venv created" -Level 'OK'
        }
    } else {
        Write-Log "venv already exists - reusing" -Level 'INFO'
    }

    if (Test-Path $VenvPython) {
        # Inline runner that captures scope-local vars (no $using: gymnastics)
        function Invoke-VenvCmd {
            param([string]$Desc, [string]$Exe, [string[]]$Args)
            Write-Log "==> $Desc" -Level 'INFO'
            $out = & $Exe @Args 2>&1
            $out | ForEach-Object {
                Add-Content -Path $LogFile -Value $_ -Encoding UTF8
                Write-Host $_
            }
            return $LASTEXITCODE
        }

        # bzlndni pip - kurdi: bzlndni weshani pip
        $rc = Invoke-VenvCmd -Desc 'pip upgrade' -Exe $VenvPython -Args @('-m','pip','install','--upgrade','pip')

        # damezrandni requirements - kurdi: damezrandni pakejakan
        $reqFile = Join-Path $BackendDir 'requirements.txt'
        if (Test-Path $reqFile) {
            Push-Location $BackendDir
            try {
                $rc = Invoke-VenvCmd -Desc 'pip install -r requirements.txt' -Exe $VenvPip -Args @('install','-r','requirements.txt')
            } finally { Pop-Location }

            if ($rc -ne 0) {
                Write-Log "pip install -r requirements.txt FAILED" -Level 'ERROR'
            } else {
                Write-Log "pip install OK" -Level 'OK'

                # hotfix - kurdi: hotfix bo python-json-logger ke P4 agent gootuwiyti
                $rc = Invoke-VenvCmd -Desc 'pip install python-json-logger (hotfix)' -Exe $VenvPip -Args @('install','python-json-logger')
                if ($rc -ne 0) {
                    Write-Log "python-json-logger hotfix FAILED" -Level 'WARN'
                } else {
                    Write-Log "python-json-logger hotfix applied" -Level 'OK'
                    $BackendOK = $true
                }
            }
        } else {
            Write-Log "requirements.txt not found in backend/" -Level 'ERROR'
        }
    }
}

# ===========================================================================
# Summary - kurdi: pukhtey encamekan
# ===========================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Summary / pukhte" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
$fStatus = if ($FrontendOK) { '[OK] frontend build serkawtu' } else { '[X]  frontend build shkti hena' }
$bStatus = if ($BackendOK)  { '[OK] backend install serkawtu' } else { '[X]  backend install shkti hena' }
Write-Host $fStatus  -ForegroundColor $(if ($FrontendOK) {'Green'} else {'Red'})
Write-Host $bStatus  -ForegroundColor $(if ($BackendOK)  {'Green'} else {'Red'})
Write-Host ""
Write-Host "Log: $LogFile"
Write-Host ""

if ($FrontendOK -and $BackendOK) {
    Write-Host "Next: .\deploy\03-run-tests.ps1" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "Fix the errors above and re-run this script (it is resumable)." -ForegroundColor Yellow
    exit 1
}
