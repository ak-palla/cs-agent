# Flock Integration Setup Guide

## Overview
This guide will help you set up the Flock messaging integration for the CS Agent Dashboard. The integration provides full messaging capabilities, channel management, direct messages, file uploads, and team communication features using FlockOS API.

## Prerequisites
- Flock workspace access
- Flock app credentials (App ID and App Secret)
- Flock bot token for authentication
- Development environment set up

## Environment Configuration

### Step 1: Add Environment Variables
Add the following environment variables to your `.env.local` file:

```bash
# Flock Integration
NEXT_PUBLIC_FLOCK_APP_ID=03bc24fd-6b91-4dca-a517-09f716f0e857
FLOCK_APP_SECRET=2c6d3b68-9c09-436f-b0db-8440ab5d65d9
```

### Step 2: Create and Configure Flock Bot

#### 2.1 Access Flock Developer Console
1. Go to [dev.flock.com](https://dev.flock.com)
2. Sign in with your Flock account
3. Click "Start creating a Flock App"

#### 2.2 Create New App
1. Choose "Create a new app"
2. Fill in app details:
   - **App Name**: CS Agent Dashboard
   - **Description**: Team communication dashboard integration
   - **Category**: Productivity

#### 2.3 Configure App Settings
1. Go to your app dashboard
2. Note down your **App ID** and **App Secret**
3. Configure app capabilities:
   - Enable **Messaging** permissions
   - Enable **Bot** functionality
   - Set appropriate scopes for your needs

#### 2.4 Install App to Team
1. Install your app to your Flock team
2. Generate a **Bot Token** from the app settings
3. Copy the bot token - you'll need this for authentication

### Step 3: Restart Development Server
After adding environment variables:
```bash
npm run dev
# or
yarn dev
```

## Using the Flock Integration

### Step 1: Navigate to Flock Page
- Open your browser to `http://localhost:3000/flock` (or port 3001 if 3000 is in use)
- You should see the Flock authentication interface

### Step 2: Authenticate with Bot Token
1. Click "Connect with Flock" button
2. Enter your **Bot Token** in the input field
3. Click "Connect" to authenticate
4. If successful, you'll be redirected to the chat interface

### Step 3: Start Using Flock Features
Once authenticated, you can:
- Browse and join channels
- Send direct messages to team members
- Upload files and attachments
- Search for messages and users
- Create new channels and conversations

## API Endpoints

The integration provides comprehensive API endpoints:

### Authentication
- `POST /api/flock/auth` - Validate bot token and get user info

### Messaging
- `GET /api/flock/messages` - Get messages from a channel
- `POST /api/flock/messages` - Send messages

### Teams & Channels
- `GET /api/flock/teams` - Get teams for authenticated user
- `GET /api/flock/channels` - Get channels for team
- `POST /api/flock/channels` - Create new channel

### Users
- `GET /api/flock/users` - Get team members
- `GET /api/flock/me` - Get current user info

### File Operations
- `POST /api/flock/files/upload` - Upload files and attachments

### Search
- `GET /api/flock/search` - Search messages, channels, users

## Architecture

### Client-Side Components
- **FlockChat**: Main chat interface with sidebar and messaging
- **Flock Page**: Authentication and connection management
- **FlockApiClient**: TypeScript client for FlockOS API

### Server-Side Integration
- **FlockOS API**: Uses FlockOS API endpoints with bot token authentication
- **Rate Limiting**: 100 requests per minute to prevent API limits
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Security**: Bot token-based authentication with secure token management
- **Type Safety**: Full TypeScript interfaces for all data structures

## Troubleshooting

### Common Issues

#### 1. "Flock credentials not configured"
**Solution**: 
- Ensure environment variables are added to `.env.local`
- Restart your development server
- Check for typos in variable names

#### 2. "Invalid token or failed to verify"
**Solution**:
- Verify bot token is correct and properly copied
- Ensure the bot is installed to your Flock team
- Check if the bot has necessary permissions
- Try regenerating the bot token

#### 3. "Failed to load data"
**Solution**:
- Test connection using the "Test Connection" button
- Check browser console for API errors
- Verify you have access to the team and channels
- Ensure bot has proper team member permissions

#### 4. Messages not loading
**Solution**:
- Check if you have access to the selected channel
- Verify bot token has read permissions
- Check browser network tab for failed API calls

### Debug Mode
- Check browser console (F12) for detailed error messages
- Use "Test Connection" button to verify API connectivity
- Monitor network requests to identify failing API calls

## Security Considerations

- **Bot Tokens**: Stored securely in localStorage (consider moving to httpOnly cookies for production)
- **Environment Variables**: Keep `FLOCK_APP_SECRET` secure and never expose in client-side code
- **HTTPS**: Use HTTPS in production for secure API communication
- **Token Management**: Implement token refresh/renewal for long-term usage
- **Permissions**: Grant minimal necessary permissions to bot tokens

## Differences from OAuth Integration

This integration uses **FlockOS bot token authentication** instead of OAuth 2.0:

- **Direct Token**: Users enter bot tokens directly instead of OAuth flow
- **Simplified Setup**: No redirect URIs or complex OAuth configuration needed
- **Bot-based**: Integration works through Flock bot APIs
- **Team Installation**: Bot must be installed to team before use

## Support & Resources

- **Flock Developer Documentation**: [dev.flock.com](https://dev.flock.com)
- **FlockOS API Reference**: For understanding bot APIs and methods
- **Project Documentation**: See `PLANNING.md` for overall architecture

## Next Steps

1. **Set up environment variables** as described above
2. **Create and configure Flock bot** with proper permissions
3. **Install bot to your team** and get the bot token
4. **Test the integration** by connecting and sending messages
5. **Explore advanced features** as they become available
6. **Integrate with other platforms** (Mattermost, Trello) for unified experience

---

**Note**: This integration follows the same patterns as the Mattermost integration, ensuring consistency across the CS Agent Dashboard platform. The FlockOS approach provides a more straightforward authentication method compared to traditional OAuth flows. 