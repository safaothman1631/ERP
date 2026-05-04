# Wave 8.C Verification Script
# Usage: .\verify_wave_8c.ps1

Write-Host "=== Wave 8.C: Premium UX Features Verification ===" -ForegroundColor Cyan

# Step 1: Run i18n script
Write-Host "`n[1/2] Running i18n script..." -ForegroundColor Yellow
c:\Users\SAFA\zoho\backend\venv\Scripts\python.exe -X utf8 c:\Users\SAFA\zoho\backend\_add_wave_8c_i18n.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ i18n script failed" -ForegroundColor Red
    exit 1
}

# Step 2: Frontend build
Write-Host "`n[2/2] Running frontend build..." -ForegroundColor Yellow
Set-Location c:\Users\SAFA\zoho\frontend
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Wave 8.C verification complete!" -ForegroundColor Green
Write-Host "Components created: PrintView.tsx, QuickSearch.tsx" -ForegroundColor Green
Write-Host "Component updated: ExportMenu.tsx" -ForegroundColor Green
Write-Host "Exports added to: design-system/index.ts" -ForegroundColor Green
Write-Host "QuickSearch mounted in: layouts/AppShell.tsx" -ForegroundColor Green
