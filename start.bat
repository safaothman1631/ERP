@echo off
chcp 65001 > NUL
setlocal

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "BACKEND_PY=%BACKEND_DIR%\venv\Scripts\python.exe"

echo.
echo  ========================================
echo    سیستەمی ژمێریاری - Development Mode
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:8000
echo  ========================================
echo.

if not exist "%BACKEND_PY%" (
    echo  [X] Python venv نەدۆزرایەوە:
    echo      %BACKEND_PY%
    echo.
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo  [X] Frontend package.json نەدۆزرایەوە:
    echo      %FRONTEND_DIR%\package.json
    echo.
    pause
    exit /b 1
)

echo  [1/2] Starting Backend...
start "Zoho Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && ""%BACKEND_PY%"" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --app-dir ""%BACKEND_DIR%"""

timeout /t 3 /nobreak > NUL

echo  [2/2] Starting Frontend Dev Server...
start "Zoho Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"

echo.
echo  [OK] هەر دوو سێرڤەر دەستپێکران.
echo      Frontend: http://localhost:5173
echo      Backend:  http://localhost:8000
echo      API Docs: http://localhost:8000/docs
echo.
echo  بۆ داخستن، window ـی Backend و Frontend دابخە.
echo.
pause
endlocal