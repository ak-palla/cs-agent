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

    flockLogger.info('Flock app installed - using token-based flow', { redirectUrl });

    // For installed apps, redirect to simple token flow
    const simpleAuthUrl = new URL('/api/flock/simple-auth', request.url);
    simpleAuthUrl.searchParams.set('redirect', redirectUrl);
    
    return NextResponse.redirect(simpleAuthUrl);

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