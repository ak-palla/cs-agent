/**
 * Mattermost OAuth Login Initiation
 * Starts the OAuth flow by redirecting to Mattermost authorization server
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMattermostOAuth } from '@/lib/mattermost-oauth';
import { mattermostLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    mattermostLogger.info('OAuth login initiated');

    // Initialize OAuth client
    const oauth = createMattermostOAuth();

    // Generate secure state parameter
    const state = oauth.generateState();

    // Get authorization URL
    const authUrl = oauth.getAuthorizationUrl(state);

    mattermostLogger.info('Redirecting to Mattermost authorization server', {
      state: state.substring(0, 8) + '...',
      authUrl: authUrl.replace(/client_id=[^&]+/, 'client_id=***CLIENT_ID***')
    });

    // Create response with redirect
    const response = NextResponse.redirect(authUrl);

    // Store state in secure cookie for validation
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;

  } catch (error) {
    mattermostLogger.error('OAuth login initiation error', {
      error: error instanceof Error ? error.message : error
    });

    // Redirect back to Mattermost page with error
    const errorUrl = new URL('/mattermost', request.url);
    errorUrl.searchParams.set('oauth_error', 'login_init_error');
    errorUrl.searchParams.set('error_description', error instanceof Error ? error.message : 'Failed to initialize OAuth login');

    return NextResponse.redirect(errorUrl);
  }
}