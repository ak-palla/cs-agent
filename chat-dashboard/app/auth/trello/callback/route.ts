/**
 * Trello OAuth Callback Route
 * Handles the OAuth callback from Trello and exchanges tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTrelloOAuth } from '@/lib/trello-oauth';
import trelloLogger from '@/lib/trello-logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const oauthToken = searchParams.get('oauth_token');
    const oauthVerifier = searchParams.get('oauth_verifier');
    const denied = searchParams.get('denied');

    trelloLogger.info('Trello OAuth callback received', {
      hasToken: !!oauthToken,
      hasVerifier: !!oauthVerifier,
      denied: !!denied
    });

    // Handle user denial
    if (denied) {
      trelloLogger.info('User denied Trello OAuth authorization');
      const errorUrl = new URL('/trello', request.url);
      errorUrl.searchParams.set('error', 'access_denied');
      errorUrl.searchParams.set('message', 'Authorization was denied by user');
      return NextResponse.redirect(errorUrl.toString());
    }

    // Validate required parameters
    if (!oauthToken || !oauthVerifier) {
      throw new Error('Missing required OAuth parameters');
    }

    const trelloOAuth = createTrelloOAuth();

    // Get request token from cookie
    const requestTokenCookie = request.cookies.get('trello_request_token');
    if (!requestTokenCookie) {
      throw new Error('Request token not found - please restart the OAuth flow');
    }

    let requestToken;
    try {
      requestToken = JSON.parse(requestTokenCookie.value);
    } catch (error) {
      throw new Error('Invalid request token format');
    }

    // Step 3: Exchange request token + verifier for access token
    const accessToken = await trelloOAuth.getAccessToken(oauthToken, oauthVerifier, requestToken.oauth_token_secret);

    // Clean up the request token cookie
    const response = NextResponse.redirect(new URL('/trello', request.url).toString());
    response.cookies.delete('trello_request_token');

    if (!accessToken.oauth_token || !accessToken.oauth_token_secret) {
      throw new Error('Failed to obtain access token');
    }

    trelloLogger.info('Trello OAuth flow completed successfully', {
      hasAccessToken: !!accessToken.oauth_token,
      hasSessionHandle: !!accessToken.oauth_session_handle
    });

    // Verify the token works by fetching user info
    try {
      const user = await trelloOAuth.getCurrentUser(accessToken);
      trelloLogger.info('Trello user authenticated successfully', {
        userId: user.id,
        username: user.username,
        fullName: user.fullName
      });
    } catch (userError) {
      trelloLogger.warn('Failed to verify user token, but proceeding', {
        error: userError instanceof Error ? userError.message : userError
      });
    }

    // Store the access token in cookies for both server and client access
    response.cookies.set('trello_access_token', JSON.stringify(accessToken), {
      httpOnly: false, // Allow client-side access for debugging
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    response.cookies.set('trello_auth_success', 'true', {
      maxAge: 60 * 5 // 5 minutes
    });

    return response;

  } catch (error) {
    trelloLogger.error('Trello OAuth callback error', {
      error: error instanceof Error ? error.message : error
    });

    // Redirect to Trello page with error
    const errorUrl = new URL('/trello', request.url);
    errorUrl.searchParams.set('error', 'trello_callback_failed');
    errorUrl.searchParams.set('message', error instanceof Error ? error.message : 'OAuth callback failed');
    
    return NextResponse.redirect(errorUrl.toString());
  }
}

export async function POST(request: NextRequest) {
  // Handle POST requests the same way as GET for flexibility
  return GET(request);
}