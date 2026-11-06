@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar_sigf_intranet.ps1"
if errorlevel 1 (
  echo.
  echo No se pudo iniciar SIGF. Revisar el mensaje anterior.
  pause
)
