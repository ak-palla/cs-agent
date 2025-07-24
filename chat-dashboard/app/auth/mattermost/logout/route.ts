/**
 * Mattermost OAuth Logout
 * Clears authentication tokens and cookies
 */

import { NextRequest, NextResponse } from 'next/server';
import { mattermostLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    mattermostLogger.info('OAuth logout initiated');

    // Create response with redirect
    const response = NextResponse.redirect(new URL('/mattermost', request.url));

    // Clear all authentication cookies
    response.cookies.delete('mattermost_token');
    response.cookies.delete('mattermost_user');
    response.cookies.delete('oauth_state');

    mattermostLogger.info('OAuth logout completed - all cookies cleared');

    return response;

  } catch (error) {
    mattermostLogger.error('OAuth logout error', {
      error: error instanceof Error ? error.message : error
    });

    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Allow GET requests for logout as well
  return POST(request);
}