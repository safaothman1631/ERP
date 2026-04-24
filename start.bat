@echo off
chcp 65001 > NUL
echo.
echo  ========================================
echo    سیستەمی ژمێریاری - یەک سێرڤەر
echo    Zoho Books - Single Server Mode
echo  ========================================
echo.

echo  [1/2] Building frontend...
cd /d "%~dp0frontend"
call npm run build
if errorlevel 1 (
    echo.
    echo  [X] Frontend build شکستی هێنا!
    echo      تکایە ئیرۆرەکان بخوێنەوە.
    pause
    exit /b 1
)
echo  [OK] Frontend build تەواو بوو.
echo.

echo  [2/2] Starting server on http://localhost:8000
echo  ----------------------------------------
echo   بچۆ: http://localhost:8000
echo   API:  http://localhost:8000/docs
echo  ----------------------------------------
echo.
cd /d "%~dp0backend"
call venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
