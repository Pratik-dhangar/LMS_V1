# Live Session Studio - PowerShell Startup Script
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Starting Live Session Studio Servers" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:8002" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:5174" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$studioDir = $PSScriptRoot
$repoRoot = (Get-Item -LiteralPath $PSScriptRoot).Parent.FullName

# 1. Start PostgreSQL if not running
$pg = Get-Process -Name postgres -ErrorAction SilentlyContinue
if (-not $pg) {
    Write-Host "[1/3] Starting PostgreSQL on port 5432..." -ForegroundColor Yellow
    $dataDir = Join-Path $repoRoot ".local-setup\postgres-data"
    $pidFile = Join-Path $dataDir "postmaster.pid"
    if (Test-Path -LiteralPath $pidFile) {
        Remove-Item -LiteralPath $pidFile -Force
    }
    $pgExe = Join-Path $repoRoot ".local-setup\tools\postgresql\pgsql\bin\postgres.exe"
    Start-Process -FilePath $pgExe -ArgumentList @("-D", $dataDir, "-h", "127.0.0.1", "-p", "5432") -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Write-Host "PostgreSQL started." -ForegroundColor Green
} else {
    Write-Host "[1/3] PostgreSQL is already running." -ForegroundColor Green
}

# 2. Start Backend in a new window
Write-Host "[2/3] Starting Backend (Port 8002)..." -ForegroundColor Yellow
$backendDir = Join-Path $studioDir "backend"
$uvicornExe = Join-Path $backendDir ".venv\Scripts\uvicorn.exe"
Start-Process -FilePath "cmd.exe" -ArgumentList @("/k", "cd /d `"$backendDir`" && `"$uvicornExe`" main:app --host 127.0.0.1 --port 8002 --reload")

# 3. Start Frontend in a new window
Write-Host "[3/3] Starting Frontend (Port 5174)..." -ForegroundColor Yellow
$frontendDir = Join-Path $studioDir "frontend"
Start-Process -FilePath "cmd.exe" -ArgumentList @("/k", "cd /d `"$frontendDir`" && npm run dev -- --host 127.0.0.1 --port 5174")

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  All servers are starting up!" -ForegroundColor Green
Write-Host "  Open: http://localhost:5174 in your browser" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
