@echo off
setlocal DisableDelayedExpansion
REM Native Windows setup. Docker is not used.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\local\setup.ps1" %*
set "SETUP_EXIT=%ERRORLEVEL%"
if not "%SETUP_EXIT%"=="0" echo Local setup did not finish. Read the error above and rerun this file.
if "%~1"=="" pause
exit /b %SETUP_EXIT%
