# Wave AB Verification Script
# Run from c:\Users\SAFA\zoho

Write-Host "=== Wave AB: AI Assist Verification ===" -ForegroundColor Cyan

# 1. Run i18n script
Write-Host "`n1. Adding i18n keys..." -ForegroundColor Yellow
c:\Users\SAFA\zoho\backend\venv\Scripts\python.exe c:\Users\SAFA\zoho\backend\_add_wave_ab_i18n.py

# 2. TypeScript check
Write-Host "`n2. Running TypeScript compilation..." -ForegroundColor Yellow
cd c:\Users\SAFA\zoho\frontend
npm run build 2>&1 | Select-Object -Last 30

Write-Host "`n=== Verification Complete ===" -ForegroundColor Green
Write-Host "If build succeeded, AI Assist is ready!" -ForegroundColor Green
Write-Host "`nNew routes:" -ForegroundColor Cyan
Write-Host "  /ai              - AI Dashboard" -ForegroundColor White
Write-Host "  /ai/anomalies    - Anomalies List" -ForegroundColor White
Write-Host "  /ai/suggestions  - Suggestions Inbox" -ForegroundColor White
Write-Host "  /ai/ocr          - Advanced OCR Receipts" -ForegroundColor White
Write-Host "  /ai/predictions  - Predictions Explorer" -ForegroundColor White
