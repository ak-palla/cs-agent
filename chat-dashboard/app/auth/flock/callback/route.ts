/**
 * Flock OAuth Callback Handler
 * Processes OAuth authorization codes and exchanges them for tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFlockOAuth } from '@/lib/flock-oauth';
import { flockLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    flockLogger.info('Flock OAuth callback received', {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error,
      state: state?.substring(0, 8) + '...'
    });

    // Handle OAuth error
    if (error) {
      flockLogger.error('Flock OAuth authorization error', {
        error,
        errorDescription,
        state
      });

      const errorUrl = new URL('/flock', request.url);
      errorUrl.searchParams.set('oauth_error', error);
      errorUrl.searchParams.set('error_description', errorDescription || 'Unknown OAuth error');

      return NextResponse.redirect(errorUrl);
    }

    // Validate required parameters
    if (!code) {
      flockLogger.error('Flock OAuth callback missing authorization code');
      
      const errorUrl = new URL('/flock', request.url);
      errorUrl.searchParams.set('oauth_error', 'missing_code');
      errorUrl.searchParams.set('error_description', 'Authorization code not provided');

      return NextResponse.redirect(errorUrl);
    }

    // Validate state parameter (should match what we sent)
    const storedState = request.cookies.get('flock_oauth_state')?.value;
    if (state !== storedState) {
      flockLogger.error('Flock OAuth state mismatch', {
        receivedState: state?.substring(0, 8) + '...',
        storedState: storedState?.substring(0, 8) + '...'
      });

      const errorUrl = new URL('/flock', request.url);
      errorUrl.searchParams.set('oauth_error', 'invalid_state');
      errorUrl.searchParams.set('error_description', 'State parameter validation failed');

      return NextResponse.redirect(errorUrl);
    }

    // Initialize OAuth client
    const oauth = createFlockOAuth();

    // Exchange code for token
    const tokenData = await oauth.exchangeCodeForToken(code, state);

    // Get user information
    const user = await oauth.getCurrentUser(tokenData.access_token);

    flockLogger.info('Flock OAuth flow completed successfully', {
      userId: user.id,
      email: user.email,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      duration: Date.now() - startTime
    });

    // Create response with success redirect
    const successUrl = new URL('/flock', request.url);
    successUrl.searchParams.set('oauth_success', 'true');
    successUrl.searchParams.set('user_id', user.id);
    successUrl.searchParams.set('email', user.email);

    const response = NextResponse.redirect(successUrl);

    // Clear the state cookie
    response.cookies.delete('flock_oauth_state');

    // Set secure token cookie (httpOnly for security)
    response.cookies.set('flock_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in,
      path: '/',
    });

    // Set refresh token cookie if available
    if (tokenData.refresh_token) {
      response.cookies.set('flock_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
    }

    // Set user info cookie (accessible to client)
    response.cookies.set('flock_user', JSON.stringify({
      id: user.id,
      userId: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImage: user.profileImage,
    }), {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in,
      path: '/',
    });

    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    flockLogger.error('Flock OAuth callback error', {
      error: error instanceof Error ? error.message : error,
      duration
    });

    const errorUrl = new URL('/flock', request.url);
    errorUrl.searchParams.set('oauth_error', 'callback_error');
    errorUrl.searchParams.set('error_description', error instanceof Error ? error.message : 'Unknown error during OAuth callback');

    return NextResponse.redirect(errorUrl);
  }
}