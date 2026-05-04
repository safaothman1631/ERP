# Wave H Verification Script
# Runs all verification steps for Wave H implementation

Write-Host "=== Wave H Verification ===" -ForegroundColor Cyan

# Step 1: Add i18n keys
Write-Host "`n1. Adding i18n keys..." -ForegroundColor Yellow
cd c:\Users\SAFA\zoho\backend
.\venv\Scripts\python.exe _add_wave_h_i18n.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ i18n script failed" -ForegroundColor Red
    exit 1
}

# Step 2: Python syntax check
Write-Host "`n2. Checking Python syntax..." -ForegroundColor Yellow
.\venv\Scripts\python.exe -m py_compile app\api\returns.py app\api\numbering.py app\firestore\returns.py app\firestore\numbering.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Python syntax errors" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Python syntax OK" -ForegroundColor Green

# Step 3: Check route count (baseline ~2009)
Write-Host "`n3. Checking route count..." -ForegroundColor Yellow
$routeCount = & .\venv\Scripts\python.exe -c "from app.main import app; print(len(app.routes))"
Write-Host "  → Total routes: $routeCount" -ForegroundColor Cyan
if ($routeCount -lt 2020) {
    Write-Host "  ! Warning: Expected ~2020+ routes (added ~11 new), got $routeCount" -ForegroundColor Yellow
}

# Step 4: Frontend TypeScript build
Write-Host "`n4. Building frontend (TypeScript strict check)..." -ForegroundColor Yellow
cd c:\Users\SAFA\zoho\frontend
$buildOutput = npm run build 2>&1
$buildExitCode = $LASTEXITCODE
if ($buildExitCode -ne 0) {
    Write-Host "  ✗ Frontend build failed" -ForegroundColor Red
    Write-Host $buildOutput
    exit 1
}
Write-Host "  ✓ Frontend build successful" -ForegroundColor Green

Write-Host "`n=== Wave H Verification Complete ===" -ForegroundColor Green
Write-Host "All checks passed!" -ForegroundColor Green
