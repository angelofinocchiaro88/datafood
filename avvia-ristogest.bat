@echo off
setlocal
REM ─────────────────────────────────────────────────────────────
REM  Avvio DATAFOOD (RistoGest) - PostgreSQL locale + Next.js
REM  Avvia il database se non e' gia' attivo, poi lancia il server.
REM ─────────────────────────────────────────────────────────────

set "NODE_HOME=%LOCALAPPDATA%\Programs\nodejs"
set "PG_BIN=%LOCALAPPDATA%\Programs\PostgreSQL\pgsql\bin"
set "PG_DATA=%LOCALAPPDATA%\PostgreSQL\16\data"
set "PG_LOG=%LOCALAPPDATA%\PostgreSQL\16\pg.log"
set "PATH=%NODE_HOME%;%PATH%"

cd /d "%~dp0"

echo [1/2] Avvio PostgreSQL locale...
if not exist "%PG_BIN%\pg_ctl.exe" (
  echo     PostgreSQL non trovato in %PG_BIN%
  echo     Istruzioni di installazione nel README.
  goto :errore
)
pushd "%PG_BIN%"
"%PG_BIN%\pg_ctl.exe" -D "%PG_DATA%" -l "%PG_LOG%" -o "-p 5432 -h 127.0.0.1" start >nul 2>&1
popd
if errorlevel 1 (
  echo     PostgreSQL gia' in esecuzione o gia' avviato.
) else (
  echo     PostgreSQL avviato su 127.0.0.1:5432
)

echo [2/2] Avvio DATAFOOD su http://127.0.0.1:3000
echo.
call npm run dev
goto :fine

:errore
pause
exit /b 1

:fine
echo.
echo Server arrestato.
pause
