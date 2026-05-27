# Run prelaunch_smoke 3 times sequentially (avoids prod thundering herd).
param(
    [string]$BaseUrl = "https://zoho-erp-i43i2clqva-ew.a.run.app",
    [string]$Email = "demo-manager@zohoerp.example.com",
    [string]$Password = "Demo@2026"
)
$ErrorActionPreference = "Stop"
$backend = Join-Path (Join-Path $PSScriptRoot "..") "backend"
$fail = 0
1..3 | ForEach-Object {
    $n = $_
    Write-Host "=== smoke run $n/3 ==="
    Push-Location $backend
    try {
        python scripts/prelaunch_smoke.py --base-url $BaseUrl --email $Email --password $Password
        if ($LASTEXITCODE -ne 0) { $fail++ }
    } finally {
        Pop-Location
    }
    if ($n -lt 3) { Start-Sleep -Seconds 90 }
}
if ($fail -gt 0) {
    Write-Host "FAIL: $fail/3 smokes failed"
    exit 1
}
Write-Host "PASS: 3/3 prelaunch_smoke OK"
exit 0
