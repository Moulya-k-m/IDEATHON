@echo off
title ResQFlow Launcher

cd /d "%~dp0"

echo.
echo ==========================================
echo        RESQFLOW STARTING...
echo ==========================================
echo.

echo [1/3] Starting Realtime Server...
start "ResQFlow Realtime Server" cmd /k "cd /d "%~dp0" && node resqflow-realtime-server.cjs"

timeout /t 2 /nobreak >nul

echo [2/3] Starting React Dashboard...
start "ResQFlow Dashboard" cmd /k "cd /d "%~dp0" && npm run dev"

timeout /t 6 /nobreak >nul

echo [3/3] Opening ResQFlow...
start "" "https://localhost:5173"

echo.
echo ==========================================
echo       RESQFLOW IS RUNNING
echo ==========================================
echo.
echo Dashboard: https://localhost:5173
echo.
echo Do NOT close the two terminal windows.
echo ==========================================
echo.

exit