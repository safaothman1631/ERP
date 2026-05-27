#requires -Version 7.0
<#
.SYNOPSIS
    Post-deploy production smoke test.
    تاقیکردنەوەی بەرهەمهێنان دوای ناردن.

.DESCRIPTION
    Runs production-reality-probe, tests critical paths, checks HTTP/2,
    optionally runs a k6 load test and a Playwright Lighthouse capture.
    Saves a markdown report to deploy/logs/smoke-<ts>.md.

.PARAMETER FrontendUrl
    Vercel URL. URL ی Vercel.

.PARAMETER BackendUrl
    Cloud Run URL. URL ی Cloud Run.
#>
[CmdletBinding()]
param(
    [string]$FrontendUrl,
    [string]$BackendUrl,
    [switch]$SkipLoadTest,
    [switch]$SkipLighthouse
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptRoot
$LogDir     = Join-Path $ScriptRoot 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$Timestamp  = Get-Date -Format 'yyyyMMddTHHmmss'
$LogFile    = Join-Path $LogDir "smoke-$Timestamp.log"
$ReportFile = Join-Path $LogDir "smoke-$Timestamp.md"

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

# Resolve URLs from saved files if not provided
if (-not $FrontendUrl) {
    $f = Join-Path $ScriptRoot 'vercel-url.txt'
    if (Test-Path $f) { $FrontendUrl = (Get-Content $f -Raw).Trim() }
}
if (-not $BackendUrl) {
    $b = Join-Path $ScriptRoot 'cloudrun-url.txt'
    if (Test-Path $b) { $BackendUrl = (Get-Content $b -Raw).Trim() }
}

if (-not $FrontendUrl -or -not $BackendUrl) {
    throw "FrontendUrl and BackendUrl required (or saved in deploy/*-url.txt)."
}

$FrontendUrl = $FrontendUrl.TrimEnd('/')
$BackendUrl  = $BackendUrl.TrimEnd('/')

Write-Banner -En "Production smoke test — start" -Ku "تاقیکردنەوەی بەرهەمهێنان"
Write-Log "Frontend: $FrontendUrl"
Write-Log "Backend : $BackendUrl"

# Results store
$results = [System.Collections.Generic.List[object]]::new()

function Add-Result {
    param(
        [string]$Name,
        [bool]$Pass,
        [string]$Detail,
        [bool]$Critical = $true
    )
    $results.Add([pscustomobject]@{
        Name     = $Name
        Pass     = $Pass
        Detail   = $Detail
        Critical = $Critical
    })
    $icon = if ($Pass) { '[PASS]' } else { '[FAIL]' }
    $color = if ($Pass) { 'Green' } else { 'Red' }
    Write-Host "  $icon $Name — $Detail" -ForegroundColor $color
    Write-Log "$icon $Name — $Detail"
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus = 200,
        [string]$ExpectedSubstring,
        [string]$ExpectedHeader,
        [string]$ExpectedHeaderValue,
        [bool]$Critical = $true
    )
    try {
        $resp = Invoke-WebRequest -Uri $Url -Method Get -UseBasicParsing -TimeoutSec 30 -SkipHttpErrorCheck
        $detail = "HTTP $($resp.StatusCode)"

        $pass = $resp.StatusCode -eq $ExpectedStatus
        if ($pass -and $ExpectedSubstring) {
            if ($resp.Content -notlike "*$ExpectedSubstring*") {
                $pass = $false
                $detail += " (missing '$ExpectedSubstring')"
            }
        }
        if ($pass -and $ExpectedHeader) {
            $hv = $resp.Headers[$ExpectedHeader]
            if (-not $hv) {
                $pass = $false
                $detail += " (missing header $ExpectedHeader)"
            } elseif ($ExpectedHeaderValue -and ($hv -notlike "*$ExpectedHeaderValue*")) {
                $pass = $false
                $detail += " (header $ExpectedHeader='$hv' missing '$ExpectedHeaderValue')"
            }
        }
        Add-Result -Name $Name -Pass $pass -Detail $detail -Critical $Critical
    } catch {
        Add-Result -Name $Name -Pass $false -Detail "Exception: $($_.Exception.Message)" -Critical $Critical
    }
}

# -----------------------------------------------------------------------------
# 1. Backend critical paths
# -----------------------------------------------------------------------------
Write-Banner -En "Backend critical paths" -Ku "ڕێگاکانی باکەند"
Test-Endpoint -Name 'backend /api/health'  -Url "$BackendUrl/api/health"  -ExpectedSubstring 'ok'
Test-Endpoint -Name 'backend /api/version' -Url "$BackendUrl/api/version"
Test-Endpoint -Name 'backend /api/ready'   -Url "$BackendUrl/api/ready"   -ExpectedSubstring 'ready' -Critical $false

# -----------------------------------------------------------------------------
# 2. Frontend critical paths
# -----------------------------------------------------------------------------
Write-Banner -En "Frontend critical paths" -Ku "ڕێگاکانی فڕۆنتئێند"
Test-Endpoint -Name 'frontend /'                  -Url "$FrontendUrl/"                 -ExpectedSubstring 'id="root"'
Test-Endpoint -Name 'frontend /login'             -Url "$FrontendUrl/login"
Test-Endpoint -Name 'frontend /manifest.webmanifest' -Url "$FrontendUrl/manifest.webmanifest"

