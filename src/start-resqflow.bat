@echo off
title ResQFlow Launcher

cd /d "%~dp0"

echo.
echo ==========================================
echo          RESQFLOW LAUNCHER
echo ==========================================
echo.

echo Starting Realtime Server...
start "ResQFlow Realtime Server" powershell -NoExit -Command "Set-Location -LiteralPath '%~dp0'; node .\resqflow-realtime-server.cjs"

timeout /t 3 /nobreak >nul

echo Starting React Dashboard...
start "ResQFlow Dashboard" powershell -NoExit -Command "Set-Location -LiteralPath '%~dp0'; npm run dev -- --host 0.0.0.0"

timeout /t 7 /nobreak >nul

echo Opening Dashboard...
start "" "https://localhost:5173"

echo.
echo ==========================================
echo          RESQFLOW IS RUNNING
echo ==========================================
echo.
echo Realtime Server: http://localhost:3001
echo Dashboard:       https://localhost:5173
echo.
echo Keep both PowerShell windows open.
echo ==========================================
echo.

exit