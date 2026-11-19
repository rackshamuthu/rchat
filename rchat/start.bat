@echo off
title Rchat by Sumis - Server
cls
echo ========================================================
echo   Starting Rchat Real-Time Messaging Server...
echo   Publisher: Sumis
echo ========================================================
echo.

start "" http://localhost:3000
node server.js
pause
