@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   Live Session Studio - Server Launcher
echo   Backend:  http://localhost:8002
echo   Frontend: http://localhost:5174
echo ===================================================

cd /d "%~dp0"
set "STUDIO_DIR=%~dp0"
cd ..
set "REPO_ROOT=%CD%"
cd /d "%STUDIO_DIR%"

REM 1. Check if PostgreSQL is running
echo [1/3] Checking PostgreSQL...
tasklist /fi "imagename eq postgres.exe" 2>NUL | find /i "postgres.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo [1/3] PostgreSQL is already running on port 5432.
) else (
    echo [1/3] Starting PostgreSQL on port 5432...
    if exist "%REPO_ROOT%\.local-setup\postgres-data\postmaster.pid" (
        del /f /q "%REPO_ROOT%\.local-setup\postgres-data\postmaster.pid" 2>NUL
    )
    start "PostgreSQL Database" /b "%REPO_ROOT%\.local-setup\tools\postgresql\pgsql\bin\postgres.exe" -D "%REPO_ROOT%\.local-setup\postgres-data" -h 127.0.0.1 -p 5432
    timeout /t 2 /nobreak >NUL
    echo [1/3] PostgreSQL started.
)

REM 2. Start Backend
echo [2/3] Starting Backend (FastAPI on Port 8002)...
start "Live Session Studio - Backend (Port 8002)" cmd /k "cd /d "%STUDIO_DIR%backend" && .venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8002 --reload"

REM 3. Start Frontend
echo [3/3] Starting Frontend (Vite on Port 5174)...
start "Live Session Studio - Frontend (Port 5174)" cmd /k "cd /d "%STUDIO_DIR%frontend" && npm run dev -- --host 127.0.0.1 --port 5174"

echo ===================================================
echo   Servers are launching in separate windows!
echo   Open: http://localhost:5174 in your browser
echo ===================================================
