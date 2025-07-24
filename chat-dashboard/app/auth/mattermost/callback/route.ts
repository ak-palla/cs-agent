/**
 * Mattermost OAuth Callback Handler
 * Processes OAuth authorization codes and exchanges them for tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMattermostOAuth } from '@/lib/mattermost-oauth';
import { mattermostLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    mattermostLogger.info('OAuth callback received', {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error,
      state: state?.substring(0, 8) + '...'
    });

    // Handle OAuth error
    if (error) {
      mattermostLogger.error('OAuth authorization error', {
        error,
        errorDescription,
        state
      });

      const errorUrl = new URL('/mattermost', request.url);
      errorUrl.searchParams.set('oauth_error', error);
      errorUrl.searchParams.set('error_description', errorDescription || 'Unknown OAuth error');

      return NextResponse.redirect(errorUrl);
    }

    // Validate required parameters
    if (!code) {
      mattermostLogger.error('OAuth callback missing authorization code');
      
      const errorUrl = new URL('/mattermost', request.url);
      errorUrl.searchParams.set('oauth_error', 'missing_code');
      errorUrl.searchParams.set('error_description', 'Authorization code not provided');

      return NextResponse.redirect(errorUrl);
    }

    // Validate state parameter (should match what we sent)
    const storedState = request.cookies.get('oauth_state')?.value;
    if (state !== storedState) {
      mattermostLogger.error('OAuth state mismatch', {
        receivedState: state?.substring(0, 8) + '...',
        storedState: storedState?.substring(0, 8) + '...'
      });

      const errorUrl = new URL('/mattermost', request.url);
      errorUrl.searchParams.set('oauth_error', 'invalid_state');
      errorUrl.searchParams.set('error_description', 'State parameter validation failed');

      return NextResponse.redirect(errorUrl);
    }

    // Initialize OAuth client
    const oauth = createMattermostOAuth();

    // Exchange code for token
    const tokenData = await oauth.exchangeCodeForToken(code, state);

    // Get user information
    const user = await oauth.getCurrentUser(tokenData.access_token);

    mattermostLogger.info('OAuth flow completed successfully', {
      userId: user.id,
      username: user.username,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      duration: Date.now() - startTime
    });

    // Create response with success redirect
    const successUrl = new URL('/mattermost', request.url);
    successUrl.searchParams.set('oauth_success', 'true');
    successUrl.searchParams.set('user_id', user.id);
    successUrl.searchParams.set('username', user.username);

    const response = NextResponse.redirect(successUrl);

    // Clear the state cookie
    response.cookies.delete('oauth_state');

    // Set secure token cookie (httpOnly for security)
    response.cookies.set('mattermost_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in,
      path: '/',
    });

    // Set user info cookie (accessible to client)
    response.cookies.set('mattermost_user', JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
    }), {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in,
      path: '/',
    });

    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    mattermostLogger.error('OAuth callback error', {
      error: error instanceof Error ? error.message : error,
      duration
    });

    const errorUrl = new URL('/mattermost', request.url);
    errorUrl.searchParams.set('oauth_error', 'callback_error');
    errorUrl.searchParams.set('error_description', error instanceof Error ? error.message : 'Unknown error during OAuth callback');

    return NextResponse.redirect(errorUrl);
  }
}