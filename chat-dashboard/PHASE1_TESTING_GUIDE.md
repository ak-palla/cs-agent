# Phase 1 Testing Guide: Enhanced Mattermost Integration

## Overview
This guide helps you manually test the Phase 1 improvements including the official Mattermost client library upgrade and comprehensive logging system.

## Pre-Test Setup

### 1. Start the Development Environment
```bash
npm run dev
```

This will start the HTTPS server on `https://localhost:3000` with WebSocket support.

### 2. Open Browser Developer Tools
- Open `https://localhost:3000`
- Accept the self-signed certificate warning
- Open Developer Tools (F12)
- Go to Console tab to monitor browser logs

### 3. Check Server Logs
Keep an eye on the terminal where you ran `npm run dev` for server-side logs.

## Test Scenarios

### Scenario 1: WebSocket Connection Testing

#### Expected Browser Console Logs:
```
[timestamp] [INFO] [WEBSOCKET] WebSocketContext: Starting connection process
[timestamp] [INFO] [WEBSOCKET] Creating new Enhanced Mattermost client with comprehensive logging
[timestamp] [INFO] [MATTERMOST] Initializing Enhanced Mattermost Client
[timestamp] [INFO] [API] API GET /api/v4/users/me
[timestamp] [INFO] [MATTERMOST] REST API connection successful
[timestamp] [INFO] [WEBSOCKET] Initializing WebSocket connection
[timestamp] [INFO] [WEBSOCKET] WebSocketContext: Connection established
[timestamp] [INFO] [MATTERMOST] WebSocketContext: Connection successful
```

#### Expected Server Logs:
```
[timestamp] [INFO] [DATABASE] Database INSERT on activities: SUCCESS
[timestamp] [INFO] [MATTERMOST] Activity stored successfully
```

#### Manual Test Steps:
1. Navigate to the Mattermost page (`http://localhost:3000/mattermost`)
2. Enter your Mattermost token
3. Click "Connect"
4. Observe the connection logs in both browser console and server terminal

#### Success Criteria:
- ✅ Connection logs appear in browser console
- ✅ No error messages during connection
- ✅ Connection status shows "Connected" in UI
- ✅ Server logs show successful database operations

### Scenario 2: Activity Capture Testing

#### Expected Browser Console Logs:
```
[timestamp] [DEBUG] [WEBSOCKET] WebSocket message received
[timestamp] [DEBUG] [MATTERMOST] Activity processed and stored
[timestamp] [INFO] [API] API POST /api/admin/activities/store
```

#### Expected Server Logs:
```
[timestamp] [DEBUG] [MATTERMOST] Storing activity
[timestamp] [INFO] [DATABASE] Database INSERT on activities: SUCCESS
[timestamp] [INFO] [MATTERMOST] Activity stored successfully
```

#### Manual Test Steps:
1. Ensure WebSocket is connected (from Scenario 1)
2. Go to your Mattermost server in a separate browser tab
3. Send a message in any channel
4. Add a reaction to a message
5. Create a new channel
6. Switch back to the dashboard tab
7. Check the Admin Dashboard for activity updates

#### Success Criteria:
- ✅ Browser console shows WebSocket events being received
- ✅ Server logs show activities being stored
- ✅ Admin Dashboard shows increasing activity counts
- ✅ Recent activities appear in the dashboard

### Scenario 3: Admin Dashboard Data Loading

#### Expected Browser Console Logs:
```
[timestamp] [INFO] [DASHBOARD] Loading admin dashboard data
[timestamp] [INFO] [API] API GET /api/admin/activities/stats
[timestamp] [INFO] [API] API GET /api/admin/activities
[timestamp] [INFO] [API] API GET /api/admin/executions/stats
[timestamp] [INFO] [DASHBOARD] Dashboard data loading completed successfully
```

#### Expected Server Logs:
```
[timestamp] [INFO] [DATABASE] Database SELECT on activities: SUCCESS
[timestamp] [INFO] [DATABASE] Database SELECT on workflow_executions: SUCCESS
```

#### Manual Test Steps:
1. Navigate to Admin Dashboard (`http://localhost:3000`)
2. Click the refresh button
3. Switch between different time frames (24h, 7d, 30d)
4. Switch between different platforms (All, Mattermost, Trello, Flock)

