param(
    [string]$Port = "3000"
)

Write-Host "🚀 Starting Cloudflare Tunnel (free alternative)..." -ForegroundColor Green

# Check if cloudflared is installed
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "❌ cloudflared not found. Installing..." -ForegroundColor Yellow
    
    # Download cloudflared for Windows
    $downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    $downloadPath = "$env:TEMP\cloudflared.exe"
    
    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $downloadPath
        # Move to PATH
        $destination = "$env:USERPROFILE\.cloudflared\cloudflared.exe"
        New-Item -ItemType Directory -Path "$env:USERPROFILE\.cloudflared" -Force | Out-Null
        Move-Item -Path $downloadPath -Destination $destination -Force
        
        # Add to PATH
        $env:PATH += ";$env:USERPROFILE\.cloudflared"
        Write-Host "✅ cloudflared installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to install cloudflared. Please install manually:" -ForegroundColor Red
        Write-Host "   https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit
    }
}

Write-Host "📋 Starting Cloudflare tunnel..." -ForegroundColor Cyan
Write-Host "   This will create a public URL for your local server" -ForegroundColor Gray
Write-Host "   Wait for the Cloudflare URL to appear, then copy it" -ForegroundColor Gray
Write-Host ""

# Start cloudflared in a new window
Start-Process "cloudflared" -ArgumentList "tunnel --url http://localhost:$Port" -NoNewWindow

Write-Host "⏳ Waiting for Cloudflare to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "🎯 Starting Next.js development server..." -ForegroundColor Green
Write-Host "   Server will be available at: http://localhost:$Port" -ForegroundColor Gray
Write-Host "   Public URL will appear in cloudflared window" -ForegroundColor Gray
Write-Host "   Press Ctrl+C to stop both servers" -ForegroundColor Gray
Write-Host ""

npm run dev

Read-Host "Press Enter to exit"