/**
 * Refresh Flock OAuth token endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFlockOAuth } from '@/lib/flock-oauth';
import { flockLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('flock_refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json({
        success: false,
        error: 'No refresh token available',
      }, { status: 401 });
    }

    const oauth = createFlockOAuth();
    const tokenData = await oauth.refreshToken(refreshToken);

    const response = NextResponse.json({
      success: true,
      token: tokenData.access_token,
    });

    // Update token cookies
    response.cookies.set('flock_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenData.expires_in,
      path: '/',
    });

    if (tokenData.refresh_token) {
      response.cookies.set('flock_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
    }

    flockLogger.info('Flock token refreshed successfully');

    return response;

  } catch (error) {
    flockLogger.error('Flock token refresh error', { error });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh failed',
    }, { status: 500 });
  }
}