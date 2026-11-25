@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   Live Session Studio - Standalone Setup ^& Launch
echo   Frontend: http://localhost:5174
echo   Backend:  http://localhost:8002
echo ===================================================

cd /d "%~dp0"

REM Step 1: Ensure PostgreSQL is running and DB is initialized
echo [1/4] Ensuring PostgreSQL is running...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$repoRoot = (Get-Item '%~dp0..').FullName; " ^
  "$pgbin = Join-Path $repoRoot '.local-setup\tools\postgresql\pgsql\bin'; " ^
  "$dataDir = Join-Path $repoRoot '.local-setup\postgres-data'; " ^
  "$stateDir = Join-Path $repoRoot '.local-setup'; " ^
  "$pgRunning = Get-Process -Name postgres -ErrorAction SilentlyContinue; " ^
  "if (-not $pgRunning) { " ^
  "  $pidFile = Join-Path $dataDir 'postmaster.pid'; " ^
  "  if (Test-Path $pidFile) { Remove-Item $pidFile -Force }; " ^
  "  Start-Process -FilePath (Join-Path $pgbin 'postgres.exe') -ArgumentList ('-D', $dataDir, '-h', '127.0.0.1', '-p', '5432') -WindowStyle Hidden; " ^
  "  Start-Sleep -Seconds 3; " ^
  "} " ^
  "$env:PGPASSWORD = 'f6c03e1ea0165efa17e1a3f89b5d4f886d33db985eb53c48'; " ^
  "$userExists = & (Join-Path $pgbin 'psql.exe') -h 127.0.0.1 -p 5432 -U lms_local -d hurshbintech_pwa -tAc \"SELECT 1 FROM pg_roles WHERE rolname='lss_user'\"; " ^
  "if ($userExists -ne '1') { & (Join-Path $pgbin 'psql.exe') -h 127.0.0.1 -p 5432 -U lms_local -d hurshbintech_pwa -c \"CREATE USER lss_user WITH PASSWORD 'lss_local_pass';\" }; " ^
  "$dbExists = & (Join-Path $pgbin 'psql.exe') -h 127.0.0.1 -p 5432 -U lms_local -d hurshbintech_pwa -tAc \"SELECT 1 FROM pg_database WHERE datname='live_session_studio'\"; " ^
  "if ($dbExists -ne '1') { & (Join-Path $pgbin 'psql.exe') -h 127.0.0.1 -p 5432 -U lms_local -d hurshbintech_pwa -c \"CREATE DATABASE live_session_studio OWNER lss_user;\" }; " ^
  "& (Join-Path $pgbin 'psql.exe') -h 127.0.0.1 -p 5432 -U lms_local -d live_session_studio -c \"GRANT ALL ON SCHEMA public TO lss_user;\""

REM Step 2: Backend Python venv and migrations
echo [2/4] Setting up backend environment and running migrations...
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (
    echo Creating Python virtual environment...
    python -m venv .venv
    .venv\Scripts\python.exe -m pip install -r requirements.txt
)
.venv\Scripts\alembic.exe upgrade head

REM Step 3: Frontend setup
echo [3/4] Checking frontend dependencies...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo Installing npm dependencies...
    call npm install
)

REM Step 4: Launch backend and frontend
echo [4/4] Starting Live Session Studio...
echo Starting Backend on http://localhost:8002...
start "Live Session Studio Backend (Port 8002)" /d "%~dp0backend" .venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8002 --reload

echo Starting Frontend on http://localhost:5174...
start "Live Session Studio Frontend (Port 5174)" /d "%~dp0frontend" npm run dev

echo ===================================================
echo   Live Session Studio is running!
echo   Open: http://localhost:5174 in your browser
echo ===================================================
pause
