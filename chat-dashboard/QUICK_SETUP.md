# 🚀 Flock App Installation Fix - Quick Setup

## Problem
"Did not get an HTTP 200 OK response from the event listener URL"

## Solution: Use Cloudflare Tunnel (Free Alternative)

### **Step 1: Install Cloudflare Tunnel (cloudflared)**

**Option A: One-liner PowerShell (Windows)**
```powershell
# Run this in PowerShell as Administrator
irm https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -OutFile $env:USERPROFILE\.cloudflared\cloudflared.exe
cmd /c setx PATH "%PATH%;%USERPROFILE%\.cloudflared%"
```

**Option B: Manual Download**
1. Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation
2. Extract to any folder
3. Add to PATH or use full path

### **Step 2: Start Everything**

**Using PowerShell:**
```powershell
cd D:	actiq-free-transcript--IR4ojI8QMM.txtCS_Agent
tactiq-free-transcript--IR4ojI8QMM.txtchat-dashboard
.\scripts\start-cloudflared.ps1
```

**Using Command Prompt:**
```cmd
cd D:	actiq-free-transcript--IR4ojI8QMM.txtCS_Agent
tactiq-free-transcript--IR4ojI8QMM.txtchat-dashboard
start cloudflared tunnel --url http://localhost:3000
npm run dev
```

### **Step 3: Configure Flock**

1. **Wait for cloudflared output** - you'll see something like:
   ```
   +--------------------------------------------------------------------------------------------+
   |  Your quick Tunnel has been created! Visit it at:                                          |
   |  https://your-app.trycloudflare.com                                                      |
   +--------------------------------------------------------------------------------------------+
   ```

2. **Copy the URL** (e.g., `https://your-app.trycloudflare.com`)

3. **Go to https://dev.flock.com**
4. **Set Event Listener URL to:** `https://your-app.trycloudflare.com/api/flock/app-install`
5. **Save and retry app installation**

### **Step 4: Verification**

**Test the endpoint:**
```cmd
curl "https://your-app.trycloudflare.com/api/flock/app-install?challenge=test123"
# Should return: test123
```

### **Troubleshooting**

1. **If cloudflared fails:**
   - Try running with `-v` flag for verbose output
   - Check firewall settings
   - Try different port: `cloudflared tunnel --url http://localhost:3001`

2. **If npm fails:**
   - Run: `npm install`
   - Then: `npm run dev`

3. **Flock still shows error:**
   - Check server logs for incoming requests
   - Ensure URL is publicly accessible
   - Verify webhook URL in Flock dashboard

### **Alternative: ngrok (if you get correct API key)**

If you want to use ngrok instead:
1. Get correct authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken
2. Run: `ngrok authtoken YOUR_CORRECT_TOKEN`
3. Then: `ngrok http 3000`