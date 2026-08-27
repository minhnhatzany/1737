@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "NODE_EXE=%~dp0.tools\node-v22.22.2-win-x64\node.exe"
if not exist "%NODE_EXE%" (
  echo [ERROR] Khong tim thay Node portable: "%NODE_EXE%"
  echo Hay bao toi de cai lai Node portable.
  exit /b 1
)

echo [CHECK] Node version:
"%NODE_EXE%" -v
if errorlevel 1 exit /b 1

set "HAS_ERROR=0"
for %%F in (*.js) do (
  echo [CHECK] %%F
  "%NODE_EXE%" --check "%%~fF"
  if errorlevel 1 (
    set "HAS_ERROR=1"
    echo [FAIL] %%F
  )
)

if "%HAS_ERROR%"=="1" (
  echo.
  echo [DONE] Co loi syntax trong mot hoac nhieu file.
  exit /b 1
)

echo.
echo [DONE] Tat ca file .js hop le syntax.
exit /b 0

