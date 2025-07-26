import { NextRequest, NextResponse } from 'next/server';
import { createFlockOAuth } from '@/lib/flock-oauth';
import { flockLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Test OAuth configuration
    const oauth = createFlockOAuth();
    
    const authUrl = oauth.getAuthorizationUrl('test-state-123');
    
    // Test environment variables
    const config = {
      clientId: process.env.NEXT_PUBLIC_FLOCK_CLIENT_ID,
      clientSecret: process.env.FLOCK_CLIENT_SECRET ? '***SET***' : '***MISSING***',
      serverUrl: process.env.NEXT_PUBLIC_FLOCK_URL,
      redirectUri: process.env.NEXT_PUBLIC_FLOCK_OAUTH_REDIRECT_URI,
    };

    const response = {
      status: 'success',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      config: {
        ...config,
        clientId: config.clientId ? '***SET***' : '***MISSING***',
      },
      oauthUrl: authUrl,
      testSteps: [
        '✅ Flock OAuth client initialized',
        '✅ Authorization URL generated',
        '✅ Environment variables validated',
      ],
      nextSteps: [
        'Visit the authorization URL to test OAuth flow',
        'Ensure your Flock app has the correct redirect URI configured',
        'Check that your app has the required permissions (chat:read, chat:write)',
      ],
    };

    flockLogger.info('Flock connection test completed', response);
    
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
  } catch (error) {
    const response = {
      status: 'error',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      config: {
        clientId: process.env.NEXT_PUBLIC_FLOCK_CLIENT_ID ? '***SET***' : '***MISSING***',
        clientSecret: process.env.FLOCK_CLIENT_SECRET ? '***SET***' : '***MISSING***',
        serverUrl: process.env.NEXT_PUBLIC_FLOCK_URL || 'https://api.flock.com',
        redirectUri: process.env.NEXT_PUBLIC_FLOCK_OAUTH_REDIRECT_URI,
      },
      troubleshooting: [
        'Check that NEXT_PUBLIC_FLOCK_CLIENT_ID is set',
        'Check that FLOCK_CLIENT_SECRET is set',
        'Verify Flock app configuration at https://dev.flock.co',
        'Ensure redirect URI matches your app settings',
      ],
    };

    flockLogger.error('Flock connection test failed', response);
    
    return NextResponse.json(response, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}