# Check cache-control immutable on assets — list discovered asset
Write-Log "Probing /assets/* cache header..."
try {
    $homeResp = Invoke-WebRequest -Uri "$FrontendUrl/" -UseBasicParsing -TimeoutSec 30
    if ($homeResp.Content -match '/assets/([^"\s>]+\.(?:js|css))') {
        $assetUrl = "$FrontendUrl/assets/$($matches[1])"
        Test-Endpoint -Name 'frontend asset cache-immutable' `
            -Url $assetUrl `
            -ExpectedHeader 'Cache-Control' `
            -ExpectedHeaderValue 'immutable' `
            -Critical $false
    } else {
        Add-Result -Name 'frontend asset cache-immutable' -Pass $false -Detail "no /assets/* asset found in index.html" -Critical $false
    }
} catch {
    Add-Result -Name 'frontend asset cache-immutable' -Pass $false -Detail "$_" -Critical $false
}

# -----------------------------------------------------------------------------
# 3. HTTP/2 or HTTP/3 active
# -----------------------------------------------------------------------------
Write-Banner -En "HTTP/2 check" -Ku "پشکنینی HTTP/2"
if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    try {
        $curlOut = & curl.exe --http2 -sI -o NUL -w "%{http_version}" $FrontendUrl 2>&1
        $http_version = "$curlOut".Trim()
        Write-Log "HTTP version: $http_version"
        Add-Result -Name 'HTTP/2 or HTTP/3' -Pass ($http_version -like '2*' -or $http_version -like '3*') -Detail "version=$http_version" -Critical $false
    } catch {
        Add-Result -Name 'HTTP/2 or HTTP/3' -Pass $false -Detail "curl failed: $_" -Critical $false
    }
} else {
    Add-Result -Name 'HTTP/2 or HTTP/3' -Pass $false -Detail "curl.exe not found; skipped" -Critical $false
}

# -----------------------------------------------------------------------------
# 4. Production reality probe
# -----------------------------------------------------------------------------
Write-Banner -En "Production reality probe" -Ku "پرۆبی بەرهەمهێنان"
$probeScript = Join-Path $RepoRoot 'scripts\production-reality-probe.mjs'
if (Test-Path $probeScript) {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $env:PROBE_TARGET_URL = $BackendUrl
        $env:PROBE_SAMPLES = '5'
        Push-Location $RepoRoot
        try {
            $probeOut = & node $probeScript 2>&1
            $probeOut | ForEach-Object {
                Add-Content -Path $LogFile -Value $_
                Write-Host $_
            }
            $probePass = ($LASTEXITCODE -eq 0)
            Add-Result -Name 'production-reality-probe' -Pass $probePass -Detail "exit=$LASTEXITCODE" -Critical $false
        } finally {
            Pop-Location
        }
    } else {
        Add-Result -Name 'production-reality-probe' -Pass $false -Detail "node not found" -Critical $false
    }
} else {
    Add-Result -Name 'production-reality-probe' -Pass $false -Detail "script missing" -Critical $false
}

# -----------------------------------------------------------------------------
# 5. k6 load test (optional)
# -----------------------------------------------------------------------------
$p95 = $null
if (-not $SkipLoadTest) {
    Write-Banner -En "k6 load test (30s, 5 VUs)" -Ku "تاقیکردنەوەی بارلێکردن"
    $k6Script = Join-Path $RepoRoot 'load\k6-suite\dashboard.js'
    if ((Get-Command k6 -ErrorAction SilentlyContinue) -and (Test-Path $k6Script)) {
        $env:BASE_URL = $BackendUrl
        try {
            $k6Out = & k6 run --duration 30s --vus 5 $k6Script 2>&1
            $k6Out | ForEach-Object {
                Add-Content -Path $LogFile -Value $_
                Write-Host $_
            }
            # Extract p95 if present
            $p95Line = $k6Out | Where-Object { $_ -match 'p\(95\)' } | Select-Object -First 1
            if ($p95Line -and $p95Line -match 'p\(95\)\s*=\s*([\d.]+)\s*(\w+)') {
                $p95 = "$($matches[1]) $($matches[2])"
            }
            Add-Result -Name 'k6 load test' -Pass ($LASTEXITCODE -eq 0) -Detail "p95=$p95 exit=$LASTEXITCODE" -Critical $false
        } catch {
            Add-Result -Name 'k6 load test' -Pass $false -Detail "$_" -Critical $false
        }
    } else {
        Add-Result -Name 'k6 load test' -Pass $false -Detail "k6 or script missing; skipped" -Critical $false
    }
}

