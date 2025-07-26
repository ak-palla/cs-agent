/**
 * Simple Flock Auth for Installed Apps
 * Uses app token instead of OAuth flow for installed apps
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFlockInstalledClient } from '@/lib/flock-installed-client';
import { flockLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const appToken = searchParams.get('token');
    const action = searchParams.get('action') || 'check';

    if (!appToken) {
      return NextResponse.json({
        error: 'Missing app token',
        action: 'Please provide your Flock app token'
      }, { status: 400 });
    }

    const client = createFlockInstalledClient();

    switch (action) {
      case 'check':
        const isValid = await client.validateToken(appToken);
        return NextResponse.json({
          success: isValid,
          message: isValid ? 'Token is valid' : 'Invalid token'
        });

      case 'user':
        const user = await client.getCurrentUser(appToken);
        return NextResponse.json({
          success: true,
          user
        });

      default:
        return NextResponse.json({
          error: 'Invalid action',
          actions: ['check', 'user']
        }, { status: 400 });
    }

  } catch (error) {
    flockLogger.error('Simple auth error', { error });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}