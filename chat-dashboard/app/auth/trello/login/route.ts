/**
 * Trello OAuth Login Route
 * Initiates the OAuth 1.0a flow by redirecting to Trello's authorization page
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTrelloOAuth } from '@/lib/trello-oauth';
import trelloLogger from '@/lib/trello-logger';

export async function GET(request: NextRequest) {
  try {
    trelloLogger.info('Initiating Trello OAuth login');

    const trelloOAuth = createTrelloOAuth();

    // Step 1: Get request token
    const requestToken = await trelloOAuth.getRequestToken();

    if (!requestToken.oauth_token) {
      throw new Error('Failed to obtain request token');
    }

    // Step 2: Generate authorization URL
    const authUrl = trelloOAuth.getAuthorizationUrl(
      requestToken.oauth_token,
      'Chat Dashboard' // App name shown to user
    );

    trelloLogger.info('Redirecting to Trello authorization', {
      requestToken: requestToken.oauth_token.substring(0, 8) + '...',
      callbackConfirmed: requestToken.oauth_callback_confirmed
    });

    // Store request token in a cookie for callback access
    const response = NextResponse.redirect(authUrl);
    response.cookies.set('trello_request_token', JSON.stringify(requestToken), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    });

    return response;

  } catch (error) {
    trelloLogger.error('Trello OAuth login error', {
      error: error instanceof Error ? error.message : error
    });

    // Redirect to error page or main page with error
    const errorUrl = new URL('/auth/error', request.url);
    errorUrl.searchParams.set('error', 'trello_oauth_failed');
    errorUrl.searchParams.set('message', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.redirect(errorUrl.toString());
  }
}

export async function POST(request: NextRequest) {
  // Handle POST requests the same way as GET for flexibility
  return GET(request);
}