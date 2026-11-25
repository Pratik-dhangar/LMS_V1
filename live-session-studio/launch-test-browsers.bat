@echo off
setlocal

echo ===================================================
echo   Live Session Studio - Synthetic A/V Browser Launcher
echo   Launches two isolated browser instances with
echo   synthetic camera and microphone test devices.
echo ===================================================

set "CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "URL=http://localhost:5174/login"

set "FLAGS=--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --allow-file-access-from-files"

REM Check if backend is running
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $h = Invoke-RestMethod -Uri 'http://localhost:8002/api/health' -TimeoutSec 2; Write-Host 'Backend is running.' } catch { Write-Host 'Backend is not running. Please run setup-local.bat first.' -ForegroundColor Yellow }"

echo Launching Window 1 (Trainer) in Chrome...
start "" "%CHROME%" %FLAGS% --user-data-dir="%TEMP%\lss_chrome_trainer" "%URL%"

timeout /t 2 /nobreak >nul

if exist "%EDGE%" (
    echo Launching Window 2 (Learner) in Edge...
    start "" "%EDGE%" %FLAGS% --user-data-dir="%TEMP%\lss_edge_learner" "%URL%"
) else (
    echo Launching Window 2 (Learner) in Chrome Profile 2...
    start "" "%CHROME%" %FLAGS% --user-data-dir="%TEMP%\lss_chrome_learner" "%URL%"
)

echo.
echo ===================================================
echo   Both browser windows have been launched!
echo   Window 1: Log in as 'Trainer' -> 'Trainer Demo'
echo   Window 2: Log in as 'Learner' -> 'Learner One'
echo ===================================================
pause
