@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Run SETUP-WINDOWS.cmd first to install the frontend tools.
  pause
  exit /b 1
)
echo Development frontend: http://localhost:4173
echo Do not run START-WINDOWS.cmd at the same time.
call npm run dev
if errorlevel 1 pause
endlocal
