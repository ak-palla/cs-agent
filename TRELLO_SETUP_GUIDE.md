# Trello Integration Setup Guide

## Required Allowed Origins

For the Trello integration to work properly, you need to add the following origins to your Trello Power-Up configuration:

### Development Environment
```
http://localhost:3000
https://localhost:3000
```

### If using ngrok for development (recommended for webhook testing)
```
https://your-ngrok-subdomain.ngrok-free.app
```
Replace `your-ngrok-subdomain` with your actual ngrok domain.

### Production Environment
```
https://your-production-domain.com
https://www.your-production-domain.com
```
Replace with your actual production domain(s).

## Complete Setup Steps

### 1. Create Trello Power-Up
1. Go to [https://trello.com/power-ups/admin](https://trello.com/power-ups/admin)
2. Click "Create new Power-Up"
3. Fill in the required information:
   - **Name**: CS Agent Dashboard
   - **Workspace**: Select your workspace
   - **Iframe connector URL**: Not required for API-only integration
   - **Author Email**: Your email address

### 2. Get API Credentials
1. After creating the Power-Up, go to the "API Key" tab
2. Click "Generate a new API Key"
3. Copy the **API Key** (starts with a long string of letters/numbers)
4. Copy the **Secret** (you'll need this for webhooks)

### 3. Configure Allowed Origins
In the Power-Up settings, add these origins based on your environment:

**For Local Development:**
- `http://localhost:3000`
- `https://localhost:3000`

**For Development with ngrok (webhook testing):**
- `https://75e6a5b4567b.ngrok-free.app` (or your ngrok URL)

**For Production:**
- `https://yourdomain.com`
- `https://www.yourdomain.com`

### 4. Generate Access Token
1. Visit the token generation URL (automatically generated in our app)
2. Or manually visit: `https://trello.com/1/authorize?expiration=never&scope=read,write,account&response_type=token&name=CS%20Agent%20Dashboard&key=YOUR_API_KEY`
3. Replace `YOUR_API_KEY` with your actual API key
4. Click "Allow" to authorize the application
5. Copy the generated token

### 5. Environment Variables (Optional)
You can set these in your `.env.local` file instead of entering them in the UI:

```env
TRELLO_API_KEY=your_api_key_here
TRELLO_TOKEN=your_token_here
TRELLO_WEBHOOK_SECRET=your_secret_here
```

### 6. Test the Integration
1. Navigate to `/trello` in your application
2. Enter your API key and token
3. Click "Connect to Trello"
4. You should see your boards loaded

## Webhook Configuration (Optional)

For real-time updates, webhooks are automatically configured when you:
1. Select a board in the Trello interface
2. The app will automatically create webhooks for that board
3. Webhooks will point to: `https://yourdomain.com/api/trello/webhooks/callback`

### Webhook Requirements
- Your application must be accessible from the internet (use ngrok for local development)
- HTTPS is required for production webhooks
- The webhook secret is used to verify incoming webhook signatures

## Troubleshooting

### CORS Errors
- Ensure your domain is listed in the allowed origins
- Check that you're using the correct protocol (http vs https)
- Verify the API key matches the Power-Up that has the allowed origins

### Authentication Errors
- Verify your API key and token are correct
- Ensure the token has the required scopes: `read,write,account`
- Check that the token hasn't expired

### Webhook Issues
- Ensure your application is accessible from the internet
- Verify the webhook secret matches your environment variable
- Check the webhook callback URL is correct

## Features Available

✅ **Board Management**: Create, read, update, delete boards
✅ **List Operations**: Create and manage lists within boards  
✅ **Card CRUD**: Full card lifecycle management with drag-and-drop
✅ **Real-time Updates**: Webhook integration for live updates
✅ **Activity Tracking**: Complete audit trail using Actions API
✅ **Advanced Search**: Search across boards, cards, and activities
✅ **Member Management**: Add/remove members from boards and cards
✅ **Due Date Management**: Set and track card due dates
✅ **Label System**: Organize cards with colored labels
✅ **File Attachments**: Upload and manage card attachments
✅ **Comments**: Add and track card comments
✅ **Authentication**: Secure OAuth flow with token management 