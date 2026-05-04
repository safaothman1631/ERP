# RTK Sanity Check for Zoho ERP
# Usage: .\.github\scripts\rtk-verify.ps1
$ErrorActionPreference = 'SilentlyContinue'

$rtk = Get-Command rtk.exe -ErrorAction SilentlyContinue
if (-not $rtk) {
    Write-Host '[RTK] NOT INSTALLED' -ForegroundColor Yellow
    Write-Host 'Install: see .github/scripts/rtk-install.ps1 or download from https://github.com/rtk-ai/rtk/releases'
    exit 1
}

Write-Host "[RTK] Found: $($rtk.Source)" -ForegroundColor Green
& rtk --version
Write-Host '---'
Write-Host '[RTK] Smoke test: rtk git status'
& rtk git status
Write-Host '---'
Write-Host '[RTK] Token savings so far:'
& rtk gain
