@echo off
chcp 65001 >nul
title Deploy SPACE-04 to GitHub
cls
echo ======================================================================
echo   🛰️ SPACE-04: Automated GitHub Deployment
echo ======================================================================
echo.
echo [1/3] Ensuring all files and bundles are built & committed...
call node scripts/bundle-html.js
call node scripts/git-commit.js
echo.
echo [2/3] Authenticating with GitHub...
echo If you are not logged in, GitHub CLI will open your browser to authorize.
echo.
.\bin\gh.exe auth status 2>nul
if %errorlevel% neq 0 (
    echo Opening browser to authorize GitHub...
    .\bin\gh.exe auth login --web -h github.com -p https
)

echo.
echo [3/3] Creating repository & pushing all files to GitHub...
echo.
.\bin\gh.exe repo create SPACE-04-Autonomous-Ground-Station-Scheduler --public --source=. --remote=origin --push 2>nul
if %errorlevel% neq 0 (
    echo Repository may already exist. Pushing to origin main...
    .\bin\gh.exe repo sync 2>nul || (
        call node scripts/git-push.js
    )
)

echo.
echo ======================================================================
echo 🎉 SUCCESS! Your project is deployed on GitHub!
echo Opening your GitHub repository in your browser...
echo ======================================================================
.\bin\gh.exe browse
pause
