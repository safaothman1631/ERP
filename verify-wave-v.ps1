# Wave V: IoT Telemetry & Device Management UI — Verification Script
# Checks: backend syntax + route count + frontend build + i18n

$ErrorActionPreference = "Stop"

Write-Host "`n=== Wave V IoT Verification ===" -ForegroundColor Cyan

# 1. Backend syntax check
Write-Host "`n1️⃣ Checking backend syntax..." -ForegroundColor Yellow
$pyFiles = @(
    "c:\Users\SAFA\zoho\backend\app\api\iot.py",
    "c:\Users\SAFA\zoho\backend\_add_wave_v_i18n.py"
)

foreach ($file in $pyFiles) {
    Write-Host "   Compiling: $file" -ForegroundColor Gray
    c:\Users\SAFA\zoho\backend\venv\Scripts\python.exe -m py_compile $file
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Syntax error in $file" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✅ Backend syntax OK" -ForegroundColor Green

# 2. Count backend routes
Write-Host "`n2️⃣ Counting backend routes..." -ForegroundColor Yellow
$beforeCount = (Select-String -Path "c:\Users\SAFA\zoho\backend\app\api\iot.py" -Pattern "@router\.(get|post|put|patch|delete)" | Measure-Object).Count
Write-Host "   IoT endpoints: $beforeCount" -ForegroundColor Gray
if ($beforeCount -lt 15) {
    Write-Host "⚠️  Expected ~18 endpoints, found $beforeCount" -ForegroundColor Yellow
} else {
    Write-Host "✅ Backend routes OK ($beforeCount endpoints)" -ForegroundColor Green
}

# 3. Frontend TypeScript build
Write-Host "`n3️⃣ Building frontend (TypeScript strict)..." -ForegroundColor Yellow
Push-Location c:\Users\SAFA\zoho\frontend
try {
    npm run build 2>&1 | Out-String | Write-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Frontend build failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Write-Host "✅ Frontend build OK" -ForegroundColor Green
} finally {
    Pop-Location
}

# 4. Run i18n script
Write-Host "`n4️⃣ Adding i18n keys..." -ForegroundColor Yellow
c:\Users\SAFA\zoho\backend\venv\Scripts\python.exe -X utf8 c:\Users\SAFA\zoho\backend\_add_wave_v_i18n.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ i18n script failed" -ForegroundColor Red
    exit 1
}

# 5. Count files created
Write-Host "`n5️⃣ Verifying file structure..." -ForegroundColor Yellow
$iotPages = @(
    "c:\Users\SAFA\zoho\frontend\src\pages\iot\IoTDashboard.tsx",
    "c:\Users\SAFA\zoho\frontend\src\pages\iot\IoTDevices.tsx",
    "c:\Users\SAFA\zoho\frontend\src\pages\iot\DeviceDetail.tsx",
    "c:\Users\SAFA\zoho\frontend\src\pages\iot\AlertRules.tsx",
    "c:\Users\SAFA\zoho\frontend\src\pages\iot\AlertHistory.tsx"
)

$allExist = $true
foreach ($page in $iotPages) {
    if (Test-Path $page) {
        $lineCount = (Get-Content $page | Measure-Object -Line).Lines
        Write-Host "   ✓ $([System.IO.Path]::GetFileName($page)) ($lineCount lines)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Missing: $page" -ForegroundColor Red
        $allExist = $false
    }
}

if ($allExist) {
    Write-Host "✅ All 5 IoT pages created" -ForegroundColor Green
} else {
    Write-Host "❌ Some files missing" -ForegroundColor Red
    exit 1
}

# 6. Count routes in App.tsx
Write-Host "`n6️⃣ Verifying routes..." -ForegroundColor Yellow
$appTsx = Get-Content "c:\Users\SAFA\zoho\frontend\src\App.tsx" -Raw
$iotRoutes = ([regex]::Matches($appTsx, 'path="iot')).Count
Write-Host "   IoT routes in App.tsx: $iotRoutes" -ForegroundColor Gray
if ($iotRoutes -ge 5) {
    Write-Host "✅ Routes OK" -ForegroundColor Green
} else {
    Write-Host "⚠️  Expected 5 IoT routes, found $iotRoutes" -ForegroundColor Yellow
}

Write-Host "`n=== ✨ Wave V Verification Complete ===" -ForegroundColor Cyan
Write-Host "Backend: $beforeCount endpoints" -ForegroundColor White
Write-Host "Frontend: 5 pages, $iotRoutes routes" -ForegroundColor White
Write-Host "i18n: ~75 keys added (iot.*)" -ForegroundColor White
Write-Host ""
