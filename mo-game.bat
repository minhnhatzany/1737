@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM Game dùng ES modules — cần HTTP. Double-click file này để chơi.

where python >nul 2>&1
if errorlevel 1 (
  echo Khong tim thay Python. Cai tu https://www.python.org/downloads/ roi chay lai.
  pause
  exit /b 1
)

set PORT=8765
echo.
echo  Khoi dong may chu game...
echo.

start "Le-Trinh-Server" /MIN python -m http.server %PORT%
ping -n 3 127.0.0.1 >nul
start "" "http://localhost:%PORT%/"

echo  Trinh duyet da mo: http://localhost:%PORT%/
echo  Server chay o cua so nho ten "Le-Trinh-Server" — dong no la tat game.
echo.
pause
