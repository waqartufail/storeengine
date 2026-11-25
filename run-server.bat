@echo off
setlocal
cd /d "%~dp0"
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo Set POSTGRES_PASSWORD, Owner__Email and Owner__Password. Save and close Notepad to continue.
  start /wait notepad ".env"
)
docker compose up --build -d
if errorlevel 1 goto failed
echo Open http://localhost:5173 after the services start. See README.md if you changed WEB_PORT.
pause
exit /b 0
:failed
echo Startup failed. Check the .env settings and Docker Desktop.
pause
exit /b 1
