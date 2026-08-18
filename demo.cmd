@echo off
REM Windows launcher: avoids PowerShell Restricted policy blocking npm.ps1
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-demo.ps1"
exit /b %ERRORLEVEL%
