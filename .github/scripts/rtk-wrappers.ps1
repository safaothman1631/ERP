# RTK PowerShell Wrappers for Zoho ERP
# Usage: . c:\Users\SAFA\zoho\.github\scripts\rtk-wrappers.ps1
# OR add to $PROFILE for global use
#
# All wrappers gracefully fall back to raw commands if rtk is not in PATH.

$script:RtkAvailable = $null -ne (Get-Command rtk.exe -ErrorAction SilentlyContinue)

function Invoke-Rtk {
    param([Parameter(Mandatory=$true)][string]$Cmd, [string[]]$RtkArgs)
    if ($script:RtkAvailable) {
        & rtk $Cmd @RtkArgs
    } else {
        & $Cmd @RtkArgs
    }
}

# --- Git / GitHub ---
function rtkgit  { Invoke-Rtk 'git'  $args }
function rtkgh   { Invoke-Rtk 'gh'   $args }

# --- Node / Frontend ---
function rtknpm   { Invoke-Rtk 'npm'    $args }
function rtkpnpm  { Invoke-Rtk 'pnpm'   $args }
function rtktsc   { Invoke-Rtk 'npx'    @('tsc', '--noEmit') }
function rtkeslint{ Invoke-Rtk 'npx'    @('eslint') + $args }

# --- Python / Backend ---
$script:ZohoPy   = 'c:\Users\SAFA\zoho\backend\venv\Scripts\python.exe'
$script:ZohoTest = 'c:\Users\SAFA\zoho\backend\test_all.py'

function rtkpytest {
    if ($script:RtkAvailable) { & rtk $script:ZohoPy '-m' 'pytest' @args }
    else                       { & $script:ZohoPy '-m' 'pytest' @args }
}

function rtktestall {
    if ($script:RtkAvailable) { & rtk $script:ZohoPy $script:ZohoTest @args }
    else                       { & $script:ZohoPy $script:ZohoTest @args }
}

# --- Frontend full build (catches errors that tsc --noEmit misses) ---
function rtkbuild {
    Push-Location 'c:\Users\SAFA\zoho\frontend'
    try {
        if ($script:RtkAvailable) { & rtk npm run build }
        else                       { & npm run build }
    } finally {
        Pop-Location
    }
}

# --- Backend dev server (NEVER wrap with rtk - long running) ---
function rtkbackend {
    $params = @('-m','uvicorn','app.main:app','--port','8000','--log-level','warning','--app-dir','c:\Users\SAFA\zoho\backend')
    & $script:ZohoPy @params
}

# --- Reporting ---
function rtkgain {
    if ($script:RtkAvailable) { & rtk gain @args }
    else { Write-Host '[RTK] not installed' -ForegroundColor Yellow }
}

function rtkdiscover {
    if ($script:RtkAvailable) { & rtk discover @args }
    else { Write-Host '[RTK] not installed' -ForegroundColor Yellow }
}

if ($script:RtkAvailable) {
    Write-Host '[RTK] Wrappers loaded. Available: rtkgit, rtkgh, rtknpm, rtkpnpm, rtktsc, rtkeslint, rtkpytest, rtktestall, rtkbuild, rtkbackend, rtkgain, rtkdiscover' -ForegroundColor Green
} else {
    Write-Host '[RTK] Not in PATH. Wrappers will pass-through to raw commands.' -ForegroundColor Yellow
}
