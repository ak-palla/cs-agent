# Mattermost Slash Command with OAuth Setup

## Overview
This guide shows how to create a Mattermost slash command that connects to your dashboard using OAuth authentication.

## 1. Dashboard OAuth Provider Setup

Your dashboard now acts as an OAuth provider with these endpoints:

- **Authorization URL**: `https://localhost:3000/oauth/authorize`
- **Token URL**: `https://localhost:3000/oauth/token`
- **Protected API**: `https://localhost:3000/api/dashboard/stats`

## 2. Create Outgoing OAuth Connection in Mattermost

### Step 1: Access System Console
1. Go to **System Console** → **Integrations** → **Outgoing OAuth Connections**
2. Click **Add Outgoing OAuth Connection**

### Step 2: Configure OAuth Connection
Fill in these details:

- **Display Name**: `Dashboard OAuth`
- **Client ID**: `dashboard-client` (you can choose any ID)
- **Client Secret**: `dashboard-secret-2024` (you can choose any secret)
- **OAuth Token URL**: `https://localhost:3000/oauth/token`
- **OAuth Authorization URL**: `https://localhost:3000/oauth/authorize`
- **Redirect URL**: `https://teams.webuildtrades.co/plugins/com.mattermost.apps/oauth2/complete`

### Step 3: Save and Note the Connection ID
After saving, note the **Connection ID** (you'll need this for the slash command).

## 3. Create Slash Command

### Step 1: Create New Slash Command
1. Go to **System Console** → **Integrations** → **Slash Commands**
2. Click **Add Slash Command**

### Step 2: Configure Slash Command
- **Display Name**: `Dashboard Stats`
- **Description**: `Get dashboard statistics`
- **Command Trigger Word**: `dashboard`
- **Request URL**: `https://localhost:3000/api/dashboard/stats`
- **Request Method**: `GET`
- **Response Username**: `Dashboard Bot`
- **Autocomplete**: Yes
- **Autocomplete Hint**: `[stats]`
- **Autocomplete Description**: `Get dashboard statistics`

### Step 3: Configure OAuth (Advanced Settings)
- **OAuth Connection**: Select the "Dashboard OAuth" connection you created
- **Enable OAuth**: Yes

## 4. Test the Slash Command

### In any Mattermost channel, type:
```
/dashboard stats
```

### Expected Response:
```
📊 Dashboard Summary (24h)

Activities: 15 total

By Platform:
• mattermost: 12
• trello: 3

Workflows: 8 executions (87% success rate)
```

## 5. OAuth Flow

When a user runs the slash command:

1. **First Time**: User is redirected to dashboard OAuth authorization
2. **Authorization**: Dashboard auto-approves the request
3. **Token Exchange**: Mattermost gets an access token
4. **API Call**: Mattermost calls `/api/dashboard/stats` with the token
5. **Response**: Dashboard returns formatted statistics
6. **Display**: User sees the stats in Mattermost

## 6. Available Commands

You can extend this by creating more API endpoints:

### Get Recent Activities
- **Endpoint**: `/api/dashboard/activities`
- **Command**: `/dashboard activities`

### Get Workflow Status  
- **Endpoint**: `/api/dashboard/workflows`
- **Command**: `/dashboard workflows`

### Trigger Workflow
- **Endpoint**: `/api/dashboard/trigger`
- **Command**: `/dashboard trigger [workflow_name]`

## 7. Security Features

✅ **OAuth 2.0 Protection**: All API calls require valid tokens
✅ **Token Expiration**: Tokens expire after 1 hour
✅ **Secure Authorization**: State parameter prevents CSRF
✅ **Audit Logging**: All OAuth events are logged

## 8. Production Considerations

### Token Storage
- Replace in-memory storage with Redis/database
- Implement proper token cleanup
- Add refresh token support

### Security
- Add client authentication validation
- Implement rate limiting
- Use HTTPS in production

### Monitoring
- Track OAuth usage statistics
- Monitor API performance
- Log security events

## 9. Troubleshooting

### Command Returns "Unauthorized"
- Check OAuth connection configuration
- Verify dashboard endpoints are accessible
- Check server logs for OAuth errors

### Command Times Out
- Ensure dashboard server is running
- Check network connectivity
- Verify HTTPS certificates

### OAuth Authorization Fails
- Confirm authorization URL is correct
- Check dashboard logs for errors
- Verify OAuth connection is active

## 10. Example API Response

```json
{
  "timestamp": "2024-07-24T10:30:00Z",
  "activities": {
    "total_24h": 15,
    "by_platform": {
      "mattermost": 12,
      "trello": 3
    },
    "by_event_type": {
      "message_created": 8,
      "reaction_added": 4,
      "channel_created": 3
    }
  },
  "workflows": {
    "total": 8,
    "pending": 1,
    "running": 0,
    "completed": 7,
    "failed": 0
  },
  "summary": "📊 Dashboard Summary (24h)..."
}
```

This creates a powerful integration where Mattermost users can get real-time dashboard statistics directly in their chat channels!