@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 24 LTS from https://nodejs.org/
  echo Close and reopen this window after installation.
  pause
  exit /b 1
)
echo Starting Gleam Car Wash...
echo Open http://localhost:4000 in your browser once the server is ready.
echo Keep this window open. Press Ctrl+C to stop.
node scripts/start.mjs
if errorlevel 1 pause
endlocal
