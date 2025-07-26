# Fix Flock App Installation Error

## Problem
"Did not get an HTTP 200 OK response from the event listener URL"

## Root Cause
Local development server (localhost:3000) is not accessible from Flock's servers.

## Solution

### Method 1: Using ngrok (Recommended)

1. **Start ngrok tunnel:**
   ```bash
   cd /mnt/d/CS_Agent/chat-dashboard
   ngrok http 3000
   ```

2. **Copy the public URL** (e.g., `https://abc123.ngrok.io`)

3. **Set Event Listener URL in Flock:**
   ```
   https://abc123.ngrok.io/api/flock/app-install
   ```

4. **Start your development server:**
   ```bash
   npm run dev
   ```

### Method 2: Quick Test Server

Run this standalone webhook server:

```bash
cd /mnt/d/CS_Agent/chat-dashboard
node scripts/test-webhook.js
```

Then configure in Flock:
```
http://localhost:3000/api/flock/app-install
```

### Verification Steps

1. **Test webhook endpoint:**
   ```bash
   curl "http://localhost:3000/api/flock/app-install?challenge=test123"
   ```

2. **Expected response:** `test123` (HTTP 200)

3. **Test with ngrok:**
   ```bash
   curl "https://your-ngrok-url.ngrok.io/api/flock/app-install?challenge=test123"
   ```

### Environment Variables
Make sure these are set in `.env.local`:
```bash
NEXT_PUBLIC_FLOCK_WEBHOOK_URL=https://your-ngrok-url.ngrok.io/api/flock/app-install
```

### Troubleshooting
- Ensure ngrok is running and accessible
- Check server logs for incoming requests
- Verify the webhook URL is publicly accessible