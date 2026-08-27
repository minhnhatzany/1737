@echo off
setlocal enabledelayedexpansion

rem ===============================
rem 1737 — RUN LOCAL (Windows .bat)
rem ===============================

set "PORT=5173"
set "ROOT=%~dp0"

cd /d "%ROOT%"

echo.
echo [1737] Starting local server in:
echo   %CD%
echo.
echo If this window is closed, the server stops.
echo.

set "PY_CMD="
where python >nul 2>nul && set "PY_CMD=python"
if not "%PY_CMD%"=="" goto :python_ok
where py >nul 2>nul && set "PY_CMD=py -3"
if not "%PY_CMD%"=="" goto :python_ok
echo [1737] Khong tim thay Python (python/py).
echo [1737] Hay cai Python 3 roi chay lai RUN_GAME.bat
echo.
pause
exit /b 1

:python_ok

echo [1737] Python command: %PY_CMD%

rem Clean up stale servers from previous runs (same port)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'python.exe' -and $_.CommandLine -match 'http\.server %PORT%' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>nul

rem Start server in a new window and keep it visible for diagnostics
start "1737 Local Server" cmd /k "cd /d ""%ROOT%"" && %PY_CMD% -m http.server %PORT% --bind 127.0.0.1"

rem Give server time to boot
ping 127.0.0.1 -n 3 >nul

rem Quick health probe (non-blocking)
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PORT%/index.html' -TimeoutSec 2; if($r.StatusCode -eq 200){ exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
  echo [1737] Warning: server chua phan hoi HTTP 200.
  echo [1737] Kiem tra cua so '1737 Local Server' xem co loi gi khong.
  echo.
)

echo Opening browser at:
echo   http://127.0.0.1:%PORT%/index.html
echo.

set "GAME_URL=http://127.0.0.1:%PORT%/index.html"
set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME_EXE_ALT=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE_EXE_ALT=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if exist "%CHROME_EXE%" (
  echo [1737] Opening with Chrome...
  start "" "%CHROME_EXE%" "%GAME_URL%"
) else if exist "%CHROME_EXE_ALT%" (
  echo [1737] Opening with Chrome...
  start "" "%CHROME_EXE_ALT%" "%GAME_URL%"
) else if exist "%EDGE_EXE%" (
  echo [1737] Chrome not found, opening with Edge...
  start "" "%EDGE_EXE%" "%GAME_URL%"
) else if exist "%EDGE_EXE_ALT%" (
  echo [1737] Chrome not found, opening with Edge...
  start "" "%EDGE_EXE_ALT%" "%GAME_URL%"
) else (
  echo [1737] Chrome/Edge not found, opening with default browser...
  start "" "%GAME_URL%"
)

echo Done. If the page doesn't load:
echo - Make sure the "1737 Local Server" window shows "Serving HTTP on ..."
echo - If it says the port is in use, edit PORT=5173 to another number (e.g. 8080)
echo.
pause

