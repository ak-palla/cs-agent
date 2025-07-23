import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/flock/users
 * Get users/members in team or channel
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const channelId = searchParams.get('channelId');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header with Bearer token required' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const appId = process.env.NEXT_PUBLIC_FLOCK_APP_ID;
    const appSecret = process.env.FLOCK_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: 'Flock credentials not configured' },
        { status: 500 }
      );
    }

    // Test multiple Flock API base URLs and endpoints
    const possibleBaseUrls = [
      'https://api.flock.co/v1',
      'https://dev.flock.co/api/v1',
    ];

    // Different endpoint patterns based on what we're fetching
    const endpointPatterns = channelId 
      ? ['/groups.getMembers', '/channels.getMembers', `/groups/${channelId}/members`]
      : teamId 
        ? ['/teams.getMembers', `/teams/${teamId}/members`, '/users.list']
        : ['/users.list', '/users.getInfo', '/groups.list'];

    // Different auth methods to try
    const authMethods = [
      { 'Authorization': `Bearer ${accessToken}` },
      { 'X-Flock-Token': accessToken },
      { 'X-Auth-Token': accessToken },
    ];

    let response: Response | null = null;
    let flockResponse: any = null;
    let lastError = '';

    console.log(`📡 Testing ${possibleBaseUrls.length} base URLs with ${endpointPatterns.length} endpoint patterns...`);

    // Try each combination
    for (const baseUrl of possibleBaseUrls) {
      for (const endpointPattern of endpointPatterns) {
        for (const authMethod of authMethods) {
          const fullUrl = `${baseUrl}${endpointPattern}${channelId ? `?channel=${channelId}` : teamId ? `?team=${teamId}` : ''}`;
          
          try {
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              'User-Agent': 'CS-Agent-Dashboard/1.0',
              'Accept': 'application/json',
            };
            
            // Add auth headers
            Object.entries(authMethod).forEach(([key, value]) => {
              headers[key] = String(value);
            });

            console.log(`📡 Trying: ${fullUrl} with ${Object.keys(authMethod)[0]}`);

            response = await fetch(fullUrl, {
              method: 'GET',
              headers,
              signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
              const responseText = await response.text();
              try {
                flockResponse = JSON.parse(responseText);
                console.log(`✅ SUCCESS with ${fullUrl} using ${Object.keys(authMethod)[0]}`);
                break;
              } catch (parseError) {
                console.log(`⚠️ Response OK but JSON parse failed: ${parseError}`);
                lastError = `JSON parse error: ${parseError}`;
                continue;
              }
            } else {
              const errorText = await response.text();
              lastError = `${response.status} ${response.statusText}: ${errorText.substring(0, 200)}`;
              console.log(`❌ Failed: ${fullUrl} - ${lastError}`);
            }
          } catch (error) {
            lastError = `Network error: ${error}`;
            console.log(`🚫 Error: ${fullUrl} - ${lastError}`);
          }
        }
        
        if (response && response.ok && flockResponse) break;
      }
      
      if (response && response.ok && flockResponse) break;
    }

    // If all attempts failed
    if (!response || !response.ok || !flockResponse) {
      console.error('🚨 All Flock users endpoints failed');
      return NextResponse.json(
        { error: `Failed to fetch users from Flock API. Last error: ${lastError}` },
        { status: 502 }
      );
    }

    // Normalize response data
    const users = Array.isArray(flockResponse) ? flockResponse : 
                  flockResponse.users || flockResponse.members || 
                  flockResponse.data || [];

    return NextResponse.json({
      success: true,
      data: users,
      total: users.length
    });

  } catch (error) {
    console.error('Error fetching Flock users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
} 