/**
 * Check Flock OAuth authentication status
 */

import { NextRequest, NextResponse } from 'next/server';
import { flockLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('flock_token')?.value;
    const userCookie = request.cookies.get('flock_user')?.value;

    if (!token) {
      return NextResponse.json({
        authenticated: false,
        token: null,
        user: null,
      });
    }

    let user = null;
    if (userCookie) {
      try {
        user = JSON.parse(decodeURIComponent(userCookie));
      } catch (error) {
        flockLogger.error('Error parsing user cookie', { error });
      }
    }

    return NextResponse.json({
      authenticated: true,
      token,
      user,
    });

  } catch (error) {
    flockLogger.error('Error checking Flock auth', { error });
    return NextResponse.json({
      authenticated: false,
      token: null,
      user: null,
      error: error instanceof Error ? error.message : 'Authentication check failed',
    }, { status: 500 });
  }
}