#### Success Criteria:
- ✅ Dashboard loads without errors
- ✅ API calls complete successfully (check Network tab)
- ✅ Data updates when filters change
- ✅ Loading states work properly

### Scenario 4: Error Handling Testing

#### Manual Test Steps:
1. **Network Disconnection Test:**
   - Connect to Mattermost
   - Disconnect your internet
   - Observe reconnection attempts in logs
   - Reconnect internet
   - Verify automatic reconnection

2. **Invalid Token Test:**
   - Enter an invalid Mattermost token
   - Attempt to connect
   - Verify error logging and user feedback

3. **Server Downtime Test:**
   - Connect successfully
   - Temporarily block access to Mattermost server
   - Observe error handling and fallback behavior

#### Expected Error Logs:
```
[timestamp] [ERROR] [WEBSOCKET] WebSocketContext: Connection error
[timestamp] [ERROR] [MATTERMOST] Failed to connect Mattermost client
[timestamp] [WARN] [WEBSOCKET] CORS issue detected
```

#### Success Criteria:
- ✅ Errors are logged with detailed context
- ✅ User receives clear error messages
- ✅ System gracefully handles failures
- ✅ Automatic reconnection works when possible

## Performance Verification

### Metrics to Monitor:
1. **Connection Time:** Should be < 5 seconds for initial connection
2. **Activity Processing:** Should be < 100ms per activity
3. **Dashboard Loading:** Should be < 2 seconds for data loading
4. **Memory Usage:** Monitor for memory leaks during extended use

### Performance Test Steps:
1. Connect to Mattermost and leave connected for 30 minutes
2. Generate moderate activity (send 10-20 messages)
3. Refresh dashboard multiple times
4. Monitor browser memory usage in DevTools Performance tab

## Log Level Testing

### Debug Mode Activation:
Ensure `NEXT_PUBLIC_DEBUG_WEBSOCKET=true` in your `.env.local` file.

### Expected Debug Logs:
```
[timestamp] [DEBUG] [WEBSOCKET] WebSocket message received
[timestamp] [DEBUG] [MATTERMOST] Storing activity
[timestamp] [DEBUG] [API] API call details
```

### Test Steps:
1. Enable debug logging
2. Restart the application
3. Perform connection and activity tests
4. Verify debug logs appear
5. Disable debug logging and verify they disappear

## Troubleshooting Common Issues

### Issue: WebSocket Connection Fails
- **Check:** Certificate warnings in browser
- **Check:** CORS headers in network requests
- **Check:** Mattermost server accessibility
- **Solution:** Use HTTPS mode (`npm run dev` uses HTTPS by default)

### Issue: No Activities Captured
- **Check:** WebSocket connection status
- **Check:** Database connectivity
- **Check:** Row Level Security policies
- **Solution:** Verify API routes are accessible

### Issue: Dashboard Shows No Data
- **Check:** API route responses in Network tab
- **Check:** Server logs for database errors
- **Check:** Authentication and permissions
- **Solution:** Verify Supabase configuration

## Success Criteria Summary

Phase 1 is successful when:

✅ **Connection Reliability:**
- WebSocket connects within 5 seconds
- Automatic reconnection works
- Graceful error handling

✅ **Activity Capture:**
- All major Mattermost events are captured
- Activities appear in dashboard within 1 second
- No data loss during normal operation

✅ **Logging Comprehensiveness:**
- All operations are logged appropriately
- Error logs provide actionable information
- Debug logs can be enabled/disabled

✅ **Performance:**
- No memory leaks during extended use
- Responsive UI during high activity
- Efficient database operations

✅ **User Experience:**
- Clear status indicators
- Informative error messages
- Smooth navigation and updates

## Next Steps

After Phase 1 testing is complete and successful:
1. Document any issues found and their solutions
2. Proceed to Phase 2: Bot Integration and Slash Commands
3. Begin implementing performance metrics collection
4. Plan for webhook enhancements

## Testing Checklist

- [ ] Scenario 1: WebSocket Connection Testing
- [ ] Scenario 2: Activity Capture Testing  
- [ ] Scenario 3: Admin Dashboard Data Loading
- [ ] Scenario 4: Error Handling Testing
- [ ] Performance Verification
- [ ] Log Level Testing
- [ ] All Success Criteria Met

---

**Note:** Keep this testing guide updated as new features are added in subsequent phases.