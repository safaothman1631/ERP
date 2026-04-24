# Zoho ERP — backend launcher (Windows / PowerShell 5.1)
# هەمیشە absolute path بەکار دەهێنێت. لە هەر ڕێڕەوێکەوە کاردەکات.

$ErrorActionPreference = 'Stop'
$root   = 'c:\Users\SAFA\zoho\backend'
$python = Join-Path $root 'venv\Scripts\python.exe'

if (-not (Test-Path $python)) {
    Write-Host "❌ Python venv not found at: $python" -ForegroundColor Red
    exit 1
}

# Free port 8000 if a stale process is holding it
$port = 8000
$inUse = netstat -ano | Select-String ":$port\s+.*LISTENING"
if ($inUse) {
    Write-Host "ℹ  Port $port already in use — killing stale process..." -ForegroundColor Yellow
    foreach ($line in $inUse) {
        $procId = ($line.ToString() -split '\s+')[-1]
        try { Stop-Process -Id $procId -Force -ErrorAction Stop; Write-Host "   killed PID $procId" } catch {}
    }
    Start-Sleep -Milliseconds 500
}

Write-Host "🚀 Starting Zoho ERP backend on http://localhost:$port" -ForegroundColor Green
& $python -m uvicorn app.main:app --port $port --log-level warning --app-dir $root
