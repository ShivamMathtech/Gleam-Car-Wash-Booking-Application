@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS from https://nodejs.org/ and try again.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0]) < 24) { console.error('Node.js 24 or newer is required.');process.exit(1); }"
if errorlevel 1 (
  pause
  exit /b 1
)
echo Installing frontend development dependencies...
call npm ci --no-audit --no-fund
if errorlevel 1 goto :failed
call npm run build
if errorlevel 1 goto :failed
call npm test
if errorlevel 1 goto :failed
echo Setup complete. Double-click START-WINDOWS.cmd to run Gleam.
pause
exit /b 0
:failed
echo Setup failed. Review the error above and docs/WINDOWS-SETUP.md.
pause
exit /b 1
