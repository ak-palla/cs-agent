import { NextRequest, NextResponse } from 'next/server';
import FlockApiClient from '@/lib/flock-client';

/**
 * GET /api/flock/search
 * Search messages, channels, and users
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'all';

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header with Bearer token required' },
        { status: 401 }
      );
    }

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          messages: [],
          channels: [],
          users: []
        }
      });
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const appId = process.env.NEXT_PUBLIC_FLOCK_APP_ID;
    const appSecret = process.env.FLOCK_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.json(
        { error: 'Flock credentials not configured' },
        { status: 500 }
      );
    }

    const flockClient = new FlockApiClient(appId, appSecret);
    flockClient.setAccessToken(accessToken);

    const results = await flockClient.search(
      query.trim(), 
      type as 'messages' | 'channels' | 'users' | 'all'
    );

    return NextResponse.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Error searching Flock:', error);
    return NextResponse.json(
      { error: 'Failed to search' },
      { status: 500 }
    );
  }
} 