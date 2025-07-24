# Simple Slash Command Setup (No OAuth Required)

## Overview
Since your Mattermost server doesn't support Outgoing OAuth Connections, we'll use a simpler approach with direct slash commands.

## 1. Create Slash Command in Mattermost

### Step 1: Access Integration Settings
1. Go to **Main Menu** → **Integrations** → **Slash Commands**
2. Click **Add Slash Command**

### Step 2: Configure Command
Fill in these details:

- **Display Name**: `Dashboard`
- **Description**: `Get dashboard statistics and information`
- **Command Trigger Word**: `dashboard`
- **Request URL**: `https://localhost:3000/api/slash/dashboard`
- **Request Method**: `POST`
- **Response Username**: `Dashboard Bot`
- **Response Icon URL**: `https://localhost:3000/favicon.ico` (optional)
- **Autocomplete**: `Yes`
- **Autocomplete Hint**: `[stats|activities|workflows|help]`
- **Autocomplete Description**: `Get dashboard information`

### Step 3: Save and Copy Token
After saving, **copy the Token** that's generated. You'll need this for security.

## 2. Configure Environment Variable

Add the slash command token to your `.env.local`:

```bash
# Slash Command Security
MATTERMOST_SLASH_TOKEN=your_generated_token_here
```

## 3. Available Commands

### Get Dashboard Statistics
```
/dashboard stats
```
**Response:** Shows activity counts, platform breakdown, and workflow status (visible to channel)

### Get Recent Activities  
```
/dashboard activities
```
**Response:** Shows last 10 activities (private to you)

### Get Workflow Status
```
/dashboard workflows
```
**Response:** Shows workflow execution statistics (visible to channel)

### Get Help
```
/dashboard help
```
**Response:** Shows available commands (private to you)

## 4. Example Responses

### `/dashboard stats`
```
📊 Dashboard Statistics (24h)

Total Activities: 25

By Platform:
• mattermost: 18
• trello: 7

By Event Type:
• message_created: 12
• reaction_added: 6
• channel_created: 4
• user_joined_channel: 2
• message_updated: 1

Workflow Executions: 8 (87% success rate)
• Completed: 7
• Failed: 1
• Running: 0
• Pending: 0
```

### `/dashboard activities`
```
📋 Recent Activities (Last 10)

1. message_created on mattermost
   └ 7/24/2024, 10:45:23 AM

2. reaction_added on mattermost  
   └ 7/24/2024, 10:43:15 AM

3. channel_created on mattermost
   └ 7/24/2024, 10:41:02 AM
...
```

## 5. Security Features

✅ **Token Validation**: Optional token validation for security
✅ **Response Types**: Private vs public responses
✅ **Error Handling**: Graceful error messages
✅ **Logging**: All commands are logged for audit

## 6. Testing

1. **Start your dashboard**: `npm run dev`
2. **In any Mattermost channel**, type: `/dashboard stats`
3. **Check server logs** for command processing
4. **Verify response** appears in the channel

## 7. Troubleshooting

### Command Not Found
- Verify the trigger word is exactly `dashboard`
- Check that the slash command is enabled
- Ensure you have permission to use slash commands

### "Invalid Token" Error
- Add the correct token to your `.env.local` file
- Restart the dashboard server after adding the token
- Verify the token matches what Mattermost shows

### Command Times Out
- Ensure dashboard server is running on HTTPS
- Check that `https://localhost:3000` is accessible from Mattermost
- Verify no firewall is blocking the connection

### Empty Response
- Check server logs for errors
- Verify database connection is working
- Test the API endpoint directly: `curl -X POST https://localhost:3000/api/slash/dashboard -d "text=stats"`

## 8. Extending Commands

To add new commands, edit `/app/api/slash/dashboard/route.ts`:

```typescript
case 'newcommand':
  response = await handleNewCommand();
  break;
```

Then implement the `handleNewCommand()` function.

## 9. Production Considerations

### Security
- Enable token validation in production
- Use HTTPS for all endpoints  
- Implement rate limiting
- Log all command usage

### Performance
- Cache frequent database queries
- Implement connection pooling
- Monitor API response times

### Monitoring
- Track command usage statistics
- Monitor error rates
- Set up alerts for failures

This approach gives you the same functionality without requiring OAuth support from your Mattermost server!