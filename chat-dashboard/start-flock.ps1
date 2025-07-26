Write-Host "🚀 Starting Flock integration with ngrok..." -ForegroundColor Green

# Check if ngrok is installed
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "❌ ngrok is not installed. Please install ngrok:" -ForegroundColor Red
    Write-Host "   https://ngrok.com/download" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "📋 Starting ngrok tunnel (without authentication)..." -ForegroundColor Cyan
Write-Host "   This will create a public URL for your local server" -ForegroundColor Gray
Write-Host "   Wait for the ngrok URL to appear, then copy it" -ForegroundColor Gray
Write-Host ""

# Start ngrok in a new window
Start-Process "ngrok" -ArgumentList "http 3000 --region=us" -NoNewWindow

Write-Host "⏳ Waiting for ngrok to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "🎯 Starting Next.js development server..." -ForegroundColor Green
Write-Host "   Server will be available at: http://localhost:3000" -ForegroundColor Gray
Write-Host "   Public URL will appear in ngrok window" -ForegroundColor Gray
Write-Host "   Press Ctrl+C to stop both servers" -ForegroundColor Gray
Write-Host ""

npm run dev

Read-Host "Press Enter to exit"