@echo off
chcp 65001 >nul
title Push SPACE-04 to GitHub
cls
echo ======================================================================
echo   🛰️ SPACE-04: Push Mission Control Dashboard to GitHub
echo ======================================================================
echo.
echo 1. Ensuring project is built and committed...
call node scripts/bundle-html.js
call node scripts/git-commit.js
echo.
echo 2. Pushing to GitHub...
call node scripts/git-push.js
echo.
pause
