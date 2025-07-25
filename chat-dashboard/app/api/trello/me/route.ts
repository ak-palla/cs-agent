/**
 * Get current authenticated Trello user
 * Server-side endpoint for browser OAuth client
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTrelloOAuth, TrelloOAuth } from '@/lib/trello-oauth';
import trelloLogger from '@/lib/trello-logger';

export async function GET(request: NextRequest) {
  try {
    // Get access token from cookie
    const accessTokenCookie = request.cookies.get('trello_access_token');
    if (!accessTokenCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    let accessToken;
    try {
      accessToken = JSON.parse(accessTokenCookie.value);
    } catch (error) {
      trelloLogger.error('Invalid access token format in cookie');
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const oauth = new TrelloOAuth({
      apiKey: process.env.NEXT_PUBLIC_TRELLO_API_KEY || '',
      apiSecret: process.env.TRELLO_API_SECRET || '',
      redirectUri: process.env.NEXT_PUBLIC_TRELLO_OAUTH_REDIRECT_URI || 'https://localhost:3000/auth/trello/callback',
      scopes: ['read', 'write', 'account'],
      expiration: 'never'
    });

    const user = await oauth.getCurrentUser(accessToken);
    
    trelloLogger.info('Current Trello user fetched via API', {
      userId: user.id,
      username: user.username
    });

    return NextResponse.json(user);
  } catch (error) {
    trelloLogger.error('Error fetching current Trello user via API', {
      error: error instanceof Error ? error.message : error
    });
    
    return NextResponse.json(
      { error: 'Failed to fetch user' }, 
      { status: 500 }
    );
  }
}