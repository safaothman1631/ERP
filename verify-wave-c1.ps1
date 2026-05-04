# Wave C-1 Verification Script
Write-Host "=== Wave C-1 Verification ===" -ForegroundColor Cyan

# Backend route count check
Write-Host "`n1. Backend Route Count Check..." -ForegroundColor Yellow
cd c:\Users\SAFA\zoho\backend
$routeCount = & .\venv\Scripts\python.exe -c "from app.main import app; print(len(app.routes))"
Write-Host "   Total routes: $routeCount" -ForegroundColor Green

# Frontend build check
Write-Host "`n2. Frontend TypeScript Build Check..." -ForegroundColor Yellow
cd c:\Users\SAFA\zoho\frontend
$buildResult = npm run build 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Frontend build completed successfully" -ForegroundColor Green
} else {
    Write-Host "   ✗ Frontend build failed" -ForegroundColor Red
    Write-Host $buildResult
    exit 1
}

Write-Host "`n=== Wave C-1 Verification Complete ===" -ForegroundColor Cyan
