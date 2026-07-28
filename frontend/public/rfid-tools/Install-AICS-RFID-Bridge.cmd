@echo off
setlocal EnableExtensions
color 0A
title AICS RFID Reader Setup

set "SERVER_URL=http://172.22.50.12:8081"
set "INSTALL_DIR=%ProgramData%\AICS-RFID-Bridge"

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Requesting Administrator permission...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath $env:ComSpec -ArgumentList '/c','""%~f0""' -Verb RunAs"
  exit /b
)

echo.
echo =====================================================
echo       AICS ACS RFID READER INSTALLER
echo =====================================================
echo Server: %SERVER_URL%
echo.

echo [1/4] Creating the local installation folder...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if errorlevel 1 goto :failed

echo [2/4] Downloading the RFID bridge from the AICS server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing '%SERVER_URL%/rfid-tools/acs-rfid-bridge.ps1' -OutFile '%INSTALL_DIR%\acs-rfid-bridge.ps1'; Invoke-WebRequest -UseBasicParsing '%SERVER_URL%/rfid-tools/install-acs-rfid-bridge-startup.ps1' -OutFile '%INSTALL_DIR%\install-acs-rfid-bridge-startup.ps1'"
if errorlevel 1 goto :download_failed

echo [3/4] Installing the bridge to start automatically at sign-in...
powershell -NoProfile -ExecutionPolicy Bypass -File "%INSTALL_DIR%\install-acs-rfid-bridge-startup.ps1"
if errorlevel 1 goto :failed

echo [4/4] Testing the local RFID bridge...
timeout /t 2 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $health=Invoke-RestMethod 'http://127.0.0.1:17654/health' -TimeoutSec 5; if(-not $health.ok){throw 'Bridge health check failed'}"
if errorlevel 1 goto :health_failed

echo.
echo =====================================================
echo SUCCESS: The AICS RFID reader bridge is installed.
echo Connect the ACS reader, open AICS, click RFID Scan,
echo then tap a card.
echo =====================================================
echo.
pause
exit /b 0

:download_failed
echo.
echo ERROR: The bridge files could not be downloaded.
echo Confirm this computer can open %SERVER_URL% in a browser,
echo then run this installer again.
goto :end_error

:health_failed
echo.
echo ERROR: Files were installed, but the bridge did not start.
echo Confirm the ACS driver and Windows Smart Card service are installed.
echo Restart the computer, then try RFID Scan again.
goto :end_error

:failed
echo.
echo ERROR: Installation did not complete.
echo Run this file again and approve the Administrator prompt.

:end_error
echo.
pause
exit /b 1