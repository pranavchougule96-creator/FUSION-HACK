@echo off
chcp 65001 >nul
title SPACE-04 Mission Control Dashboard
cls
echo ======================================================================
echo   🛰️ SPACE-04: Autonomous Ground Station Scheduling Dashboard
echo   Planet Labs Multi-Satellite Downlink Mission Control
echo ======================================================================
echo.
echo [1/2] Opening dashboard in your default web browser...
start "" "%~dp0index.html"
echo.
echo [2/2] Launching local high-performance server at http://localhost:5173 ...
echo.
echo (Keep this window open while using the dashboard, or close when done)
echo ======================================================================
echo.

npx vite --port 5173 --host
pause