# -----------------------------------------------------------------------------
# 6. Sentry release verification (optional)
# -----------------------------------------------------------------------------
if ($env:SENTRY_AUTH_TOKEN -and $env:SENTRY_ORG_SLUG -and $env:SENTRY_PROJECT_SLUG) {
    Write-Banner -En "Sentry release check" -Ku "پشکنینی Sentry"
    try {
        $headers = @{ Authorization = "Bearer $($env:SENTRY_AUTH_TOKEN)" }
        $releasesUrl = "https://sentry.io/api/0/projects/$($env:SENTRY_ORG_SLUG)/$($env:SENTRY_PROJECT_SLUG)/releases/?per_page=1"
        $rel = Invoke-RestMethod -Uri $releasesUrl -Headers $headers -TimeoutSec 30
        $latest = if ($rel.Count -gt 0) { $rel[0].version } else { '' }
        Add-Result -Name 'Sentry release tagged' -Pass ($null -ne $latest -and $latest -ne '') -Detail "latest=$latest" -Critical $false
    } catch {
        Add-Result -Name 'Sentry release tagged' -Pass $false -Detail "$_" -Critical $false
    }
}

# -----------------------------------------------------------------------------
# 7. Lighthouse (optional, via Playwright if installed)
# -----------------------------------------------------------------------------
$lighthouseScore = $null
if (-not $SkipLighthouse) {
    Write-Banner -En "Lighthouse landing page" -Ku "Lighthouse"
    if (Get-Command lighthouse -ErrorAction SilentlyContinue) {
        try {
            $lhJson = Join-Path $LogDir "lighthouse-$Timestamp.json"
            & lighthouse $FrontendUrl --output=json --output-path=$lhJson --quiet --chrome-flags="--headless=new" 2>&1 |
                Tee-Object -FilePath $LogFile -Append | Out-Null
            if (Test-Path $lhJson) {
                $lh = Get-Content $lhJson -Raw | ConvertFrom-Json
                $perf = [int]($lh.categories.performance.score * 100)
                $lighthouseScore = $perf
                Add-Result -Name 'Lighthouse perf score' -Pass ($perf -ge 80) -Detail "score=$perf" -Critical $false
            }
        } catch {
            Add-Result -Name 'Lighthouse perf score' -Pass $false -Detail "$_" -Critical $false
        }
    } else {
        Add-Result -Name 'Lighthouse perf score' -Pass $false -Detail "lighthouse CLI not installed; skipped" -Critical $false
    }
}

# -----------------------------------------------------------------------------
# Report
# -----------------------------------------------------------------------------
Write-Banner -En "Summary" -Ku "کۆتایی"

$passCount = ($results | Where-Object { $_.Pass }).Count
$failCount = ($results | Where-Object { -not $_.Pass }).Count
$criticalFails = ($results | Where-Object { -not $_.Pass -and $_.Critical }).Count

Write-Host ""
Write-Host "  Total : $($results.Count)" -ForegroundColor White
Write-Host "  Passed: $passCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor Red
Write-Host "  Critical failures: $criticalFails" -ForegroundColor (if ($criticalFails -gt 0) {'Red'} else {'Green'})
Write-Host ""
Write-Host "  Frontend: $FrontendUrl" -ForegroundColor Cyan
Write-Host "  Backend : $BackendUrl" -ForegroundColor Cyan
Write-Host ""

# Markdown report
$md = @()
$md += "# Production Smoke Test — $Timestamp"
$md += ""
$md += "**Frontend:** $FrontendUrl"
$md += "**Backend :** $BackendUrl"
$md += ""
$md += "## Results"
$md += ""
$md += "| Check | Pass | Critical | Detail |"
$md += "|-------|------|----------|--------|"
foreach ($r in $results) {
    $passStr = if ($r.Pass) { 'PASS' } else { 'FAIL' }
    $critStr = if ($r.Critical) { 'yes' } else { 'no' }
    $md += "| $($r.Name) | $passStr | $critStr | $($r.Detail) |"
}
$md += ""
$md += "## Summary"
$md += ""
$md += "- Total checks: $($results.Count)"
$md += "- Passed: $passCount"
$md += "- Failed: $failCount"
$md += "- Critical failures: $criticalFails"
if ($p95) { $md += "- k6 p95: $p95" }
if ($lighthouseScore) { $md += "- Lighthouse perf score: $lighthouseScore" }
$md += ""
$md += "_Generated: $(Get-Date -Format 'o')_"

Set-Content -Path $ReportFile -Value ($md -join "`n") -Encoding UTF8
Write-Log "Report saved: $ReportFile"
Write-Host "  Report: $ReportFile" -ForegroundColor Gray
Write-Host "  Log   : $LogFile" -ForegroundColor Gray
Write-Host ""

if ($criticalFails -gt 0) {
    Write-Host "  ✗ EN: Smoke test FAILED — $criticalFails critical issue(s)." -ForegroundColor Red
    Write-Host "  ✗ KU: تاقیکردنەوە سەرکەوتوو نەبوو — $criticalFails کێشەی گرنگ." -ForegroundColor Red
    exit 1
} else {
    Write-Host "  ✔ EN: Smoke test PASSED." -ForegroundColor Green
    Write-Host "  ✔ KU: تاقیکردنەوە سەرکەوتوو بوو." -ForegroundColor Green
    exit 0
}
