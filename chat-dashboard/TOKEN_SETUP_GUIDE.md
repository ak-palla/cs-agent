# Mattermost Token Setup Guide

## Getting a Personal Access Token

1. **Login to your Mattermost server**: https://teams.webuildtrades.co

2. **Go to Account Settings**:
   - Click your profile picture (top right)
   - Select "Account Settings"

3. **Navigate to Security**:
   - Click "Security" tab
   - Scroll down to "Personal Access Tokens"

4. **Create New Token**:
   - Click "Create New Token"
   - Enter a description (e.g., "Dashboard Integration")
   - Click "Save"
   - **COPY THE TOKEN IMMEDIATELY** (it won't be shown again)

5. **Use the Token**:
   - Paste it in the dashboard token field
   - Token format: `abcd1234efgh5678ijkl9012mnop3456`

## Troubleshooting

**If you can't see "Personal Access Tokens":**
- Ask your Mattermost admin to enable personal access tokens
- You may need additional permissions

**If token still fails:**
- Ensure you copied the complete token
- Try generating a new token
- Check if your user account has API access permissions