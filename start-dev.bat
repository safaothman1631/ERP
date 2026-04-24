@echo off
chcp 65001 > NUL
echo.
echo  ========================================
echo    سیستەمی ژمێریاری - Development Mode
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:8000
echo  ========================================
echo.

echo  [1/2] Starting Backend...
start "Zoho Backend" cmd /k "cd /d "%~dp0backend" && venv\Scripts\activate && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak > NUL

echo  [2/2] Starting Frontend Dev Server...
start "Zoho Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo  [OK] هەر دوو سێرڤەر ران بوون!
echo      Frontend: http://localhost:5173
echo      Backend:  http://localhost:8000
echo      API Docs: http://localhost:8000/docs
echo.
pause
