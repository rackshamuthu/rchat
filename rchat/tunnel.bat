@echo off
title Rchat Secure Tunnel (No Password Required)
cls
echo ===================================================================
echo   RChat - Cloudflare Direct Tunnel (by Sumis)
echo   NO PASSWORD REQUIRED - NO 500 ERROR
echo ===================================================================
echo.
echo Make sure start.bat is running in another window!
echo Starting Cloudflare tunnel... (takes 5 to 10 seconds)
echo.
echo ===================================================================
echo   Look for the URL ending with: .trycloudflare.com
echo   Example:  https://your-name-here.trycloudflare.com
echo.
echo   COPY THAT HTTPS URL AND PASTE IT INTO PWABUILDER!
echo ===================================================================
echo.

npx -y @cloudflare/cloudflared tunnel --url http://localhost:3000

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Cloudflare encountered an error. Trying backup tunnel (No password)...
    ssh -R 80:localhost:3000 -o StrictHostKeyChecking=no -o UserKnownHostsFile=nul nokey@localhost.run
)

pause
