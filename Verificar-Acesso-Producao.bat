@echo off
setlocal
title Verificar acesso ao servidor do Pulso
powershell.exe -NoProfile -File "%~dp0scripts\publish-remote.ps1" -CheckAccessOnly
set "pulso_result=%ERRORLEVEL%"
echo.
pause
exit /b %pulso_result%
