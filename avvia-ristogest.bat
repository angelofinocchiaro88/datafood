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

echo [1/2] Controllo PostgreSQL locale...
if not exist "%PG_BIN%\pg_isready.exe" (
  echo     PostgreSQL non trovato in %PG_BIN%
  echo     Istruzioni di installazione nel README.
  goto :errore
)

"%PG_BIN%\pg_isready.exe" -h 127.0.0.1 -p 5432 -t 3 >nul 2>&1
if errorlevel 1 (
  echo     Avvio del server PostgreSQL...
  REM PATH pulito in avvio: le DLL di PostgreSQL (libcrypto-3-x64, libintl-9,
  REM libwinpthread-1) hanno gli stessi nomi di quelle MinGW di Git: se il PATH
  REM le contiene, i backend caricano le versioni sbagliate e muoiono con 0xC0000142.
  set "ORIG_PATH=%PATH%"
  pushd "%PG_BIN%"
  set "PATH=%PG_BIN%;C:\Windows\System32;C:\Windows"
  start "" /B "%PG_BIN%\postgres.exe" -D "%PG_DATA%" -p 5432 -h 127.0.0.1 >"%PG_LOG%" 2>&1
  popd
  set "PATH=%ORIG_PATH%"
  "%PG_BIN%\pg_isready.exe" -h 127.0.0.1 -p 5432 -t 30 >nul 2>&1
  if errorlevel 1 (
    echo     PostgreSQL non risponde. Ultimo log:
    type "%PG_LOG%" | more
    goto :errore
  )
  echo     PostgreSQL avviato su 127.0.0.1:5432
) else (
  echo     PostgreSQL gia' in esecuzione su 127.0.0.1:5432
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
