@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set PORT=8080

REM --- find Python 3.12 (prefer py launcher 64-bit) ---
set "PYEXE="
where py >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%P in ('py -3.12-64 -c "import sys; print(sys.executable)" 2^>nul') do set "PYEXE=%%P"
)
if not defined PYEXE (
  where py >nul 2>&1
  if not errorlevel 1 (
    for /f "delims=" %%P in ('py -3.12 -c "import sys; print(sys.executable)" 2^>nul') do set "PYEXE=%%P"
  )
)
if not defined PYEXE (
  where python >nul 2>&1
  if not errorlevel 1 (
    for /f "delims=" %%P in ('python -c "import sys; print(sys.executable) if sys.version_info[:2]==(3,12) else """"" 2^>nul') do set "PYEXE=%%P"
  )
)

if not defined PYEXE (
  echo [ERR] Python 3.12 not found.
  echo       Install Python 3.12 64-bit and enable py launcher / PATH.
  echo.
  pause
  exit /b 1
)

netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo [ERR] Port %PORT% is already in use.
  echo       Close the other CMD window running the server, then try again.
  echo.
  pause
  exit /b 1
)

REM Ensure Asset/ is available next to index.html (junction to ../Asset when shipping from git clone)
if not exist "Asset\GamePlay\GamePlaySVG.svg" (
  if exist "..\Asset\GamePlay\GamePlaySVG.svg" (
    if exist "Asset" rmdir "Asset" 2>nul
    mklink /J "Asset" "..\Asset" >nul
    if errorlevel 1 (
      echo [ERR] Could not link Deploy\Asset -^> ..\Asset
      echo       Run CMD as user with junction rights, or copy Asset into Deploy\Asset
      pause
      exit /b 1
    )
    echo  Linked Asset\ -^> ..\Asset
  ) else (
    echo [ERR] Missing Asset\GamePlay\GamePlaySVG.svg
    pause
    exit /b 1
  )
)

echo.
echo  Loy Krathong - local server
echo  ---------------------------
echo  Folder: %CD%
echo  Python: %PYEXE%
"%PYEXE%" -c "import sys; print('  Ver:', sys.version.split()[0])"
echo  Game:   http://localhost:%PORT%/
echo  Print:  http://localhost:%PORT%/print-cards.html
echo  Close this window to stop.
echo.

start "" "http://localhost:%PORT%/"
start "" "http://localhost:%PORT%/print-cards.html"

"%PYEXE%" -m http.server %PORT%
set ERR=%ERRORLEVEL%
echo.
if not "%ERR%"=="0" echo [ERR] Server exited with code %ERR%
pause
endlocal
