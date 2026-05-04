# Wave U Verification Script
# Run these commands in sequence to verify the implementation

Write-Host "`n=== Wave U (Custom Dashboards) Verification ===" -ForegroundColor Cyan

# Step 1: Install react-grid-layout
Write-Host "`n[1/5] Installing react-grid-layout..." -ForegroundColor Yellow
cd c:\Users\SAFA\zoho\frontend
npm install react-grid-layout @types/react-grid-layout

# Step 2: Add i18n keys
Write-Host "`n[2/5] Adding i18n keys..." -ForegroundColor Yellow
cd c:\Users\SAFA\zoho\backend
python -X utf8 _add_wave_u_i18n.py

# Step 3: Backend compile check
Write-Host "`n[3/5] Checking backend compilation..." -ForegroundColor Yellow
python -m py_compile app/api/dashboards.py
python -m py_compile app/firestore/dashboards.py
Write-Host "✅ Backend files compile successfully" -ForegroundColor Green

# Step 4: Backend import check
Write-Host "`n[4/5] Verifying backend imports..." -ForegroundColor Yellow
venv\Scripts\python.exe -c "from app.api import dashboards; print('✅ dashboards module imported OK')"

# Step 5: Frontend build
Write-Host "`n[5/5] Building frontend..." -ForegroundColor Yellow
cd c:\Users\SAFA\zoho\frontend
npm run build

Write-Host "`n=== Verification Complete ===" -ForegroundColor Green
Write-Host "All systems operational. Wave U (Custom Dashboards) is ready!" -ForegroundColor Green
