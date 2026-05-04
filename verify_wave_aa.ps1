cd c:\Users\SAFA\zoho\backend
$env:SCHEDULER_ENABLED='false'
.\venv\Scripts\python.exe -X utf8 _add_wave_aa_i18n.py
if ($LASTEXITCODE -ne 0) {
    Write-Error "i18n script failed"
    exit 1
}

Write-Host "`n=== Verifying backend routes ===" -ForegroundColor Cyan
.\venv\Scripts\python.exe -X utf8 -c "from app.main import app; print('✅ Backend routes:', len(app.routes))"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend verification failed"
    exit 1
}

Write-Host "`n=== Building frontend ===" -ForegroundColor Cyan
cd c:\Users\SAFA\zoho\frontend
npm run build 2>&1 | Select-Object -Last 30
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed"
    exit 1
}

Write-Host "`n✅ Sprint 5 Wave AA verification complete!" -ForegroundColor Green
