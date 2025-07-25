/**
 * Trello integration health check
 * Verifies environment variables and authentication status
 */

import { NextResponse } from 'next/server';
import { createTrelloOAuth } from '@/lib/trello-oauth';
import trelloLogger from '@/lib/trello-logger';

export async function GET() {
  try {
    const config = {
      apiKey: process.env.NEXT_PUBLIC_TRELLO_API_KEY,
      apiSecret: process.env.TRELLO_API_SECRET,
      redirectUri: process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI,
    };

    const isConfigured = 
      config.apiKey && 
      config.apiSecret && 
      config.redirectUri;

    let isAuthenticated = false;
    let testResult = null;

    if (isConfigured) {
      try {
        const trelloOAuth = createTrelloOAuth();
        isAuthenticated = trelloOAuth.isAuthenticated();
        
        if (isAuthenticated) {
          testResult = await trelloOAuth.testConnection();
        }
      } catch (error) {
        trelloLogger.warn('Trello OAuth test failed', { error });
      }
    }

    return NextResponse.json({
      configured: isConfigured,
      authenticated: isAuthenticated,
      testResult,
      config: {
        apiKey: config.apiKey ? '***SET***' : '***MISSING***',
        apiSecret: config.apiSecret ? '***SET***' : '***MISSING***',
        redirectUri: config.redirectUri ? '***SET***' : '***MISSING***',
      },
    });
  } catch (error) {
    trelloLogger.error('Trello health check failed', {
      error: error instanceof Error ? error.message : error
    });

    return NextResponse.json(
      { 
        configured: false,
        authenticated: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}