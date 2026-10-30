@echo off
rem INCI CARD - Installation d'un kit terrain (double-clic)
rem A utiliser UNIQUEMENT sur le PC terrain : la base de ce PC sera remplacee.
powershell -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0scripts\installer-kit-terrain.ps1"
echo.
pause
