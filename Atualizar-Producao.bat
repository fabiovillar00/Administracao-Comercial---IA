@echo off
setlocal
title Atualizacao do Pulso Comercial
powershell.exe -NoProfile -File "%~dp0scripts\publish-remote.ps1"
set "pulso_result=%ERRORLEVEL%"
echo.
if not "%pulso_result%"=="0" echo A atualizacao nao foi confirmada. Consulte a mensagem e o log acima.
pause
exit /b %pulso_result%
