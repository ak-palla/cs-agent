# Mattermost OAuth 2.0 Setup Guide

## 1. Register Your Application in Mattermost

### Step 1: Access System Console
1. Login to your Mattermost server as a System Administrator
2. Go to **System Console** → **Integrations** → **Integration Management**
3. Set **Enable OAuth 2.0 Service Provider** to `true`

### Step 2: Create OAuth Application
1. Go to **System Console** → **Integrations** → **OAuth 2.0 Applications**
2. Click **Add OAuth 2.0 Application**
3. Fill in the details:
   - **Display Name**: `Chat Dashboard`
   - **Description**: `Real-time activity monitoring dashboard`
   - **Homepage**: `https://localhost:3000`
   - **Authorization Callback URLs**: `https://localhost:3000/auth/mattermost/callback`
   - **Trusted**: `Yes` (for internal applications)
   - **Skip Authorization**: `Yes` (optional, for better UX)

### Step 3: Get Credentials
After creating the application, you'll receive:
- **Client ID**: Copy this value
- **Client Secret**: Copy this value (store securely)

## 2. Configure Environment Variables

Update your `.env.local` file:

```bash
# OAuth Configuration
NEXT_PUBLIC_MATTERMOST_CLIENT_ID=your_actual_client_id_here
MATTERMOST_CLIENT_SECRET=your_actual_client_secret_here
NEXT_PUBLIC_OAUTH_REDIRECT_URI=https://localhost:3000/auth/mattermost/callback

# Mattermost Server
NEXT_PUBLIC_MATTERMOST_URL=https://teams.webuildtrades.co
NEXT_PUBLIC_MATTERMOST_WS_URL=wss://teams.webuildtrades.co
```

## 3. OAuth Flow

### User Experience:
1. User clicks "Login with Mattermost" button
2. Redirected to Mattermost authorization server
3. User approves the application (if not set to skip)
4. Redirected back with authorization code
5. Code is exchanged for access token
6. User is logged in and can use the dashboard

### Security Features:
- ✅ **State Parameter**: Prevents CSRF attacks
- ✅ **Secure Cookies**: HttpOnly cookies for token storage
- ✅ **Token Expiration**: Automatic token refresh
- ✅ **HTTPS Only**: All OAuth flows use HTTPS

## 4. Required Permissions

The application requests these OAuth scopes:
- `read_user`: Access user profile information
- `read_channel`: Access channel information
- `read_team`: Access team information
- `read_post`: Read messages and posts
- `write_post`: Send messages (for bot functionality)

## 5. Testing OAuth Setup

### Quick Test:
1. Start the development server: `npm run dev`
2. Go to `https://localhost:3000/mattermost`
3. Click "Login with Mattermost"
4. Complete the OAuth flow
5. Check browser console and server logs for success

### Troubleshooting:

**Error: "Invalid client_id"**
- Verify `NEXT_PUBLIC_MATTERMOST_CLIENT_ID` is correct
- Ensure the OAuth application is active in Mattermost

**Error: "Redirect URI mismatch"**
- Check that callback URL matches exactly
- Ensure using HTTPS (not HTTP)

**Error: "Invalid client_secret"**
- Verify `MATTERMOST_CLIENT_SECRET` is correct
- Check that secret wasn't truncated when copying

**Error: "OAuth not enabled"**
- Enable OAuth 2.0 in Mattermost System Console
- Restart Mattermost server after enabling

## 6. Production Considerations

### Security:
- Use strong, unique client secrets
- Implement proper token storage (database/Redis)
- Enable HTTPS in production
- Set appropriate cookie security flags

### Monitoring:
- Log all OAuth events for audit trails
- Monitor token refresh rates
- Track authentication failures

### Scaling:
- Consider token caching strategies
- Implement proper session management
- Handle concurrent user sessions

## 7. API Usage After Authentication

Once authenticated, the application can:
- Access Mattermost REST API with the user's permissions
- Establish WebSocket connections for real-time updates
- Perform actions on behalf of the authenticated user

Example API call:
```javascript
const response = await fetch('/api/mattermost/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

---

**Next Steps**: After setting up OAuth, the dashboard will provide a much better user experience with secure, automatic authentication.