/**
 * Flock OAuth Login Handler
 * Initiates OAuth flow with Flock
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFlockOAuth } from '@/lib/flock-oauth';
import { flockLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const redirectUrl = searchParams.get('redirect') || '/flock';

    flockLogger.info('Initiating Flock OAuth login', { redirectUrl });

    // Initialize OAuth client
    const oauth = createFlockOAuth();

    // Generate state parameter for security
    const state = oauth.generateState();

    // Generate authorization URL
    const authUrl = oauth.getAuthorizationUrl(state);

    flockLogger.info('Generated Flock OAuth URL with state', {
      state: state.substring(0, 8) + '...',
      redirectUrl,
      duration: Date.now() - startTime
    });

    // Create response with redirect to Flock OAuth
    const response = NextResponse.redirect(authUrl);

    // Set state cookie for validation during callback
    response.cookies.set('flock_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });

    // Store redirect URL in cookie for post-auth redirect
    response.cookies.set('flock_oauth_redirect', redirectUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });

    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    flockLogger.error('Flock OAuth login error', {
      error: error instanceof Error ? error.message : error,
      duration
    });

    const errorUrl = new URL('/flock', request.url);
    errorUrl.searchParams.set('oauth_error', 'login_error');
    errorUrl.searchParams.set('error_description', error instanceof Error ? error.message : 'Unknown error during OAuth login');

    return NextResponse.redirect(errorUrl);
  }
}