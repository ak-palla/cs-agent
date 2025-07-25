/**
 * Flock OAuth logout endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { flockLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true });

    // Clear all Flock-related cookies
    response.cookies.delete('flock_token');
    response.cookies.delete('flock_refresh_token');
    response.cookies.delete('flock_user');
    response.cookies.delete('flock_oauth_state');

    flockLogger.info('Flock OAuth logout successful');

    return response;

  } catch (error) {
    flockLogger.error('Flock logout error', { error });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Logout failed',
    }, { status: 500 });
  }
}