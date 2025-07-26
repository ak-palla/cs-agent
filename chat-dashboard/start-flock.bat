@echo off
echo 🚀 Starting Flock integration with ngrok...

REM Check if ngrok is installed
where ngrok >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ ngrok is not installed. Please install ngrok:
    echo    https://ngrok.com/download
    pause
    exit /b
)

echo 📋 Starting ngrok tunnel (without authentication)...
echo    This will create a public URL for your local server
echo    Wait for the ngrok URL to appear, then copy it
echo.

start cmd /k "ngrok http 3000 --region=us"

echo ⏳ Waiting for ngrok to initialize...
timeout /t 5 /nobreak >nul

echo 🎯 Starting Next.js development server...
echo    Server will be available at: http://localhost:3000
echo    Public URL will appear in ngrok window
echo    Press Ctrl+C to stop both servers
echo.

call npm run dev

pause