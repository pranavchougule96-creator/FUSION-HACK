@echo off
chcp 65001 >nul
title Deploy to Vercel - SPACE-04 Mission Control
cls
echo ======================================================================
echo   🛰️ Deploying SPACE-04 Mission Control Dashboard to Vercel
echo ======================================================================
echo.
echo [1/2] Building production distribution and standalone bundles...
call npm run build
echo.
echo [2/2] Publishing to Vercel Production...
call npx vercel deploy --prod --yes
echo.
echo ======================================================================
echo ✅ Deployment finished! Live URL: https://space04-satellite-scheduler.vercel.app
echo ======================================================================
pause
