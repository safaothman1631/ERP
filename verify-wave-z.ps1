# Wave Z: Rental & Repairs — Frontend verification
# Runs i18n script and builds frontend

$ErrorActionPreference = 'Stop'
$root = 'c:\Users\SAFA\zoho'

Write-Host "🌐 Running i18n script..." -ForegroundColor Cyan
& "$root\backend\venv\Scripts\python.exe" "$root\backend\_add_wave_z_i18n.py"
if ($LASTEXITCODE -ne 0) { throw "i18n script failed" }

Write-Host "`n📦 Building frontend..." -ForegroundColor Cyan
cd "$root\frontend"
$buildOutput = npm run build 2>&1
$lastLines = $buildOutput | Select-Object -Last 30

Write-Host $lastLines -ForegroundColor Gray

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Wave Z verification passed!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Build failed" -ForegroundColor Red
    exit 1
}
