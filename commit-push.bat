@echo off
setlocal
REM ─────────────────────────────────────────────────────────────
REM  Commit + push verso GitHub (origin/main)
REM  Uso: commit-push.bat "messaggio del commit"
REM ─────────────────────────────────────────────────────────────

set "GIT_BIN="
for /d %%D in ("%LOCALAPPDATA%\GitHubDesktop\app-*") do (
  if exist "%%~fD\resources\app\git\cmd\git.exe" set "GIT_BIN=%%~fD\resources\app\git\cmd"
)
if not defined GIT_BIN (
  echo Git non trovato. Installa Git for Windows oppure apri GitHub Desktop.
  exit /b 1
)
set "PATH=%GIT_BIN%;%PATH%"
cd /d "%~dp0"

if "%~1"=="" (
  echo Uso: commit-push.bat "messaggio del commit"
  exit /b 1
)

echo [1/3] Stage delle modifiche...
git add -A

echo [2/3] Commit...
git commit -m "%~1"
if errorlevel 1 (
  echo     Nessuna modifica da committare, oppure commit fallito.
  git status -sb
  exit /b 1
)

echo [3/3] Push su origin/main...
git push origin main
if errorlevel 1 (
  echo     Push fallito. Verifica la connessione e le credenziali GitHub.
  exit /b 1
)

echo.
git status -sb
echo Fatto: le modifiche sono su GitHub.
pause
